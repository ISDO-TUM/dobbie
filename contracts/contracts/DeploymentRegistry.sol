// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IDevOpsGovernor.sol";
import "./IUpgradeableBeacon.sol";
import "./InitialImplementation.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @title DeploymentRegistry (Factory & Ledger)
 * @notice Manages project creation and serves as the deterministic factory for upgrades.
 * It executes the "Deploy and Upgrade" action atomically when triggered by the Governor.
 */
contract DeploymentRegistry is AccessControl {
    IDevOpsGovernor public immutable governor;

    // PROJECT_CREATOR_ROLE: Can create new project proxies (usually Timelock)
    bytes32 public constant PROJECT_CREATOR_ROLE =
        keccak256("PROJECT_CREATOR_ROLE");
    // EXECUTOR_ROLE: Can trigger deterministic deployments (MUST be the Timelock)
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    mapping(bytes32 => address) public projectProxies;
    mapping(bytes32 => string) public projectNames;
    mapping(bytes32 => address) public projectBeacons;

    event ProjectRegistered(
        bytes32 indexed projectId,
        string projectName,
        address indexed proxyAddress
    );

    event DeterministicUpgradeExecuted(
        bytes32 indexed projectId,
        address indexed newImplementation,
        bytes32 salt
    );

    constructor(address _governorAddress, address _initialAdmin) {
        governor = IDevOpsGovernor(_governorAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(PROJECT_CREATOR_ROLE, _initialAdmin);
        // We will grant EXECUTOR_ROLE to the Timelock via the bootstrap script
    }

    /**
     * @notice Registers a new project with a Beacon and Proxy.
     */
    function registerNewProject(
        string memory projectName
    ) external onlyRole(PROJECT_CREATOR_ROLE) {
        bytes32 projectId = keccak256(bytes(projectName));
        require(
            projectProxies[projectId] == address(0),
            "Registry: Project already exists"
        );

        InitialImplementation initialImpl = new InitialImplementation();

        // Registry is the owner of the Beacon, so it can upgrade it later
        UpgradeableBeacon beacon = new UpgradeableBeacon(
            address(initialImpl),
            address(this)
        );

        BeaconProxy proxy = new BeaconProxy(address(beacon), "");

        projectProxies[projectId] = address(proxy);
        projectBeacons[projectId] = address(beacon);
        projectNames[projectId] = projectName;

        emit ProjectRegistered(projectId, projectName, address(proxy));
    }

    /**
     * @notice ATOMIC ACTION: Deploys via CREATE2 and Upgrades the Beacon.
     * @dev Only callable by the Timelock (via Governance Vote).
     * @param projectId The project to upgrade.
     * @param salt The salt for deterministic address generation.
     * @param bytecode The contract bytecode to deploy.
     */
    function deployDeterministicAndUpgrade(
        bytes32 projectId,
        bytes32 salt,
        bytes memory bytecode,
        address expectedAddress
    ) external onlyRole(EXECUTOR_ROLE) {
        require(
            projectBeacons[projectId] != address(0),
            "Registry: Project not found"
        );

        // 1. Deterministic Deployment using CREATE2
        // This will revert if the address already exists or deployment fails.
        // It acts as the "Verification" that the bytecode matches the salt/address vote.
        address newImplementation = Create2.deploy(0, salt, bytecode);
        require(newImplementation != address(0), "Registry: Create2 failed");

        // 2. SECURITY CHECK: The "Anti-Bait-and-Switch" Fix
        // This ensures the executed bytecode matches the address voters approved.
        require(
            newImplementation == expectedAddress,
            "Registry: Security Violation! Generated address differs from expected."
        );

        // 3. Upgrade the Beacon
        // Since Registry owns the beacon, it can perform the upgrade immediately.
        address beaconAddress = projectBeacons[projectId];
        IUpgradeableBeacon(beaconAddress).upgradeTo(newImplementation);

        emit DeterministicUpgradeExecuted(projectId, newImplementation, salt);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
