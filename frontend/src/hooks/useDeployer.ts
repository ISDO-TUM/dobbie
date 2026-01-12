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

export interface ContractArtifact {
  abi: InterfaceAbi;
  bytecode: string;
}

export interface BotConfig {
  address: string;
  role: "proposer" | "propagator";
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

const FACTORY_EVENTS_ABI = [
  "event Step(uint8 indexed stepNumber, uint8 totalSteps, string message)",
  "event ContractDeployed(string contractType, address indexed contractAddress)",
  "event RoleGranted(string contractName, string roleName, address indexed account)",
  "event RoleRenounced(string contractName, string roleName, address indexed account)",
  "event DeploymentComplete(address indexed timelockAddress, address indexed governorAddress, address indexed registryAddress)",
];

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

      const propagatorBots = args.bots
        .filter((b) => b.role === "propagator")
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
          propagatorBots,
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
      // STEP 4: PARSE EVENTS FOR PROGRESS LOGS
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
