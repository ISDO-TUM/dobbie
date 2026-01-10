import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { parseAbiItem } from "viem";

async function main() {
  // -------------------------------------------------------------------------
  // 1. SETUP
  // -------------------------------------------------------------------------
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  console.log(`Connected to chain ID: ${chainId} (Sepolia)`);

  // --- CONFIGURATION ---
  const GOVERNOR_ADDRESS = "0x6BeA9E1C383f7A173569295fd6F4c7C3d8c90e6B";
  const REGISTRY_ADDRESS = "0xd3CEba6861B269E1b0924c1BB9d5495b8a302836";
  const START_BLOCK = 9816231n;

  // CONSTANT LIMIT: 9 Blocks
  const CHUNK_SIZE = 9n;

  const FINAL_BLOCK = await publicClient.getBlockNumber();
  console.log(
    `\n📸 Snapshotting data from block ${START_BLOCK} to ${FINAL_BLOCK}`
  );

  const OUT_DIR = path.join(process.cwd(), "../data/process_mining");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const GOV_CSV_PATH = path.join(OUT_DIR, "governance_log.csv");
  const IDENTITY_CSV_PATH = path.join(OUT_DIR, "identity_log.csv");

  // -------------------------------------------------------------------------
  // 2. DEFINE ABI
  // -------------------------------------------------------------------------
  const govEventsAbi = [
    parseAbiItem(
      "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
    ),
    parseAbiItem(
      "event ProposalPackageCreated(uint256 indexed proposalId, bytes32 indexed projectId, string ipfsCID, address targetAddress)"
    ),
    parseAbiItem(
      "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"
    ),
    parseAbiItem("event ProposalQueued(uint256 proposalId, uint256 eta)"),
    parseAbiItem("event ProposalExecuted(uint256 proposalId)"),
    parseAbiItem("event ProposalCanceled(uint256 proposalId)"),
  ];

  const registryEventsAbi = [
    parseAbiItem(
      "event DeterministicUpgradeExecuted(bytes32 indexed projectId, address indexed newImplementation, bytes32 salt)"
    ),
  ];

  const identityEventsAbi = [
    parseAbiItem("event StakeholderAdded(address indexed account)"),
    parseAbiItem("event StakeholderRemoved(address indexed account)"),
    parseAbiItem(
      "event IdentitySet(address indexed account, string key, string value)"
    ),
  ];

  // -------------------------------------------------------------------------
  // 3. CONSTANT PAGINATION HELPER
  // -------------------------------------------------------------------------
  async function fetchLogsInChunks(
    address: `0x${string}`,
    events: any[],
    fromBlock: bigint,
    toBlock: bigint
  ) {
    let logs: any[] = [];
    let cursor = fromBlock;

    console.log(
      `   > Scanning blocks ${fromBlock} to ${toBlock} in chunks of ${CHUNK_SIZE}...`
    );

    while (cursor <= toBlock) {
      const end = cursor + CHUNK_SIZE > toBlock ? toBlock : cursor + CHUNK_SIZE;

      let success = false;
      let retries = 3; // Simple retry logic

      while (!success && retries > 0) {
        try {
          // Tiny delay to avoid rate limit (requests/sec)
          await new Promise((r) => setTimeout(r, 100));

          const chunkLogs = await publicClient.getLogs({
            address: address,
            events: events,
            fromBlock: cursor,
            toBlock: end,
          });
          logs = [...logs, ...chunkLogs];
          success = true;
        } catch (_e: any) {
          retries--;
          console.error(`     ⚠️ Error chunk ${cursor}-${end}. Retrying...`);
          await new Promise((r) => setTimeout(r, 2000)); // Wait 2s before retry
        }
      }

      if (!success) console.error(`❌ SKIPPED chunk ${cursor}-${end}`);

      cursor = end + 1n;

      if (Number(cursor - fromBlock) % (Number(CHUNK_SIZE) * 5) === 0)
        process.stdout.write(".");
    }
    console.log(`\n   > Done. Found ${logs.length} events.`);
    return logs;
  }

  // -------------------------------------------------------------------------
  // 4. FETCH EVENTS
  // -------------------------------------------------------------------------
  console.log("\n1. Fetching Governance Events...");
  const govLogs = await fetchLogsInChunks(
    GOVERNOR_ADDRESS as `0x${string}`,
    govEventsAbi,
    START_BLOCK,
    FINAL_BLOCK
  );

  console.log("\n2. Fetching Registry Events...");
  const registryLogs = await fetchLogsInChunks(
    REGISTRY_ADDRESS as `0x${string}`,
    registryEventsAbi,
    START_BLOCK,
    FINAL_BLOCK
  );

  console.log("\n3. Fetching Identity Events...");
  const identityLogs = await fetchLogsInChunks(
    GOVERNOR_ADDRESS as `0x${string}`,
    identityEventsAbi,
    START_BLOCK,
    FINAL_BLOCK
  );

  // -------------------------------------------------------------------------
  // 5. PROCESS & SAVE
  // -------------------------------------------------------------------------
  console.log("\nProcessing logs...");

  const govRows = [
    "case:concept:name,concept:name,time:timestamp,org:resource,transaction_hash,extra_data",
  ];

  const processLog = async (log: any, isRegistry = false) => {
    // Retry logic for block timestamp
    let block;
    try {
      block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    }

    const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    const activity = log.eventName;
    let caseId = "";
    let resource = "";
    let extraData = "";

    if (isRegistry) {
      caseId = "SYSTEM_UPGRADE";
      extraData = `Impl: ${log.args.newImplementation}`;
    } else {
      if (log.args.proposalId) {
        caseId = log.args.proposalId.toString();
      }

      if (activity === "VoteCast") resource = log.args.voter;
      if (activity === "ProposalCreated") resource = log.args.proposer;
      if (activity === "ProposalPackageCreated") resource = "System";

      if (activity === "ProposalPackageCreated") {
        extraData = `CID: ${log.args.ipfsCID}`;
      } else if (activity === "ProposalCreated") {
        extraData = `Desc: ${log.args.description}`;
      } else if (activity === "VoteCast") {
        extraData = `Support: ${log.args.support}`;
      }
    }
    govRows.push(
      `${caseId},${activity},${timestamp},${resource},${log.transactionHash},"${extraData}"`
    );
  };

  for (const log of govLogs) await processLog(log, false);
  for (const log of registryLogs) await processLog(log, true);

  fs.writeFileSync(GOV_CSV_PATH, govRows.join("\n"));
  console.log(`✅ Saved Governance Log to ${GOV_CSV_PATH}`);

  const identityRows = [
    "case:concept:name,concept:name,time:timestamp,org:resource",
  ];

  for (const log of identityLogs) {
    let block;
    try {
      block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    }
    const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    const caseId = log.args.account;
    const activity = log.eventName;
    identityRows.push(`${caseId},${activity},${timestamp},${caseId}`);
  }

  fs.writeFileSync(IDENTITY_CSV_PATH, identityRows.join("\n"));
  console.log(`✅ Saved Identity Log to ${IDENTITY_CSV_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
