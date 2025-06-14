// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract GenerateKeys is Script {
    function run() external {
        console.log("Generating 10 private keys and addresses:");
        console.log("----------------------------------------");
        
        for (uint256 i = 0; i < 10; i++) {
            // Generate a random private key
            uint256 privateKey = uint256(keccak256(abi.encodePacked(block.timestamp, i)));
            
            // Derive the address from the private key
            address addr = vm.addr(privateKey);
            
            console.log("User %d:", i);
            console.log("Private Key: 0x%s", vm.toString(privateKey));
            console.log("Address: %s", addr);
            console.log("----------------------------------------");
        }
    }
} 