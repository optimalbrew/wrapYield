// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BTCToken.sol";

contract DeployBTC is Script {
    function run() external {
        // Get the private key from the environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the BTC token
        BTCToken btcToken = new BTCToken();
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        console.log("BTC Token deployed to: %s", address(btcToken));
        console.log("Total Supply: %s BTC", btcToken.totalSupply() / 1e18);
    }
} 