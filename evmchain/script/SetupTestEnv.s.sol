// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract SetuptesEnv is Script {
    // This is the address that will be used to deploy contracts (user_0)
    address constant DEPLOYER = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
    
    // Array of tes addresses (these are the default Anvil addresses)
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
        console.log("Setting up tes environment...");
        
        // Log initial balances
        for (uint i = 0; i < tesAddresses.length; i++) {
            uint256 balance = tesAddresses[i].balance;
            console.log("User %d (%s) initial balance: %s ETH", 
                i, 
                tesAddresses[i],
                vm.toString(balance / 1e18)
            );
        }
        
        console.log("\ntes environment setup complete!");
        console.log("Deployer address (user_0): %s", DEPLOYER);
    }
} 