import "dotenv/config";
import {
  getContractInstance,
  parseArgs,
  getPrivateKey,
  createClients,
} from "../utils/index.js";

const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS as `0x${string}`;
if (!GOVERNOR_ADDRESS) throw new Error("GOVERNOR_ADDRESS is not set in .env");

const PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
];

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0 seconds";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

async function main() {
  const args = parseArgs({
    "--proposer": String,
    "--proposal-id": String,
  });

  if (!args["--proposal-id"]) {
    throw new Error("Missing --proposal-id");
  }

  const { publicClient } = createClients(getPrivateKey(args["--proposer"]));

  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    publicClient
  );

  const proposalId = BigInt(args["--proposal-id"]);
  console.log(`Checking status for Proposal ID: ${proposalId}\n`);

  try {
    // Now valid because 'governor' is the resolved contract instance
    const stateIndex = Number(await governor.read.state([proposalId]));
    const state = PROPOSAL_STATES[stateIndex] || "Unknown";
    console.log(`  State: ${state} (${stateIndex})`);

    const currentBlock = await publicClient.getBlock({ blockTag: "latest" });
    const currentTimestamp = Number(currentBlock.timestamp);
    console.log(
      `  Current Block Time: ${currentTimestamp} (Block: ${currentBlock.number})`
    );

    if (state === "Queued") {
      const etaTimestamp = Number(
        await governor.read.proposalEta([proposalId])
      );
      console.log(`  Executable At Time: ${etaTimestamp}`);

      if (currentTimestamp >= etaTimestamp) {
        console.log("\n  ✅ READY TO EXECUTE!");
      } else {
        const secondsRemaining = etaTimestamp - currentTimestamp;
        console.log(
          `\n  ⏳ NOT READY. Must wait for ${formatTimeRemaining(
            secondsRemaining
          )}.`
        );
      }
    } else if (state === "Succeeded") {
      console.log("\n  ✅ READY TO QUEUE!");
      console.log(
        "  Run the `queue` command (or use UI) to move it to the timelock."
      );
    } else if (state === "Executed") {
      console.log("\n  ✅ Proposal has already been executed.");
    }
  } catch (error) {
    console.error("Failed to check proposal state:", error);
  }
}

main().catch((e) => {
  console.error("Script failed:", e.message);
  process.exit(1);
});
