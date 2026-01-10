import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { expect } from "chai";
import {
  keccak256,
  toHex,
  encodeFunctionData,
  getContractAddress,
  encodeAbiParameters,
  parseEventLogs,
  getAddress,
} from "viem";

import registryArtifact from "../artifacts/contracts/DeploymentRegistry.sol/DeploymentRegistry.json" with { type: "json" };
import appRegistryV1Artifact from "../artifacts/contracts/test/AppRegistryV1.sol/AppRegistryV1.json" with { type: "json" };

describe("Security & Advanced Features", function () {
  let viem: any, publicClient: any, testClient: any, networkHelpers: any;
  let deployer: any, stakeholder1: any, stakeholder2: any, botUser: any;
  let governor: any, timelock: any, registry: any;
  let productV1: any;

  // Configuration
  const VOTING_DELAY = 0n;
  const VOTING_PERIOD = 10n;
  const TIMELOCK_DELAY = 3600n; // 1 hour delay

  beforeEach(async function () {
    const conn = await network.connect();
    viem = conn.viem;
    networkHelpers = conn.networkHelpers;

    publicClient = await viem.getPublicClient();
    testClient = await viem.getTestClient();
    [deployer, stakeholder1, stakeholder2, botUser] =
      await viem.getWalletClients();

    // 1. Deploy Timelock
    timelock = await viem.deployContract("CustomTimelockController", [
      TIMELOCK_DELAY,
      [],
      [],
      deployer.account.address,
    ]);

    // 2. Deploy Governor
    governor = await viem.deployContract("DevOpsGovernor", [
      "Gov",
      timelock.address,
      [stakeholder1.account.address, stakeholder2.account.address],
      [],
      [],
      VOTING_DELAY,
      VOTING_PERIOD,
    ]);

    // 3. Deploy Registry
    registry = await viem.deployContract("DeploymentRegistry", [
      governor.address,
      deployer.account.address,
    ]);

    // 4. Setup Roles
    const executorRole = await registry.read.EXECUTOR_ROLE();
    await registry.write.grantRole([executorRole, timelock.address]);

    const tlProposer = await timelock.read.PROPOSER_ROLE();
    const tlExecutor = await timelock.read.EXECUTOR_ROLE();
    await timelock.write.grantRole([tlProposer, governor.address]);
    await timelock.write.grantRole([tlExecutor, governor.address]);

    // 5. Deploy Dummy Component
    productV1 = await viem.deployContract("DummyProductV1");
  });

  // --- 🛡️ TEST 1: SECURITY ---
  it("SECURITY: Should REVERT if deployed address does not match expected address", async function () {
    const projectId = keccak256(toHex("SecureApp"));
    await registry.write.registerNewProject(["SecureApp"], {
      account: deployer.account,
    });

    const creationCode = appRegistryV1Artifact.bytecode as `0x${string}`;
    const constructorArgs = encodeAbiParameters(
      [{ type: "address" }],
      [productV1.address]
    );
    const fullBytecode =
      `${creationCode}${constructorArgs.substring(2)}` as `0x${string}`;
    const salt = keccak256(toHex("MaliciousUpdate"));

    const fakeAddress = getAddress(
      "0x000000000000000000000000000000000000dEaD"
    );

    const upgradeCallData = encodeFunctionData({
      abi: registryArtifact.abi,
      functionName: "deployDeterministicAndUpgrade",
      args: [projectId, salt, fullBytecode, fakeAddress],
    });

    const description = "Malicious Upgrade";
    const hash = await governor.write.proposePackage(
      [
        [registry.address],
        [0n],
        [upgradeCallData],
        description,
        projectId,
        "QmMalicious",
        fakeAddress,
      ],
      { account: stakeholder1.account }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const logs = parseEventLogs({
      abi: governor.abi,
      eventName: "ProposalCreated",
      logs: receipt.logs,
    });
    const proposalId = (logs[0] as any).args.proposalId;

    await testClient.mine({ blocks: 1 });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder1.account,
    });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder2.account,
    });
    await testClient.mine({ blocks: Number(VOTING_PERIOD) });

    const descriptionHash = keccak256(toHex(description));
    await governor.write.queue(
      [[registry.address], [0n], [upgradeCallData], descriptionHash],
      { account: stakeholder1.account }
    );

    await networkHelpers.time.increase(Number(TIMELOCK_DELAY) + 1);

    try {
      await governor.write.execute(
        [[registry.address], [0n], [upgradeCallData], descriptionHash],
        { account: stakeholder1.account }
      );
      expect.fail(
        "Security check failed: Malicious deployment should have reverted"
      );
    } catch (error: any) {
      expect(error.message).to.include("Security Violation");
    }
  });

  // --- ⏳ TEST 2: TIMELOCK ---
  it("TIMELOCK: Should prevent execution before minDelay passes", async function () {
    const projectId = keccak256(toHex("TimelockApp"));
    await registry.write.registerNewProject(["TimelockApp"], {
      account: deployer.account,
    });

    const creationCode = appRegistryV1Artifact.bytecode as `0x${string}`;
    const constructorArgs = encodeAbiParameters(
      [{ type: "address" }],
      [productV1.address]
    );
    const fullBytecode =
      `${creationCode}${constructorArgs.substring(2)}` as `0x${string}`;
    const salt = keccak256(toHex("V1.0.0"));
    const expectedAddress = getContractAddress({
      bytecode: fullBytecode,
      from: registry.address,
      opcode: "CREATE2",
      salt: salt,
    });

    const upgradeCallData = encodeFunctionData({
      abi: registryArtifact.abi,
      functionName: "deployDeterministicAndUpgrade",
      args: [projectId, salt, fullBytecode, expectedAddress],
    });

    const description = "Valid Timelock Test";
    const hash = await governor.write.proposePackage(
      [
        [registry.address],
        [0n],
        [upgradeCallData],
        description,
        projectId,
        "QmTime",
        expectedAddress,
      ],
      { account: stakeholder1.account }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const proposalId = (
      parseEventLogs({
        abi: governor.abi,
        eventName: "ProposalCreated",
        logs: receipt.logs,
      })[0] as any
    ).args.proposalId;

    await testClient.mine({ blocks: 1 });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder1.account,
    });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder2.account,
    });
    await testClient.mine({ blocks: Number(VOTING_PERIOD) });

    const descriptionHash = keccak256(toHex(description));
    await governor.write.queue(
      [[registry.address], [0n], [upgradeCallData], descriptionHash],
      { account: stakeholder1.account }
    );

    try {
      await governor.write.execute(
        [[registry.address], [0n], [upgradeCallData], descriptionHash],
        { account: stakeholder1.account }
      );
      expect.fail("Should not execute before timelock");
    } catch (error: any) {
      expect(error.message).to.include("TimelockUnexpectedOperationState");
    }

    await networkHelpers.time.increase(Number(TIMELOCK_DELAY) + 100);

    await governor.write.execute(
      [[registry.address], [0n], [upgradeCallData], descriptionHash],
      { account: stakeholder1.account }
    );
  });

  // --- 🆔 TEST 3: IDENTITY ---
  it("IDENTITY: Should emit IdentitySet event for indexers", async function () {
    const key = "github";
    const value = "kirill-dev";

    const hash = await governor.write.setIdentity([key, value], {
      account: stakeholder1.account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const logs = parseEventLogs({
      abi: governor.abi,
      eventName: "IdentitySet",
      logs: receipt.logs,
    });

    const args: any = (logs[0] as any).args;
    expect(args.account.toLowerCase()).to.equal(
      stakeholder1.account.address.toLowerCase()
    );
    expect(args.key).to.equal(key);
    expect(args.value).to.equal(value);
  });

  // --- 🤖 TEST 4: BOTS ---
  it("BOTS: Should allow a bot to propose but NOT vote", async function () {
    // FIX: Deploy a FRESH Governor where the Bot is ALREADY a proposer.
    // This avoids the complex Timelock/Governance scheduling needed to add a bot dynamically.
    const botGov = await viem.deployContract("DevOpsGovernor", [
      "BotGov",
      timelock.address,
      [stakeholder1.account.address],
      [botUser.account.address], // <--- Bot added here in constructor
      [],
      VOTING_DELAY,
      VOTING_PERIOD,
    ]);

    // Give this new Governor the PROPOSER role on the Timelock (needed to propose)
    const PROPOSER_ROLE = await timelock.read.PROPOSER_ROLE();

    // We can't easily grant role to the new Governor on the *existing* Timelock
    // because the deployer isn't the admin anymore (it renounced, or Timelock is self-admin).
    // BUT in our `beforeEach`, we deployed `timelock` with `deployer` as admin.
    await timelock.write.grantRole([PROPOSER_ROLE, botGov.address]);

    // 1. Bot creates proposal (Should Succeed)
    // Note: We use `zeroAddress` for target address in the proposal args as a dummy
    const projectId = keccak256(toHex("BotProject"));
    const hash = await botGov.write.proposePackage(
      [
        [timelock.address],
        [0n],
        ["0x"],
        "Bot Proposal",
        projectId,
        "QmBot",
        "0x0000000000000000000000000000000000000000",
      ],
      { account: botUser.account }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).to.equal("success");

    // 2. Bot tries to Vote (Should Have 0 Weight)
    // The Bot was added as a Proposer, but NOT as a Stakeholder.
    const weight = await botGov.read.getVotes([botUser.account.address, 0n]);
    expect(weight).to.equal(0n);
  });
});
