import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// TIMELOCK ROLES (Standard OpenZeppelin definitions)
const PROPOSER_ROLE =
  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1";
const EXECUTOR_ROLE =
  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";
const TIMELOCK_ADMIN_ROLE =
  "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5";
const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

// REGISTRY ROLES
const REGISTRY_EXECUTOR_ROLE =
  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";
const REGISTRY_PROJECT_CREATOR_ROLE =
  "0x89c6d3767c2957975f822238382c5f7893a73c932f4625b15749f1370233933c";

const GovernanceModule = buildModule("GovernanceModule", (m) => {
  // --- 1. CONFIGURATION PARAMETERS ---
  const govName = m.getParameter("govName", "Dobby DevOps Governor");

  // Voting Settings
  const votingDelay = m.getParameter("votingDelay", 0); // 0 blocks for dev
  const votingPeriod = m.getParameter("votingPeriod", 5); // 5 blocks for dev
  const timelockMinDelay = m.getParameter("timelockMinDelay", 0); // 0 for dev

  // Stakeholders (Default to the deployer for testing if not provided)
  const deployer = m.getAccount(0);
  const initialStakeholders = m.getParameter<string[]>("initialStakeholders", [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat Account #0
  ]);

  // Bots
  const proposerBots = m.getParameter("proposerBots", []);
  const executorBots = m.getParameter("executorBots", []);

  // --- 2. DEPLOY TIMELOCK ---
  const timelock = m.contract("CustomTimelockController", [
    timelockMinDelay,
    [], // Proposers (Empty initially, we add Governor later)
    [], // Executors (Empty initially, we add Governor later)
    deployer, // Admin (We keep this temporarily to setup roles)
  ]);

  // --- 3. DEPLOY GOVERNOR ---
  const governor = m.contract("DevOpsGovernor", [
    govName,
    timelock,
    initialStakeholders,
    proposerBots,
    executorBots,
    votingDelay,
    votingPeriod,
  ]);

  // --- 4. DEPLOY REGISTRY ---
  const registry = m.contract("DeploymentRegistry", [governor, deployer]);

  // --- 5. SETUP ROLES (Wiring the System) ---

  // A. TIMELOCK SETUP
  // The Governor needs to be the ONLY Proposer on the Timelock.
  m.call(timelock, "grantRole", [PROPOSER_ROLE, governor], {
    id: "grantGovProposer",
  });

  // Open execution to everyone (including bots)
  m.call(
    timelock,
    "grantRole",
    [EXECUTOR_ROLE, "0x0000000000000000000000000000000000000000"],
    { id: "grantTimelockExecutorOpen" }
  );

  // B. REGISTRY SETUP
  // The Registry executes upgrades. ONLY the Timelock should have the power to do this.
  m.call(registry, "grantRole", [REGISTRY_EXECUTOR_ROLE, timelock], {
    id: "grantTimelockRegistryExecutor",
  });

  // Timelock should also be able to create new projects
  m.call(registry, "grantRole", [REGISTRY_PROJECT_CREATOR_ROLE, timelock], {
    id: "grantTimelockProjectCreator",
  });

  // C. RENOUNCE ADMIN (Sovereignty)

  // 1. Transfer Registry Admin to Timelock
  const grantRegAdmin = m.call(
    registry,
    "grantRole",
    [DEFAULT_ADMIN_ROLE, timelock],
    { id: "grantTimelockRegistryAdmin" }
  );
  m.call(registry, "renounceRole", [DEFAULT_ADMIN_ROLE, deployer], {
    id: "renounceDeployerRegistryAdmin",
    after: [grantRegAdmin],
  });

  // 2. Transfer Timelock Admin to Timelock itself
  const grantTLAdmin = m.call(
    timelock,
    "grantRole",
    [TIMELOCK_ADMIN_ROLE, timelock],
    { id: "grantTimelockAdminToSelf" }
  );
  m.call(timelock, "renounceRole", [TIMELOCK_ADMIN_ROLE, deployer], {
    id: "renounceDeployerTimelockAdmin",
    after: [grantTLAdmin],
  });

  // 3. Revoke other deployer roles on Timelock
  m.call(timelock, "renounceRole", [PROPOSER_ROLE, deployer], {
    id: "renounceDeployerTimelockProposer",
  });
  m.call(timelock, "renounceRole", [EXECUTOR_ROLE, deployer], {
    id: "renounceDeployerTimelockExecutor",
  });

  // 4. Governor Admin
  const grantGovAdmin = m.call(
    governor,
    "grantRole",
    [DEFAULT_ADMIN_ROLE, timelock],
    { id: "grantTimelockGovernorAdmin" }
  );
  m.call(governor, "renounceRole", [DEFAULT_ADMIN_ROLE, deployer], {
    id: "renounceDeployerGovernorAdmin",
    after: [grantGovAdmin],
  });

  return { governor, timelock, registry };
});

export default GovernanceModule;
