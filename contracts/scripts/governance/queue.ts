import "dotenv/config";
import {
  keccak256,
  toHex,
  createPublicClient,
  http,
  createWalletClient,
  parseAbi,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  getContractInstance,
  parseArgs,
  getPrivateKey,
} from "../utils/index.js"; // Correct consolidated import

const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS as `0x${string}`;
const DEPLOYMENT_BLOCK = 9508520n;
const CHUNK_SIZE = 10n;

async function main() {
  const args = parseArgs({
    "--proposer": String,
    "--proposal-id": String,
  });

  const privateKey = getPrivateKey(args["--proposer"]);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    walletClient
  );

  const proposalId = BigInt(args["--proposal-id"]);

  console.log(`Queueing proposal ID: ${proposalId}`);
  console.log(`As: ${account.address}`);
  console.log(`Governor: ${GOVERNOR_ADDRESS}\n`);

  const currentBlock = await publicClient.getBlockNumber();

  const proposalCreatedAbi = parseAbi([
    "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
  ]);

  console.log(
    `Searching from block ${DEPLOYMENT_BLOCK} to ${currentBlock} in 10-block chunks...`
  );

  let allProposals: any[] = [];

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

    const logs = await publicClient.getLogs({
      address: GOVERNOR_ADDRESS,
      event: proposalCreatedAbi[0],
      fromBlock,
      toBlock,
    });

    allProposals = allProposals.concat(logs);

    const found = logs.find((log) => log.args.proposalId === proposalId);
    if (found) {
      console.log(`\n  ✅ Found at block ${found.blockNumber}!`);
      break;
    }
  }

  console.log(
    `\n\nFound ${allProposals.length} total proposals in scan range\n`
  );

  const proposalEvent = allProposals.find(
    (log) => log.args.proposalId === proposalId
  );

  if (!proposalEvent) {
    throw new Error(`\n❌ Proposal ${proposalId} not found.`);
  }

  const { targets, values, calldatas, description } = proposalEvent.args;

  if (!targets || !values || !calldatas || !description) {
    throw new Error("Proposal data is incomplete");
  }

  const descriptionHash = keccak256(toHex(description));

  console.log("\n✅ Proposal found!");
  console.log("  Description:", description);

  console.log("\nSending queue transaction...");

  // Now valid because governor is the contract instance, not a Promise
  const hash = await governor.write.queue(
    [targets, values, calldatas, descriptionHash],
    { account, chain: sepolia }
  );

  console.log("\n✅ Queue transaction sent!");
  console.log(`   Hash: ${hash}`);
  console.log("\nWaiting for confirmation...");

  await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Proposal queued successfully!");
}

main().catch(console.error);
