// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title CustomTimelockController
 * @notice This is a simple wrapper to make the OpenZeppelin TimelockController
 * available as a primary artifact for deployment and testing in this project.
 */
contract CustomTimelockController is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
