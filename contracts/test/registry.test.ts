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
import versionManifestV1Artifact from "../artifacts/contracts/test/VersionManifestV1.sol/VersionManifestV1.json" with { type: "json" };

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

    // 2. Prepare Atomic Upgrade (Deploy AppRegistryV1 manifest with ProductV1)
    const creationCode = versionManifestV1Artifact.bytecode as `0x${string}`;

    // Constructor args: (bytes32 projectId, string versionTag, string[] names, address[] addresses)
    const contractNames = ["DummyProductV1"];
    const contractAddresses = [productV1.address];

    const constructorArgs = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "string" },
        { type: "string[]" },
        { type: "address[]" },
      ],
      [projectId, "v1.0.0", contractNames, contractAddresses]
    );
    const manifestBytecode =
      `${creationCode}${constructorArgs.substring(2)}` as `0x${string}`;

    const manifestSalt = keccak256(toHex("Version1.0.0"));
    const versionTag = "v1.0.0";

    // Predict Manifest Address
    const expectedManifestAddress = getContractAddress({
      bytecode: manifestBytecode,
      from: registry.address,
      opcode: "CREATE2",
      salt: manifestSalt,
    });

    // No application contracts in this simple example, just the manifest
    const contracts: any[] = [];

    // 3. Propose via Governance
    // Function: batchDeployAndUpgrade(projectId, contracts[], manifestBytecode, manifestSalt, expectedManifestAddress, versionTag)
    const upgradeCallData = encodeFunctionData({
      abi: registryArtifact.abi,
      functionName: "batchDeployAndUpgrade",
      args: [
        projectId,
        contracts,
        manifestBytecode,
        manifestSalt,
        expectedManifestAddress,
        versionTag,
      ],
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
        expectedManifestAddress,
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

    // 5. Verify the upgrade was successful
    // Get the current implementation address from the registry
    const currentVersion = await registry.read.getCurrentVersion([projectId]);
    expect(currentVersion).to.equal(expectedManifestAddress);

    // Read directly from the manifest implementation (not through proxy)
    const manifest = await viem.getContractAt(
      "VersionManifestV1",
      currentVersion
    );

    // The manifest should have the correct data
    expect(await manifest.read.VERSION()).to.equal("1.0.0");
    expect(await manifest.read.versionTag()).to.equal("v1.0.0");
    expect(await manifest.read.projectId()).to.equal(projectId);

    // Check that DummyProductV1 is registered in the manifest
    const productAddr = await manifest.read.getContract(["DummyProductV1"]);
    expect(productAddr).to.equal(getAddress(productV1.address));
  });
});
