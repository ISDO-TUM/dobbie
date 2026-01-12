// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VersionManifestV2
 * @notice A lightweight, immutable snapshot of all contract addresses for version 2.0.0.
 * @dev This contract is what the Beacon points to. Each upgrade deploys a new manifest.
 */
contract VersionManifestV2 {
    string public constant VERSION = "2.0.0";
    
    bytes32 public immutable projectId;
    string public versionTag;
    uint256 public immutable deployedAt;
    
    // Contract name => address mapping
    mapping(string => address) private _contracts;
    string[] private _contractNames;
    
    constructor(
        bytes32 _projectId,
        string memory _versionTag,
        string[] memory names,
        address[] memory addresses
    ) {
        require(names.length == addresses.length, "Manifest: Length mismatch");
        require(names.length > 0, "Manifest: Empty manifest");
        
        projectId = _projectId;
        versionTag = _versionTag;
        deployedAt = block.timestamp;
        _contractNames = names;
        
        for (uint256 i = 0; i < names.length; i++) {
            require(addresses[i] != address(0), "Manifest: Zero address");
            _contracts[names[i]] = addresses[i];
        }
    }
    
    function getContract(string calldata name) external view returns (address) {
        address addr = _contracts[name];
        require(addr != address(0), "Manifest: Contract not found");
        return addr;
    }
    
    function getAllContracts() 
        external 
        view 
        returns (string[] memory names, address[] memory addresses) 
    {
        names = _contractNames;
        addresses = new address[](names.length);
        for (uint256 i = 0; i < names.length; i++) {
            addresses[i] = _contracts[names[i]];
        }
    }
    
    function getContractNames() external view returns (string[] memory) {
        return _contractNames;
    }
}
