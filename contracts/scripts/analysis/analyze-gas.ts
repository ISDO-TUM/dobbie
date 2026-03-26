import { network } from "hardhat";
import { keccak256, toHex, parseEventLogs } from "viem";
import "dotenv/config";

// --- CONFIGURATION ---
const GAS_PRICE_GWEI = 20; // Standard L1 gas price assumption

// --- HELPER: Fetch 30-Day Average ETH Price ---
// Uses CoinGecko (free, no API key) for 30-day historical data.
// Falls back to CoinMarketCap spot price if CoinGecko is unavailable.
async function getEthPrice(): Promise<{
  price: number;
  source: string;
  period: string;
}> {
  // Try CoinGecko 30-day average first (free, no key required)
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=30&interval=daily"
    );
    if (!response.ok) throw new Error(`CoinGecko API Error: ${response.statusText}`);

    const data = await response.json();
    const prices: [number, number][] = data.prices;
    const values = prices.map(([, price]) => price);
    const avg = values.reduce((sum, p) => sum + p, 0) / values.length;
    const from = new Date(prices[0][0]).toISOString().split("T")[0];
    const to = new Date(prices[prices.length - 1][0]).toISOString().split("T")[0];

    console.log(`  CoinGecko: ${values.length} daily prices (${from} to ${to})`);
    console.log(`  30-Day Avg: $${avg.toFixed(2)} | Min: $${Math.min(...values).toFixed(2)} | Max: $${Math.max(...values).toFixed(2)}`);

    return { price: avg, source: "CoinGecko", period: `30-day avg (${from} to ${to})` };
  } catch (err) {
    console.warn("  CoinGecko unavailable, trying CoinMarketCap...");
  }

  // Fallback: CoinMarketCap spot price (requires API key)
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(
        "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH&convert=USD",
        { headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" } }
      );
      if (!response.ok) throw new Error(`CMC API Error: ${response.statusText}`);
      const data = await response.json();
      const price = data.data.ETH.quote.USD.price;
      const date = new Date().toISOString().split("T")[0];
      console.log(`  CoinMarketCap spot price: $${price.toFixed(2)} (${date})`);
      return { price, source: "CoinMarketCap", period: `spot (${date})` };
    } catch (err) {
      console.warn("  CoinMarketCap also unavailable.");
    }
  }

  console.error("  ERROR: Could not fetch ETH price from any source.");
  process.exit(1);
}

async function main() {
  console.log("\n=== GAS COST ANALYSIS ===\n");

  // 1. GET PRICE
  const priceData = await getEthPrice();
  const ethPrice = priceData.price;
  console.log(`\n  Using: ETH = $${ethPrice.toFixed(2)} (${priceData.period}), Gas Price = ${GAS_PRICE_GWEI} gwei\n`);

  // 2. SETUP
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [deployer, stakeholder1, stakeholder2] = await viem.getWalletClients();

  const calculateCost = (gasUsed: bigint) => {
    const costEth = Number(gasUsed) * GAS_PRICE_GWEI * 1e-9;
    const costUsd = costEth * ethPrice;
    return {
      gas: Number(gasUsed).toLocaleString("en-US"),
      eth: costEth.toFixed(5),
      usd: `$${costUsd.toFixed(2)}`,
    };
  };

  const report: { Step: string; gas: string; eth: string; usd: string }[] = [];
  let totalGas = 0n;

  // --- STEP 1: DEPLOYMENT ---
  console.log("1. Deploying Contracts...");
  const timelock = await viem.deployContract("CustomTimelockController", [
    0n, [], [], deployer.account.address,
  ]);
  const governor = await viem.deployContract("DevOpsGovernor", [
    "Gov", timelock.address,
    [stakeholder1.account.address, stakeholder2.account.address],
    [], [], 0n, 5n,
  ]);
  const registry = await viem.deployContract("DeploymentRegistry", [
    governor.address, deployer.account.address,
  ]);

  // Setup Roles
  const roleTx = await registry.write.grantRole([
    await registry.read.EXECUTOR_ROLE(), timelock.address,
  ]);
  const roleReceipt = await publicClient.waitForTransactionReceipt({ hash: roleTx });
  report.push({ Step: "Setup: Grant Role", ...calculateCost(roleReceipt.gasUsed) });
  totalGas += roleReceipt.gasUsed;

  await timelock.write.grantRole([await timelock.read.PROPOSER_ROLE(), governor.address]);
  await timelock.write.grantRole([await timelock.read.EXECUTOR_ROLE(), governor.address]);

  // --- STEP 2: PROPOSE ---
  console.log("2. Proposing Change...");
  const projectId = keccak256(toHex("GasTestProject"));
  const description = "Gas Analysis Proposal";

  const hashPropose = await governor.write.proposePackage(
    [[timelock.address], [0n], ["0x"], description, projectId, "QmHash", timelock.address],
    { account: stakeholder1.account }
  );
  const receiptPropose = await publicClient.waitForTransactionReceipt({ hash: hashPropose });
  report.push({ Step: "Propose Package", ...calculateCost(receiptPropose.gasUsed) });
  totalGas += receiptPropose.gasUsed;

  const logs = parseEventLogs({
    abi: governor.abi, eventName: "ProposalCreated", logs: receiptPropose.logs,
  });
  const args: any = logs[0].args;
  const proposalId = args.proposalId;

  // --- STEP 3: VOTE ---
  console.log("3. Casting Votes...");
  await testClient.mine({ blocks: 1 });

  const hashVote1 = await governor.write.castVote([proposalId, 1], { account: stakeholder1.account });
  const receiptVote1 = await publicClient.waitForTransactionReceipt({ hash: hashVote1 });
  report.push({ Step: "Cast Vote (Stakeholder 1)", ...calculateCost(receiptVote1.gasUsed) });
  totalGas += receiptVote1.gasUsed;

  const hashVote2 = await governor.write.castVote([proposalId, 1], { account: stakeholder2.account });
  const receiptVote2 = await publicClient.waitForTransactionReceipt({ hash: hashVote2 });
  report.push({ Step: "Cast Vote (Stakeholder 2)", ...calculateCost(receiptVote2.gasUsed) });
  totalGas += receiptVote2.gasUsed;

  // --- STEP 4: QUEUE ---
  console.log("4. Queuing...");
  await testClient.mine({ blocks: 10 });

  const descriptionHash = keccak256(toHex(description));
  const hashQueue = await governor.write.queue(
    [[timelock.address], [0n], ["0x"], descriptionHash],
    { account: stakeholder1.account }
  );
  const receiptQueue = await publicClient.waitForTransactionReceipt({ hash: hashQueue });
  report.push({ Step: "Queue Proposal", ...calculateCost(receiptQueue.gasUsed) });
  totalGas += receiptQueue.gasUsed;

  // --- STEP 5: EXECUTE ---
  console.log("5. Executing...");
  const hashExec = await governor.write.execute(
    [[timelock.address], [0n], ["0x"], descriptionHash],
    { account: stakeholder1.account }
  );
  const receiptExec = await publicClient.waitForTransactionReceipt({ hash: hashExec });
  report.push({ Step: "Execute Proposal", ...calculateCost(receiptExec.gasUsed) });
  totalGas += receiptExec.gasUsed;

  // --- TOTAL ---
  report.push({ Step: "TOTAL LIFECYCLE", ...calculateCost(totalGas) });

  // --- FINAL REPORT ---
  console.log("\n=========================================================");
  console.log("  GAS COST ANALYSIS REPORT");
  console.log(`  ETH Price: $${ethPrice.toFixed(2)} (${priceData.period})`);
  console.log(`  Gas Price: ${GAS_PRICE_GWEI} gwei (L1 standard assumption)`);
  console.log(`  Source: ${priceData.source}`);
  console.log("=========================================================");
  console.table(report);
  console.log("=========================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
