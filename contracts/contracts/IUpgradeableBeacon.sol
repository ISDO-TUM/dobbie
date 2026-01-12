// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IUpgradeableBeacon
 * @notice An interface for the owner-only functions of an UpgradeableBeacon.
 * This simplifies dependencies for contracts that only need to upgrade beacons.
 */
interface IUpgradeableBeacon {
    /**
     * @notice Returns the current implementation address.
     * @return The address of the current implementation contract.
     */
    function implementation() external view returns (address);

    /**
     * @notice Upgrades the beacon to a new implementation.
     * @dev This function can only be called by the beacon's owner.
     * @param newImplementation The address of the new implementation contract.
     */
    function upgradeTo(address newImplementation) external;
}