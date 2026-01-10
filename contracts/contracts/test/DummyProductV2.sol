// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// A simple contract to represent Version 2 of your product.
// It has a new function to confirm the upgrade was successful.
contract DummyProductV2 {
    uint256 public value;

    function initialize(uint256 _initialValue) public {
        value = _initialValue;
    }

    function setValue(uint256 _newValue) public {
        value = _newValue;
    }

    function version() public pure returns (string memory) {
        return "2.0.0";
    }

    // A new function only available in V2
    function newFeature() public pure returns (bool) {
        return true;
    }
}
