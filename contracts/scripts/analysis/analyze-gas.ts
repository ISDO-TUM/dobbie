import { network } from "hardhat";
import { keccak256, toHex, parseEventLogs } from "viem";
import "dotenv/config"; // Ensure env vars are loaded

// --- DEFAULT CONFIGURATION (Fallback) ---
const FALLBACK_ETH_PRICE = 3000;
const GAS_PRICE_GWEI = 20; // Standard L1 gas price assumption

// --- HELPER: Fetch Live ETH Price ---
async function getEthPrice(): Promise<number> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  COINMARKETCAP_API_KEY not found. Using fallback price.");
    return FALLBACK_ETH_PRICE;
  }

  try {
    const response = await fetch(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH&convert=USD",
      {
        method: "GET",
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

    const data = await response.json();
    const price = data.data.ETH.quote.USD.price;
    console.log(`✅ Fetched Live ETH Price: $${price.toFixed(2)}`);
    return price;
  } catch (error) {
    console.error("❌ Failed to fetch price:", error);
    return FALLBACK_ETH_PRICE;
  }
}

async function main() {
  console.log("\n📊 STARTING GAS COST ANALYSIS FOR THESIS...");

  // 1. GET PRICE
  const ethPrice = await getEthPrice();
  console.log(
    `   Using: ETH = $${ethPrice.toFixed(2)}, Gas Price = ${GAS_PRICE_GWEI} gwei\n`
  );

  // 2. SETUP
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [deployer, stakeholder1, stakeholder2] = await viem.getWalletClients();

  const calculateCost = (gasUsed: bigint) => {
    const costEth = Number(gasUsed) * GAS_PRICE_GWEI * 1e-9;
    const costUsd = costEth * ethPrice;
    return {
      gas: gasUsed.toString(),
      eth: costEth.toFixed(5),
      usd: costUsd.toFixed(2),
    };
  };

  const report = [];

  // --- STEP 1: DEPLOYMENT ---
  console.log("1. Deploying Contracts...");
  const timelock = await viem.deployContract("CustomTimelockController", [
    0n,
    [],
    [],
    deployer.account.address,
  ]);
  const governor = await viem.deployContract("DevOpsGovernor", [
    "Gov",
    timelock.address,
    [stakeholder1.account.address, stakeholder2.account.address],
    [],
    [],
    0n,
    5n,
  ]);
  const registry = await viem.deployContract("DeploymentRegistry", [
    governor.address,
    deployer.account.address,
  ]);

  // Setup Roles (One-time setup costs)
  const roleTx = await registry.write.grantRole([
    await registry.read.EXECUTOR_ROLE(),
    timelock.address,
  ]);
  const roleReceipt = await publicClient.waitForTransactionReceipt({
    hash: roleTx,
  });
  report.push({
    Step: "Setup: Grant Role",
    ...calculateCost(roleReceipt.gasUsed),
  });

  await timelock.write.grantRole([
    await timelock.read.PROPOSER_ROLE(),
    governor.address,
  ]);
  await timelock.write.grantRole([
    await timelock.read.EXECUTOR_ROLE(),
    governor.address,
  ]);

  // --- STEP 2: PROPOSE ---
  console.log("2. Proposing Change...");
  const projectId = keccak256(toHex("GasTestProject"));
  const description = "Gas Analysis Proposal";

  const hashPropose = await governor.write.proposePackage(
    [
      [timelock.address],
      [0n],
      ["0x"],
      description,
      projectId,
      "QmHash",
      timelock.address,
    ],
    { account: stakeholder1.account }
  );
  const receiptPropose = await publicClient.waitForTransactionReceipt({
    hash: hashPropose,
  });
  report.push({
    Step: "Propose Package",
    ...calculateCost(receiptPropose.gasUsed),
  });

  // Fetch Proposal ID
  const logs = parseEventLogs({
    abi: governor.abi,
    eventName: "ProposalCreated",
    logs: receiptPropose.logs,
  });
  const args: any = logs[0].args;
  const proposalId = args.proposalId;

  // --- STEP 3: VOTE ---
  console.log("3. Casting Votes...");
  await testClient.mine({ blocks: 1 });

  const hashVote1 = await governor.write.castVote([proposalId, 1], {
    account: stakeholder1.account,
  });
  const receiptVote1 = await publicClient.waitForTransactionReceipt({
    hash: hashVote1,
  });
  report.push({
    Step: "Cast Vote (Stakeholder 1)",
    ...calculateCost(receiptVote1.gasUsed),
  });

  const hashVote2 = await governor.write.castVote([proposalId, 1], {
    account: stakeholder2.account,
  });
  const receiptVote2 = await publicClient.waitForTransactionReceipt({
    hash: hashVote2,
  });
  report.push({
    Step: "Cast Vote (Stakeholder 2)",
    ...calculateCost(receiptVote2.gasUsed),
  });

  // --- STEP 4: QUEUE ---
  console.log("4. Queuing...");
  await testClient.mine({ blocks: 10 });

  const descriptionHash = keccak256(toHex(description));
  const hashQueue = await governor.write.queue(
    [[timelock.address], [0n], ["0x"], descriptionHash],
    { account: stakeholder1.account }
  );
  const receiptQueue = await publicClient.waitForTransactionReceipt({
    hash: hashQueue,
  });
  report.push({
    Step: "Queue Proposal",
    ...calculateCost(receiptQueue.gasUsed),
  });

  // --- STEP 5: EXECUTE ---
  console.log("5. Executing...");
  const hashExec = await governor.write.execute(
    [[timelock.address], [0n], ["0x"], descriptionHash],
    { account: stakeholder1.account }
  );
  const receiptExec = await publicClient.waitForTransactionReceipt({
    hash: hashExec,
  });
  report.push({
    Step: "Execute Proposal",
    ...calculateCost(receiptExec.gasUsed),
  });

  // --- FINAL REPORT ---
  console.log("\n=========================================================");
  console.log(` ⛽ GAS COST ANALYSIS REPORT`);
  console.log(
    `    Source: CoinMarketCap (Live) | Price: $${ethPrice.toFixed(2)}`
  );
  console.log("=========================================================");
  console.table(report);
  console.log("=========================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
