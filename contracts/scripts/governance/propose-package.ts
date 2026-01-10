import {
  parseArgs,
  getPrivateKey,
  createClients,
  getContractInstance,
  getEnvAddress,
} from "../utils/index.js";
import { keccak256, decodeEventLog, parseAbi, toBytes } from "viem";

const GOVERNOR_ADDRESS = getEnvAddress("GOVERNOR_ADDRESS");

const proposalCreatedAbi = parseAbi([
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
]);

async function main() {
  const args = parseArgs({
    "--proposer": String,
    "--project-name": String,
    "--description": String,
    "--cid": String,
    // Add target/calldata args if you want full flexibility,
    // or hardcode them here if this script is SPECIFIC to app registry upgrades
  });

  const { publicClient, walletClient, account } = createClients(
    getPrivateKey(args["--proposer"])
  );
  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    walletClient!
  );

  console.log(`📦 Proposing Package Update: "${args["--project-name"]}"`);
  console.log(`   Proposer: ${account?.address}`);

  const projectId = keccak256(toBytes(args["--project-name"]));

  // NOTE: In a real scenario, you'd calculate the 'calldatas' for the Registry Upgrade here.
  // For this generic script, we'll assume it's passed or empty for now to match your previous pattern.
  // Ideally, this script accepts --target and --calldata arguments too.
  const targets = [GOVERNOR_ADDRESS];
  const values = [0n];
  const calldatas = ["0x"];

  const hash = await governor.write.proposePackage(
    [
      targets,
      values,
      calldatas,
      args["--description"],
      projectId,
      args["--cid"],
      "0x0000000000000000000000000000000000000000", // Target address (e.g. implementation)
    ],
    { account }
  );

  console.log("✅ Transaction sent:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse logs to find Proposal ID
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
