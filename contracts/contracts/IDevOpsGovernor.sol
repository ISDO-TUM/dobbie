// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IDevOpsGovernor
 * @notice Interface for interacting with the DevOpsGovernor contract.
 * @dev Provides view functions to check roles, counts, and configuration values
 * required by other contracts like the DeploymentRegistry.
 */
interface IDevOpsGovernor {
    /**
     * @notice Checks if an account has a specific role.
     * @param role The bytes32 identifier of the role.
     * @param account The address of the account to check.
     * @return bool True if the account has the role, false otherwise.
     */
    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);

    /**
     * @notice Returns the total number of stakeholders.
     * @return uint256 The count of addresses with the STAKEHOLDER_ROLE.
     */
    function stakeholderCount() external view returns (uint256);

    /**
     * @notice Returns the bytes32 identifier for the STAKEHOLDER_ROLE.
     * @return bytes32 The role identifier.
     */
    function STAKEHOLDER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the bytes32 identifier for the PROPOSER_ROLE.
     * @return bytes32 The role identifier.
     */
    function PROPOSER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the address of the associated TimelockController.
     * @return address The address of the timelock contract.
     */
    function timelock() external view returns (address);
}
