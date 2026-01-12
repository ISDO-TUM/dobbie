// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title InitialImplementation
 * @notice A simple, placeholder contract to be used as the first
 * implementation for a new project's proxy. Its only purpose is to
 * exist, allowing the proxy to be initialized. The first real governance
 * action for a team will be to upgrade from this contract to their V1.
 */
contract InitialImplementation {
    /// @notice Version placeholder for future upgrades
    string public constant VERSION = "0.0.0";

    fallback() external payable {
        revert("Project not yet initialized via Governance");
    }

    receive() external payable {
        revert("Project not yet initialized via Governance");
    }
}