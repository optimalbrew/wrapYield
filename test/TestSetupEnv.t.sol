// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract TestSetupEnv is Test {
    // Test addresses (using Anvil's default addresses)
    address constant USER_0 = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
    address constant USER_1 = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    address constant USER_2 = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
    address constant USER_3 = address(0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    address constant USER_4 = address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);

    function setUp() public {
        // Label addresses for better trace output
        vm.label(USER_0, "User 0 (Deployer)");
        vm.label(USER_1, "User 1");
        vm.label(USER_2, "User 2");
        vm.label(USER_3, "User 3");
        vm.label(USER_4, "User 4");

        // Fund all test addresses with initial ETH
        vm.deal(USER_0, 100 ether);  // Deployer gets more ETH
        vm.deal(USER_1, 10 ether);
        vm.deal(USER_2, 10 ether);
        vm.deal(USER_3, 10 ether);
        vm.deal(USER_4, 10 ether);
    }

    function test_InitialBalances() public {
        // Check initial balances of test addresses
        uint256 user0Balance = USER_0.balance;
        uint256 user1Balance = USER_1.balance;
        uint256 user2Balance = USER_2.balance;
        uint256 user3Balance = USER_3.balance;
        uint256 user4Balance = USER_4.balance;

        // All addresses should have some initial ETH
        assertEq(user0Balance, 100 ether, "User 0 should have 100 ETH");
        assertEq(user1Balance, 10 ether, "User 1 should have 10 ETH");
        assertEq(user2Balance, 10 ether, "User 2 should have 10 ETH");
        assertEq(user3Balance, 10 ether, "User 3 should have 10 ETH");
        assertEq(user4Balance, 10 ether, "User 4 should have 10 ETH");

        // Log balances for debugging
        console.log("User 0 balance: %s ETH", user0Balance / 1e18);
        console.log("User 1 balance: %s ETH", user1Balance / 1e18);
        console.log("User 2 balance: %s ETH", user2Balance / 1e18);
        console.log("User 3 balance: %s ETH", user3Balance / 1e18);
        console.log("User 4 balance: %s ETH", user4Balance / 1e18);
    }

    function test_AddressesAreValid() public {
        // Check that addresses are valid (non-zero)
        assertTrue(USER_0 != address(0), "User 0 address should be valid");
        assertTrue(USER_1 != address(0), "User 1 address should be valid");
        assertTrue(USER_2 != address(0), "User 2 address should be valid");
        assertTrue(USER_3 != address(0), "User 3 address should be valid");
        assertTrue(USER_4 != address(0), "User 4 address should be valid");

        // Check that addresses are unique
        assertTrue(USER_0 != USER_1, "User addresses should be unique");
        assertTrue(USER_1 != USER_2, "User addresses should be unique");
        assertTrue(USER_2 != USER_3, "User addresses should be unique");
        assertTrue(USER_3 != USER_4, "User addresses should be unique");
    }

    function test_CanSendETH() public {
        // Fund USER_0 with 10 ETH
        vm.deal(USER_0, 10 ether);
        
        // Start acting as USER_0
        vm.startPrank(USER_0);

        // Get initial balances
        uint256 user1InitialBalance = USER_1.balance;
        uint256 user0InitialBalance = USER_0.balance;

        // Send 1 ETH to USER_1
        uint256 sendAmount = 1 ether;
        (bool success, ) = USER_1.call{value: sendAmount}("");
        assertTrue(success, "ETH transfer should succeed");

        // Verify balances
        assertEq(USER_1.balance, user1InitialBalance + sendAmount, "USER_1 should receive 1 ETH");
        assertEq(USER_0.balance, user0InitialBalance - sendAmount, "USER_0 balance should decrease by 1 ETH");

        vm.stopPrank();
    }
} 