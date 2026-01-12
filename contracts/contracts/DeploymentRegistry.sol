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
 * @notice Manages project creation and batch deployments with versioning via Beacon pattern.
 * @dev This contract serves as:
 *   1. Project Factory - Creates new projects with Beacon + Proxy
 *   2. Deterministic Deployer - Deploys contracts via CREATE2
 *   3. Version Ledger - Tracks all deployed versions via VersionManifest
 */
contract DeploymentRegistry is AccessControl {
    IDevOpsGovernor public immutable governor;

    bytes32 public constant PROJECT_CREATOR_ROLE = keccak256("PROJECT_CREATOR_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // Project tracking
    mapping(bytes32 => address) public projectProxies;
    mapping(bytes32 => string) public projectNames;
    mapping(bytes32 => address) public projectBeacons;

    // Version history: projectId => VersionManifest addresses
    mapping(bytes32 => address[]) public versionHistory;

    // --- Structs ---

    /**
     * @notice Specification for a single contract to deploy via CREATE2.
     * @param name Human-readable contract name (e.g., "Counter", "Treasury")
     * @param salt Unique salt for CREATE2 (typically derived from IPFS CID + contract name)
     * @param bytecode Contract bytecode including encoded constructor arguments
     * @param expectedAddress Pre-computed CREATE2 address (verified on deployment)
     */
    struct ContractSpec {
        string name;
        bytes32 salt;
        bytes bytecode;
        address expectedAddress;
    }

    // --- Events ---

    event ProjectRegistered(
        bytes32 indexed projectId,
        string projectName,
        address indexed proxyAddress,
        address indexed beaconAddress
    );

    event ContractDeployed(
        bytes32 indexed projectId,
        string contractName,
        address indexed contractAddress,
        bytes32 salt
    );

    event VersionDeployed(
        bytes32 indexed projectId,
        address indexed manifestAddress,
        string versionTag,
        uint256 contractCount
    );

    event BeaconUpgraded(
        bytes32 indexed projectId,
        address indexed oldImplementation,
        address indexed newImplementation
    );

    // --- Constructor ---

    constructor(address _governorAddress, address _initialAdmin) {
        require(_governorAddress != address(0), "Registry: Invalid governor");
        require(_initialAdmin != address(0), "Registry: Invalid admin");

        governor = IDevOpsGovernor(_governorAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(PROJECT_CREATOR_ROLE, _initialAdmin);
    }

    // --- Project Management ---

    /**
     * @notice Registers a new project with a Beacon and Proxy.
     * @dev Creates an UpgradeableBeacon pointing to InitialImplementation,
     *      and a BeaconProxy that delegates to the Beacon.
     * @param projectName Human-readable project name (used to derive projectId)
     */
    function registerNewProject(
        string memory projectName
    ) external onlyRole(PROJECT_CREATOR_ROLE) {
        bytes32 projectId = keccak256(bytes(projectName));
        require(
            projectProxies[projectId] == address(0),
            "Registry: Project already exists"
        );

        // Deploy initial placeholder implementation
        InitialImplementation initialImpl = new InitialImplementation();

        // Deploy Beacon owned by this registry
        UpgradeableBeacon beacon = new UpgradeableBeacon(
            address(initialImpl),
            address(this)
        );

        // Deploy Proxy pointing to Beacon
        BeaconProxy proxy = new BeaconProxy(address(beacon), "");

        // Store project data
        projectProxies[projectId] = address(proxy);
        projectBeacons[projectId] = address(beacon);
        projectNames[projectId] = projectName;

        emit ProjectRegistered(
            projectId,
            projectName,
            address(proxy),
            address(beacon)
        );
    }

    // --- Batch Deployment ---

    /**
     * @notice ATOMIC BATCH DEPLOYMENT + VERSION MANIFEST + BEACON UPGRADE
     * @dev Deploys all application contracts via CREATE2, then deploys the
     *      VersionManifest, and finally upgrades the Beacon to point to the manifest.
     *      This is the primary function called by governance proposals.
     *
     * @param projectId The project identifier (keccak256 of project name)
     * @param contracts Array of application contract specifications to deploy
     * @param manifestBytecode The VersionManifest bytecode with constructor args encoded
     * @param manifestSalt Salt for VersionManifest CREATE2 deployment
     * @param expectedManifestAddress Pre-computed VersionManifest address
     * @param versionTag Human-readable version tag (typically IPFS CID)
     */
    function batchDeployAndUpgrade(
        bytes32 projectId,
        ContractSpec[] calldata contracts,
        bytes calldata manifestBytecode,
        bytes32 manifestSalt,
        address expectedManifestAddress,
        string calldata versionTag
    ) external onlyRole(EXECUTOR_ROLE) {
        require(
            projectBeacons[projectId] != address(0),
            "Registry: Project not found"
        );

        // 1. Deploy all application contracts via CREATE2 (if any)
        for (uint256 i = 0; i < contracts.length; i++) {
            _deploySingle(projectId, contracts[i]);
        }

        // 2. Deploy VersionManifest via CREATE2
        address manifest = Create2.deploy(0, manifestSalt, manifestBytecode);
        require(manifest != address(0), "Registry: Manifest deploy failed");
        require(
            manifest == expectedManifestAddress,
            "Registry: Manifest address mismatch - security violation"
        );

        // 3. Upgrade Beacon to point to new manifest
        address beaconAddress = projectBeacons[projectId];
        address oldImplementation = IUpgradeableBeacon(beaconAddress).implementation();
        IUpgradeableBeacon(beaconAddress).upgradeTo(manifest);

        // 4. Track version history
        versionHistory[projectId].push(manifest);

        emit BeaconUpgraded(projectId, oldImplementation, manifest);
        emit VersionDeployed(projectId, manifest, versionTag, contracts.length);
    }

    // --- View Functions ---

    /**
     * @notice Get the current implementation (VersionManifest) for a project.
     * @param projectId The project identifier
     * @return The address of the current VersionManifest
     */
    function getCurrentVersion(bytes32 projectId) external view returns (address) {
        address beaconAddress = projectBeacons[projectId];
        require(beaconAddress != address(0), "Registry: Project not found");
        return IUpgradeableBeacon(beaconAddress).implementation();
    }

    /**
     * @notice Get all version manifests for a project.
     * @param projectId The project identifier
     * @return Array of VersionManifest addresses in deployment order
     */
    function getVersionHistory(bytes32 projectId) external view returns (address[] memory) {
        return versionHistory[projectId];
    }

    /**
     * @notice Get the total number of versions for a project.
     * @param projectId The project identifier
     * @return The number of versions deployed
     */
    function getVersionCount(bytes32 projectId) external view returns (uint256) {
        return versionHistory[projectId].length;
    }

    /**
     * @notice Get a specific version by index.
     * @param projectId The project identifier
     * @param index The version index (0 = first version)
     * @return The VersionManifest address at that index
     */
    function getVersionAt(
        bytes32 projectId,
        uint256 index
    ) external view returns (address) {
        require(index < versionHistory[projectId].length, "Registry: Index out of bounds");
        return versionHistory[projectId][index];
    }

    /**
     * @notice Check if a project exists.
     * @param projectId The project identifier
     * @return True if the project is registered
     */
    function projectExists(bytes32 projectId) external view returns (bool) {
        return projectProxies[projectId] != address(0);
    }

    /**
     * @notice Compute the projectId from a project name.
     * @param projectName The human-readable project name
     * @return The projectId (keccak256 hash)
     */
    function computeProjectId(string memory projectName) external pure returns (bytes32) {
        return keccak256(bytes(projectName));
    }

    // --- Internal Functions ---

    /**
     * @notice Internal function to deploy a single contract via CREATE2.
     * @param projectId The project identifier (for event emission)
     * @param spec The contract specification
     * @return deployed The address of the deployed contract
     */
    function _deploySingle(
        bytes32 projectId,
        ContractSpec calldata spec
    ) internal returns (address deployed) {
        // Deploy via CREATE2
        deployed = Create2.deploy(0, spec.salt, spec.bytecode);

        // Verify deployment succeeded
        require(deployed != address(0), "Registry: Create2 deploy failed");

        // Security check: verify address matches expected
        require(
            deployed == spec.expectedAddress,
            "Registry: Address mismatch - security violation"
        );

        emit ContractDeployed(projectId, spec.name, deployed, spec.salt);
    }

    // --- Access Control ---

    /**
     * @notice Grant executor role to the Timelock contract.
     * @dev Should be called after Timelock is deployed.
     * @param timelockAddress The Timelock contract address
     */
    function grantExecutorRole(address timelockAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(timelockAddress != address(0), "Registry: Invalid timelock");
        _grantRole(EXECUTOR_ROLE, timelockAddress);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}