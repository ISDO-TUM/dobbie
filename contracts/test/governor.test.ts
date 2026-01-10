import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { expect } from "chai";
import { keccak256, toHex, parseEventLogs } from "viem";

describe("DevOpsGovernor Logic", function () {
  let viem: any;
  let publicClient: any;
  let testClient: any;
  let deployer: any,
    stakeholder1: any,
    stakeholder2: any,
    multiSig: any,
    _bot: any,
    randomUser: any;
  let governor: any, timelock: any;

  beforeEach(async function () {
    const conn = await network.connect();
    viem = conn.viem;
    publicClient = await viem.getPublicClient();
    testClient = await viem.getTestClient();
    [deployer, stakeholder1, stakeholder2, multiSig, _bot, randomUser] =
      await viem.getWalletClients();

    timelock = await viem.deployContract("CustomTimelockController", [
      0n,
      [],
      [],
      deployer.account.address,
    ]);

    governor = await viem.deployContract("DevOpsGovernor", [
      "DevOps Governor",
      timelock.address,
      [stakeholder1.account.address, stakeholder2.account.address],
      [multiSig.account.address],
      [],
      0n,
      10n,
    ]);

    const proposerRole = await timelock.read.PROPOSER_ROLE();
    const executorRole = await timelock.read.EXECUTOR_ROLE();
    await timelock.write.grantRole([proposerRole, governor.address]);
    await timelock.write.grantRole([executorRole, governor.address]);
  });

  it("should allow a stakeholder to propose a package", async function () {
    const projectId = keccak256(toHex("ProjectA"));
    const ipfsCID = "QmTestHash123";

    const hash = await governor.write.proposePackage(
      [
        [timelock.address],
        [0n],
        ["0x"],
        "Test Proposal",
        projectId,
        ipfsCID,
        timelock.address,
      ],
      { account: stakeholder1.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const logs = parseEventLogs({
      abi: governor.abi,
      eventName: "ProposalPackageCreated",
      logs: receipt.logs,
    });

    expect(logs.length).to.equal(1);
    // FIX: Cast to any to access args
    expect((logs[0] as any).args.ipfsCID).to.equal(ipfsCID);
  });

  it("should fail if a non-stakeholder tries to propose", async function () {
    const projectId = keccak256(toHex("ProjectA"));

    try {
      await governor.write.proposePackage(
        [
          [timelock.address],
          [0n],
          ["0x"],
          "Bad Prop",
          projectId,
          "QmBad",
          timelock.address,
        ],
        { account: randomUser.account }
      );
      expect.fail("Transaction should have reverted");
    } catch (error: any) {
      expect(error.message).to.include(
        "Governor: caller is not a proposer or a stakeholder"
      );
    }
  });

  it("should fast-track a proposal when quorum is met", async function () {
    const projectId = keccak256(toHex("ProjectA"));
    const hash = await governor.write.proposePackage(
      [
        [timelock.address],
        [0n],
        ["0x"],
        "Fast Track",
        projectId,
        "QmFast",
        timelock.address,
      ],
      { account: stakeholder1.account }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const logs = parseEventLogs({
      abi: governor.abi,
      eventName: "ProposalCreated",
      logs: receipt.logs,
    });

    // FIX: Cast to any to access args
    const proposalId = (logs[0] as any).args.proposalId;

    await testClient.mine({ blocks: 1 });

    await governor.write.castVote([proposalId, 1], {
      account: stakeholder1.account,
    });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder2.account,
    });

    await testClient.mine({ blocks: 15 });

    expect(await governor.read.state([proposalId])).to.equal(4);
  });
});
