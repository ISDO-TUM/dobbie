import { useState } from "react";
import {
  BrowserProvider,
  ContractFactory,
  Contract,
  type InterfaceAbi,
  type Log,
  type TransactionReceipt,
  AbiCoder,
  getCreateAddress,
} from "ethers";

// --- 1. TYPES ---

export interface ContractArtifact {
  abi: InterfaceAbi;
  bytecode: string;
}

export interface BotConfig {
  address: string;
  role: "proposer" | "executor";
}

interface DeployArgs {
  factoryArtifact: ContractArtifact;
  timelockArtifact: ContractArtifact;
  governorArtifact: ContractArtifact;
  registryArtifact: ContractArtifact;
  teamName: string;
  stakeholders: string[];
  bots: BotConfig[];
  votingDelay: number;
  votingPeriod: number;
  minDelay: number;
}

interface DeployResult {
  governorAddress: string;
  registryAddress: string;
  timelockAddress: string;
  deploymentBlock: number;
}

// --- 2. FACTORY ABI (for event parsing) ---

const FACTORY_EVENTS_ABI = [
  "event Step(uint8 indexed stepNumber, uint8 totalSteps, string message)",
  "event ContractDeployed(string contractType, address indexed contractAddress)",
  "event RoleGranted(string contractName, string roleName, address indexed account)",
  "event RoleRenounced(string contractName, string roleName, address indexed account)",
  "event DeploymentComplete(address indexed timelockAddress, address indexed governorAddress, address indexed registryAddress)",
];

// --- 3. HELPER: Parse factory events from receipt ---

interface ParsedEvent {
  name: string;
  args: Record<string, unknown>;
}

function parseFactoryEvents(
  receipt: TransactionReceipt,
  factoryContract: Contract,
): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const log of receipt.logs) {
    try {
      const parsed = factoryContract.interface.parseLog({
        topics: [...(log as Log).topics],
        data: (log as Log).data,
      });
      if (parsed) {
        const args: Record<string, unknown> = {};
        // Use the fragment inputs to get named args properly in ethers v6
        parsed.fragment.inputs.forEach((input, index) => {
          args[input.name] = parsed.args[index];
        });
        events.push({ name: parsed.name, args });
      }
    } catch {
      // Log is from a different contract, skip
    }
  }

  return events;
}

// --- 4. HELPER: Process events and call onProgress ---

function processEventsForProgress(
  events: ParsedEvent[],
  onProgress: (msg: string) => void,
): DeployResult | null {
  let result: DeployResult | null = null;
  const deploymentBlock = 0;

  for (const event of events) {
    switch (event.name) {
      case "Step": {
        const step = event.args.stepNumber as number;
        const total = event.args.totalSteps as number;
        const message = event.args.message as string;
        onProgress(`${step}/${total} ${message}`);
        break;
      }
      case "ContractDeployed": {
        const contractType = event.args.contractType as string;
        const contractAddress = event.args.contractAddress as string;
        onProgress(`✅ ${contractType} deployed at: ${contractAddress}`);
        break;
      }
      case "RoleGranted": {
        const contractName = event.args.contractName as string;
        const roleName = event.args.roleName as string;
        const account = event.args.account as string;
        const shortAddr =
          account === "0x0000000000000000000000000000000000000000"
            ? "anyone"
            : `${account.slice(0, 6)}...${account.slice(-4)}`;
        onProgress(
          `  → Granted ${roleName} to ${shortAddr} on ${contractName}`,
        );
        break;
      }
      case "RoleRenounced": {
        const contractName = event.args.contractName as string;
        const roleName = event.args.roleName as string;
        onProgress(`  → Renounced ${roleName} on ${contractName}`);
        break;
      }
      case "DeploymentComplete": {
        const timelockAddress = event.args.timelockAddress as string;
        const governorAddress = event.args.governorAddress as string;
        const registryAddress = event.args.registryAddress as string;
        result = {
          timelockAddress,
          governorAddress,
          registryAddress,
          deploymentBlock,
        };
        onProgress("✅ System fully configured & sovereign.");
        break;
      }
    }
  }

  return result;
}

// --- 5. HOOK IMPLEMENTATION ---

export function useDeployer() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatBytecode = (bytecode: string) => {
    return bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;
  };

  const deployContracts = async (
    args: DeployArgs,
    onProgress: (msg: string) => void,
  ): Promise<DeployResult> => {
    setIsDeploying(true);
    setError(null);

    try {
      if (!window.ethereum)
        throw new Error("No crypto wallet found. Please install MetaMask.");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abiCoder = AbiCoder.defaultAbiCoder();

      // Filter Bots
      const proposerBots = args.bots
        .filter((b) => b.role === "proposer")
        .map((b) => b.address);

      const executorBots = args.bots
        .filter((b) => b.role === "executor")
        .map((b) => b.address);

      // =========================================================
      // STEP 1: DEPLOY THE FACTORY CONTRACT
      // =========================================================
      onProgress("🚀 Deploying Governance Factory...");
      onProgress(
        "(This single transaction will deploy & configure everything)",
      );

      const FactoryContractFactory = new ContractFactory(
        args.factoryArtifact.abi,
        formatBytecode(args.factoryArtifact.bytecode),
        signer,
      );

      const factoryContract = await FactoryContractFactory.deploy();
      await factoryContract.waitForDeployment();
      const factoryAddress = await factoryContract.getAddress();

      onProgress(`📦 Factory deployed at: ${factoryAddress}`);

      // =========================================================
      // STEP 2: PREPARE CONSTRUCTOR ARGUMENTS
      // =========================================================
      onProgress("⏳ Preparing deployment parameters...");

      // Timelock constructor: (uint256 minDelay, address[] proposers, address[] executors, address admin)
      const timelockArgs = abiCoder.encode(
        ["uint256", "address[]", "address[]", "address"],
        [args.minDelay, [], [], factoryAddress], // factory is temp admin
      );

      // Governor constructor: (string name, TimelockController timelock, address[] stakeholders, address[] proposerBots, address[] executorBots, uint256 votingDelay, uint256 votingPeriod)
      // We need to compute the timelock address first (CREATE uses nonce)
      // Actually, we pass the args and let the factory handle the order
      // The factory deploys: timelock first, then uses its address for governor

      // For the factory, we need to encode governor args with a PLACEHOLDER for timelock
      // But the factory's _deploy function just concatenates bytecode + args
      // So we need to pre-encode args knowing the timelock address...

      // SOLUTION: We use a 2-step approach in the factory call
      // Pass the args that DON'T depend on other addresses, factory fills in the rest

      // Actually, looking at the factory, it takes raw bytecodes and pre-encoded args
      // The challenge is governor needs timelock address which isn't known yet

      // Let me use CREATE2 to make addresses deterministic, OR
      // Have the factory encode args internally

      // Compute expected addresses using CREATE nonce
      // Factory nonce 1 = timelock, nonce 2 = governor, nonce 3 = registry
      const timelockAddress = getCreateAddress({
        from: factoryAddress,
        nonce: 1, // First deployment from factory
      });

      const governorAddress = getCreateAddress({
        from: factoryAddress,
        nonce: 2, // Second deployment
      });

      // Governor args: (string name, TimelockController timelock, address[] stakeholders, address[] proposerBots, address[] executorBots, uint256 votingDelay, uint256 votingPeriod)
      const governorArgs = abiCoder.encode(
        [
          "string",
          "address",
          "address[]",
          "address[]",
          "address[]",
          "uint256",
          "uint256",
        ],
        [
          args.teamName,
          timelockAddress,
          args.stakeholders,
          proposerBots,
          executorBots,
          args.votingDelay,
          args.votingPeriod,
        ],
      );

      // Registry args: (address governorAddress, address initialAdmin)
      const registryArgs = abiCoder.encode(
        ["address", "address"],
        [governorAddress, factoryAddress],
      );

      // =========================================================
      // STEP 3: CALL deployGovernanceSystem (SINGLE TX!)
      // =========================================================
      onProgress("⏳ Executing deployment transaction...");

      const factory = new Contract(
        factoryAddress,
        [...args.factoryArtifact.abi, ...FACTORY_EVENTS_ABI],
        signer,
      );

      const tx = await factory.deployGovernanceSystem(
        formatBytecode(args.timelockArtifact.bytecode),
        formatBytecode(args.governorArtifact.bytecode),
        formatBytecode(args.registryArtifact.bytecode),
        timelockArgs,
        governorArgs,
        registryArgs,
      );

      onProgress("⛏️ Mining transaction...");

      const receipt = await tx.wait();
      const deploymentBlock = receipt?.blockNumber ?? 0;

      onProgress(`🟦 Block: ${deploymentBlock}`);
      onProgress("📜 Parsing deployment logs...");
      onProgress("");

      // =========================================================
      // STEP 3: PARSE EVENTS FOR PROGRESS LOGS
      // =========================================================
      const events = parseFactoryEvents(receipt, factory);
      const result = processEventsForProgress(events, onProgress);

      if (!result) {
        throw new Error("Deployment completed but could not parse result");
      }

      // Add block number to result
      result.deploymentBlock = deploymentBlock;

      setIsDeploying(false);
      return result;
    } catch (err: unknown) {
      console.error("Deployment Error:", err);
      const msg = err instanceof Error ? err.message : "Deployment failed";
      setError(msg);
      setIsDeploying(false);
      throw new Error(msg);
    }
  };

  return { deployContracts, isDeploying, error };
}
