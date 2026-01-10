import {
  parseArgs,
  getPrivateKey,
  createClients,
  getContractInstance,
  getEnvAddress,
} from "../utils/index.js";

const GOVERNOR_ADDRESS = getEnvAddress("GOVERNOR_ADDRESS");

async function main() {
  const args = parseArgs({
    "--voter": String,
    "--proposal-id": String,
    "--support": String, // 0=Against, 1=For, 2=Abstain
  });

  const { publicClient, walletClient, account } = createClients(
    getPrivateKey(args["--voter"])
  );
  const governor = await getContractInstance(
    GOVERNOR_ADDRESS,
    "DevOpsGovernor",
    walletClient!
  );

  const proposalId = BigInt(args["--proposal-id"]);
  const support = Number(args["--support"]);

  console.log(`🗳️  Casting Vote...`);
  console.log(`   Voter: ${account?.address}`);
  console.log(`   Proposal: ${proposalId}`);
  console.log(`   Support: ${support} (0=No, 1=Yes, 2=Abstain)`);

  const hash = await governor.write.castVote([proposalId, support], {
    account,
  });

  console.log("✅ Tx sent:", hash);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Vote Confirmed");
}

main().catch(console.error);
