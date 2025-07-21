// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PRZToken.sol";

contract DeployPRZ is Script {
    function run() external {
        // Get the private key from the environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the PRZ token
        PRZToken przToken = new PRZToken();
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        console.log("PRZ Token deployed to: %s", address(przToken));
        console.log("Total Supply: %s PRZ", przToken.totalSupply() / 1e18);
    }
} 