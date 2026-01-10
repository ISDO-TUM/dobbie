// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// A simple contract to represent Version 1 of your product.
contract DummyProductV1 {
    uint256 public value;

    function initialize(uint256 _initialValue) public {
        value = _initialValue;
    }

    function setValue(uint256 _newValue) public {
        value = _newValue;
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
