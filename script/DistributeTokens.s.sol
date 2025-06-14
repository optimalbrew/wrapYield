// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BTCToken.sol";
import "../src/PRZToken.sol";

contract DistributeTokens is Script {
    // Array of test addresses (these are the default Anvil addresses)
    // do not use "test" in the name of variables, it will trigger a test
    address[] public tesAddresses = [
        address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266), // user_0
        address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8), // user_1
        address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC), // user_2
        address(0x90F79bf6EB2c4f870365E785982E1f101E93b906), // user_3
        address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65), // user_4
        address(0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc), // user_5
        address(0x976EA74026E726554dB657fA54763abd0C3a0aa9), // user_6
        address(0x14DC79964Da2C08B23698B3D3CC7ca32172d1105), // user_7
        address(0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f), // user_8
        address(0xa0Ee7A142d267C1f36714E4a8F75612F20a79720)  // user_9
    ];

    function run() external {
        // Get the private key from the environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get the deployed token addresses from environment
        address btcAddress = vm.envAddress("BTC_TOKEN_ADDRESS");
        address przAddress = vm.envAddress("PRZ_TOKEN_ADDRESS");
        
        // Initialize token contracts
        BTCToken btcToken = BTCToken(btcAddress);
        PRZToken przToken = PRZToken(przAddress);
        
        // Calculate 2% of total supply for each token
        uint256 btcTotalSupply = btcToken.totalSupply();
        uint256 przTotalSupply = przToken.totalSupply();
        
        uint256 btcAmount = (btcTotalSupply * 2) / 100; // 2% of BTC supply
        uint256 przAmount = (przTotalSupply * 2) / 100; // 2% of PRZ supply
        
        console.log("Distributing tokens...");
        console.log("BTC amount per user: %s BTC", btcAmount / 1e18);
        console.log("PRZ amount per user: %s PRZ", przAmount / 1e18);
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Distribute tokens to each address
        for (uint i = 0; i < tesAddresses.length; i++) {
            // Skip user_0 as they already have the tokens
            if (i == 0) continue;
            
            // Transfer BTC
            btcToken.transfer(tesAddresses[i], btcAmount);
            console.log("Transferred %s BTC to user_%d (%s)", 
                btcAmount / 1e18, 
                i, 
                tesAddresses[i]
            );
            
            // Transfer PRZ
            przToken.transfer(tesAddresses[i], przAmount);
            console.log("Transferred %s PRZ to user_%d (%s)", 
                przAmount / 1e18, 
                i, 
                tesAddresses[i]
            );
        }
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        console.log("\nDistribution complete!");
    }
} 