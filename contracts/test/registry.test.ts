import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { expect } from "chai";
import {
  keccak256,
  toHex,
  encodeFunctionData,
  getContractAddress,
  getAddress,
  encodeAbiParameters,
} from "viem";

import registryArtifact from "../artifacts/contracts/DeploymentRegistry.sol/DeploymentRegistry.json" with { type: "json" };
import appRegistryV1Artifact from "../artifacts/contracts/test/AppRegistryV1.sol/AppRegistryV1.json" with { type: "json" };

describe("DeploymentRegistry & App Registry Pattern", function () {
  let viem: any, _publicClient: any, testClient: any;
  let deployer: any, stakeholder1: any, stakeholder2: any;
  let governor: any, timelock: any, registry: any;
  let productV1: any;

  beforeEach(async function () {
    const conn = await network.connect();
    viem = conn.viem;
    _publicClient = await viem.getPublicClient();
    testClient = await viem.getTestClient();
    [deployer, stakeholder1, stakeholder2] = await viem.getWalletClients();

    // 1. Infrastructure Setup
    timelock = await viem.deployContract("CustomTimelockController", [
      0n,
      [],
      [],
      deployer.account.address,
    ]);
    governor = await viem.deployContract("DevOpsGovernor", [
      "Gov",
      timelock.address,
      [stakeholder1.account.address, stakeholder2.account.address],
      [],
      [],
      0n,
      5n,
    ]);

    // 2. Registry Setup
    registry = await viem.deployContract("DeploymentRegistry", [
      governor.address,
      deployer.account.address,
    ]);

    // 3. Roles
    const executorRole = await registry.read.EXECUTOR_ROLE();
    await registry.write.grantRole([executorRole, timelock.address]);

    const tlProposer = await timelock.read.PROPOSER_ROLE();
    const tlExecutor = await timelock.read.EXECUTOR_ROLE();
    await timelock.write.grantRole([tlProposer, governor.address]);
    await timelock.write.grantRole([tlExecutor, governor.address]);

    // 4. Deploy Dummy Component
    productV1 = await viem.deployContract("DummyProductV1");
    await productV1.write.initialize([100n]);
  });

  it("should create a new project and perform an atomic governance upgrade", async function () {
    const projectId = keccak256(toHex("MyDeFiApp"));

    // 1. Register Project
    await registry.write.registerNewProject(["MyDeFiApp"], {
      account: deployer.account,
    });

    const projectProxyAddr = await registry.read.projectProxies([projectId]);
    expect(projectProxyAddr).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );

    // 2. Prepare Atomic Upgrade (Deploy AppRegistryV1 pointing to ProductV1)
    const creationCode = appRegistryV1Artifact.bytecode as `0x${string}`;
    const constructorArgs = encodeAbiParameters(
      [{ type: "address" }],
      [productV1.address]
    );
    const fullBytecode =
      `${creationCode}${constructorArgs.substring(2)}` as `0x${string}`;

    const salt = keccak256(toHex("Version1.0.0"));

    // Predict Address
    const expectedAddress = getContractAddress({
      bytecode: fullBytecode,
      from: registry.address,
      opcode: "CREATE2",
      salt: salt,
    });

    // 3. Propose via Governance
    // Function: deployDeterministicAndUpgrade(projectId, salt, bytecode, expectedAddress)
    const upgradeCallData = encodeFunctionData({
      abi: registryArtifact.abi,
      functionName: "deployDeterministicAndUpgrade",
      args: [projectId, salt, fullBytecode, expectedAddress],
    });

    const description = "Upgrade to V1";
    await governor.write.proposePackage(
      [
        [registry.address],
        [0n],
        [upgradeCallData],
        description,
        projectId,
        "QmHash",
        expectedAddress,
      ],
      { account: stakeholder1.account }
    );

    const events = await governor.getEvents.ProposalCreated();
    const proposalId = events[0].args.proposalId!;

    // 4. Vote & Execute
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder1.account,
    });
    await governor.write.castVote([proposalId, 1], {
      account: stakeholder2.account,
    });
    await testClient.mine({ blocks: 10 });

    const descriptionHash = keccak256(toHex(description));
    await governor.write.queue(
      [[registry.address], [0n], [upgradeCallData], descriptionHash],
      { account: stakeholder1.account }
    );
    await governor.write.execute(
      [[registry.address], [0n], [upgradeCallData], descriptionHash],
      { account: stakeholder1.account }
    );

    // 5. Verify the Proxy now points to AppRegistryV1
    // We cast the Proxy address to the AppRegistryV1 ABI
    const proxyAsApp = await viem.getContractAt(
      "AppRegistryV1",
      projectProxyAddr
    );

    // The proxy should now allow us to read 'version' and 'product' from the implementation
    expect(await proxyAsApp.read.version()).to.equal("1.0.0");
    expect(await proxyAsApp.read.product()).to.equal(
      getAddress(productV1.address)
    );
  });
});
