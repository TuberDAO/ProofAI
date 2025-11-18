// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract SmokeTest {
    uint256 public value = 1;

    function setValue(uint256 _value) external {
        value = _value;
    }
}


