// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title GovernanceFactory
 * @notice A minimal factory that deploys pre-compiled contracts using CREATE.
 * @dev Bytecodes are passed as calldata to keep the factory small.
 * This eliminates many MetaMask prompts down to just 1.
 */
contract GovernanceFactory {
    // --- ROLE CONSTANTS ---
    bytes32 private constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 private constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 private constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 private constant PROJECT_CREATOR_ROLE = keccak256("PROJECT_CREATOR_ROLE");
    bytes32 private constant DEFAULT_ADMIN_ROLE = 0x00;

    // --- EVENTS ---
    event Step(uint8 indexed stepNumber, uint8 totalSteps, string message);
    event ContractDeployed(string contractType, address indexed contractAddress);
    event RoleGranted(string contractName, string roleName, address indexed account);
    event RoleRenounced(string contractName, string roleName, address indexed account);
    event DeploymentComplete(
        address indexed timelockAddress,
        address indexed governorAddress,
        address indexed registryAddress
    );

    error DeploymentFailed(string contractType);

    /**
     * @notice Deploys the complete governance system in a single transaction.
     * @param timelockBytecode The creation bytecode for CustomTimelockController
     * @param governorBytecode The creation bytecode for DevOpsGovernor
     * @param registryBytecode The creation bytecode for DeploymentRegistry
     * @param timelockArgs ABI-encoded constructor args for Timelock
     * @param governorArgs ABI-encoded constructor args for Governor
     * @param registryArgs ABI-encoded constructor args for Registry
     */
    function deployGovernanceSystem(
        bytes calldata timelockBytecode,
        bytes calldata governorBytecode,
        bytes calldata registryBytecode,
        bytes calldata timelockArgs,
        bytes calldata governorArgs,
        bytes calldata registryArgs
    ) external returns (address timelockAddr, address governorAddr, address registryAddr) {
        uint8 totalSteps = 8;

        // =========================================================
        // PHASE 1: DEPLOYMENT
        // =========================================================

        // --- Step 1: Deploy Timelock ---
        emit Step(1, totalSteps, "Deploying Timelock Controller...");
        timelockAddr = _deploy(timelockBytecode, timelockArgs);
        if (timelockAddr == address(0)) revert DeploymentFailed("Timelock");
        emit ContractDeployed("Timelock", timelockAddr);

        // --- Step 2: Deploy Governor ---
        emit Step(2, totalSteps, "Deploying DevOps Governor...");
        governorAddr = _deploy(governorBytecode, governorArgs);
        if (governorAddr == address(0)) revert DeploymentFailed("Governor");
        emit ContractDeployed("Governor", governorAddr);

        // --- Step 3: Deploy Registry ---
        emit Step(3, totalSteps, "Deploying Deployment Registry...");
        registryAddr = _deploy(registryBytecode, registryArgs);
        if (registryAddr == address(0)) revert DeploymentFailed("Registry");
        emit ContractDeployed("Registry", registryAddr);

        // =========================================================
        // PHASE 2: WIRING & PERMISSIONS
        // =========================================================

        // --- Step 4: Setup Timelock Roles ---
        emit Step(4, totalSteps, "Setting up Timelock Roles...");
        
        IAccessControl(timelockAddr).grantRole(PROPOSER_ROLE, governorAddr);
        emit RoleGranted("Timelock", "PROPOSER_ROLE", governorAddr);
        
        IAccessControl(timelockAddr).grantRole(EXECUTOR_ROLE, address(0));
        emit RoleGranted("Timelock", "EXECUTOR_ROLE", address(0));

        // --- Step 5: Setup Registry Roles ---
        emit Step(5, totalSteps, "Setting up Registry Roles...");
        
        IAccessControl(registryAddr).grantRole(EXECUTOR_ROLE, timelockAddr);
        emit RoleGranted("Registry", "EXECUTOR_ROLE", timelockAddr);
        
        IAccessControl(registryAddr).grantRole(PROJECT_CREATOR_ROLE, timelockAddr);
        emit RoleGranted("Registry", "PROJECT_CREATOR_ROLE", timelockAddr);

        // =========================================================
        // PHASE 3: TRANSFER OWNERSHIP (SOVEREIGNTY)
        // =========================================================

        // --- Step 6: Transfer Registry Ownership ---
        emit Step(6, totalSteps, "Transferring Registry Ownership...");
        
        IAccessControl(registryAddr).grantRole(DEFAULT_ADMIN_ROLE, timelockAddr);
        emit RoleGranted("Registry", "DEFAULT_ADMIN_ROLE", timelockAddr);
        
        IAccessControl(registryAddr).renounceRole(DEFAULT_ADMIN_ROLE, address(this));
        emit RoleRenounced("Registry", "DEFAULT_ADMIN_ROLE", address(this));

        // --- Step 7: Transfer Timelock Ownership ---
        emit Step(7, totalSteps, "Transferring Timelock Ownership...");
        
        IAccessControl(timelockAddr).grantRole(TIMELOCK_ADMIN_ROLE, timelockAddr);
        emit RoleGranted("Timelock", "TIMELOCK_ADMIN_ROLE", timelockAddr);
        
        IAccessControl(timelockAddr).renounceRole(TIMELOCK_ADMIN_ROLE, address(this));
        emit RoleRenounced("Timelock", "TIMELOCK_ADMIN_ROLE", address(this));

        // --- Step 8: Transfer Governor Ownership ---
        emit Step(8, totalSteps, "Transferring Governor Ownership...");
        
        IAccessControl(governorAddr).grantRole(DEFAULT_ADMIN_ROLE, timelockAddr);
        emit RoleGranted("Governor", "DEFAULT_ADMIN_ROLE", timelockAddr);
        
        IAccessControl(governorAddr).renounceRole(DEFAULT_ADMIN_ROLE, address(this));
        emit RoleRenounced("Governor", "DEFAULT_ADMIN_ROLE", address(this));

        emit DeploymentComplete(timelockAddr, governorAddr, registryAddr);
    }

    /**
     * @dev Deploys a contract using CREATE with bytecode + args
     */
    function _deploy(bytes calldata bytecode, bytes calldata args) internal returns (address addr) {
        bytes memory creationCode = abi.encodePacked(bytecode, args);
        assembly {
            addr := create(0, add(creationCode, 0x20), mload(creationCode))
        }
    }
}
