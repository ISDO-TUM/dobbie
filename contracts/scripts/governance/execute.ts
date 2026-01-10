import "dotenv/config";
import { keccak256, toHex, parseAbi, parseGwei } from "viem";
import { sepolia } from "viem/chains";
import {
  parseArgs,
  getPrivateKey,
  createClients,
  getContractInstance,
  getEnvAddress,
} from "../utils/index.js";

const GOVERNOR_ADDRESS = getEnvAddress("GOVERNOR_ADDRESS");
const DEPLOYMENT_BLOCK = 9515200n; // Use a reasonable start block
const CHUNK_SIZE = 10n;

const proposalCreatedAbi = parseAbi([
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parseArgs({
    "--proposer": String,
    "--proposal-id": String,
  });

  // 1. Setup Clients
  const privateKey = getPrivateKey(args["--proposer"]);
  const { publicClient, walletClient, account } = createClients(privateKey);

  if (!walletClient || !account) {
    throw new Error("Failed to initialize wallet client. Check private key.");
  }

  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    walletClient
  );

  const proposalId = BigInt(args["--proposal-id"]);

  console.log(`Executing proposal ID: ${proposalId}`);
  console.log(`As: ${account.address}`);
  console.log(`Governor: ${GOVERNOR_ADDRESS}\n`);

  const currentBlock = await publicClient.getBlockNumber();

  console.log(
    `Searching for proposal ${proposalId} logs from block ${DEPLOYMENT_BLOCK} to ${currentBlock}...`
  );

  let proposalEvent: any | undefined;

  // --- Scan Logs ---
  for (
    let fromBlock = DEPLOYMENT_BLOCK;
    fromBlock <= currentBlock;
    fromBlock += CHUNK_SIZE
  ) {
    const toBlock =
      fromBlock + CHUNK_SIZE - 1n > currentBlock
        ? currentBlock
        : fromBlock + CHUNK_SIZE - 1n;

    process.stdout.write(`\r  Scanning blocks ${fromBlock} to ${toBlock}...`);

    try {
      const logs = await publicClient.getLogs({
        address: GOVERNOR_ADDRESS,
        event: proposalCreatedAbi[0],
        args: { proposalId },
        fromBlock,
        toBlock,
      });

      if (logs.length > 0) {
        proposalEvent = logs[0];
        console.log(`\n  ✅ Found at block ${proposalEvent.blockNumber}!`);
        break;
      }
    } catch (_e) {
      // ignore
    }
  }

  if (!proposalEvent) {
    throw new Error(`\n❌ Proposal ${proposalId} not found.`);
  }

  const { targets, values, calldatas, description } = proposalEvent.args;
  const descriptionHash = keccak256(toHex(description));

  console.log("\n✅ Proposal found!");
  console.log("  Description:", description);

  console.log("\nSending execute transaction...");

  // --- Retry Loop ---
  let retries = 3;
  while (retries > 0) {
    let hash: `0x${string}` | undefined = undefined;
    try {
      const maxPriorityFeePerGas = parseGwei("2");
      const maxFeePerGas = parseGwei("20");

      hash = await governor.write.execute(
        [targets, values, calldatas, descriptionHash],
        {
          account,
          chain: sepolia,
          gas: 3_000_000n,
          maxFeePerGas,
          maxPriorityFeePerGas,
        }
      );

      console.log("\n✅ Execute transaction sent!");
      console.log(`   Hash: ${hash}`);
      console.log("\nWaiting for confirmation...");

      if (!hash) throw new Error("Transaction hash is undefined.");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120_000,
      });

      if (receipt.status === "success") {
        console.log("✅ Proposal executed successfully!");
        console.log("   Block:", receipt.blockNumber.toString());
      } else {
        console.error("❌ Execution FAILED (transaction reverted).");
      }
      break;
    } catch (error: any) {
      console.error(`\nExecution attempt failed:`, error.message);

      // Simple Retry Logic for Rate Limits
      if (error.message.includes("429")) {
        retries--;
        const delay = 3000 * (3 - retries);
        console.log(`   Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        process.exit(1);
      }
    }
  }
}

main().catch((e) => {
  console.error("Script failed:", e.message);
  process.exit(1);
});
