// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AppRegistryV2 {
    // V2 points to a new product or adds new components
    address public immutable product;
    address public immutable newComponent;
    string public constant VERSION = "2.0.0";

    constructor(address _product, address _newComponent) {
        product = _product;
        newComponent = _newComponent;
    }
}
