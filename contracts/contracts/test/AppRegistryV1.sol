// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AppRegistryV1 {
    address public immutable product;
    string public constant VERSION = "1.0.0";

    constructor(address _product) {
        product = _product;
    }
}
