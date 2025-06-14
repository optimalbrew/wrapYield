// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/WBTCToken.sol";

contract DeployWBTC is Script {
    function run() external {
        // Get the private key from the environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get the BTC token address from environment
        address btcAddress = vm.envAddress("BTC_TOKEN_ADDRESS");
        
        console.log("Deploying WBTC token...");
        console.log("BTC Token address: %s", btcAddress);
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the WBTC token
        WBTCToken wbtcToken = new WBTCToken(btcAddress);
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        console.log("WBTC Token deployed to: %s", address(wbtcToken));
        console.log("\nContract Features:");
        console.log("1. Regular wrapping/unwrapping of BTC");
        console.log("2. Owner-only minting with txid, index, and duration");
        console.log("3. Owner-only burning with txid");
    }
} 