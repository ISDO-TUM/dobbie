import {
  parseArgs,
  getPrivateKey,
  createClients,
  getContractInstance,
  getEnvAddress,
} from "../utils/index.js";
import { decodeEventLog, parseAbi } from "viem";

const GOVERNOR_ADDRESS = getEnvAddress("GOVERNOR_ADDRESS");

const proposalCreatedAbi = parseAbi([
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
]);

async function main() {
  const args = parseArgs({
    "--proposer": String,
    "--target": String, // Contract to call (e.g., Timelock, Governor)
    "--signature": String, // Function signature (e.g., "setVotingDelay(uint256)")
    "--calldata": String, // Encoded args
    "--description": String,
  });

  const { publicClient, walletClient, account } = createClients(
    getPrivateKey(args["--proposer"])
  );
  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    walletClient!
  );

  console.log(`⚖️  Proposing Governance Action`);
  console.log(`   Target: ${args["--target"]}`);

  // Standard 'propose' (not proposePackage)
  const hash = await governor.write.propose(
    [
      [args["--target"] as `0x${string}`],
      [0n],
      [args["--calldata"] as `0x${string}`], // You'd likely use encodeFunctionData outside or pass hex
      args["--description"],
    ],
    { account }
  );

  console.log("✅ Transaction sent:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: proposalCreatedAbi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "ProposalCreated") {
        console.log(`\n🎉 Proposal Created! ID: ${event.args.proposalId}`);
        return;
      }
    } catch {
      // ignore decoding errors
    }
  }
}

main().catch(console.error);
