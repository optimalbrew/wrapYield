// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/BTCToken.sol";
import "../src/PRZToken.sol";

contract TestTokenDistribution is Test {
    // Test addresses (using Anvil's default addresses)
    address constant USER_0 = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
    address constant USER_1 = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    address constant USER_2 = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
    address constant USER_3 = address(0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    address constant USER_4 = address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);

    BTCToken public btcToken;
    PRZToken public przToken;

    function setUp() public {
        // Deploy tokens as USER_0
        vm.startPrank(USER_0);
        btcToken = new BTCToken();
        przToken = new PRZToken();
        vm.stopPrank();

        // Label addresses for better trace output
        vm.label(address(btcToken), "BTC Token");
        vm.label(address(przToken), "PRZ Token");
        vm.label(USER_0, "User 0 (Owner)");
        vm.label(USER_1, "User 1");
        vm.label(USER_2, "User 2");
        vm.label(USER_3, "User 3");
        vm.label(USER_4, "User 4");
    }

    function test_DistributeTokens() public {
        // Start acting as USER_0 (owner)
        vm.startPrank(USER_0);

        // Calculate 2% of total supply for each token
        uint256 btcTotalSupply = btcToken.totalSupply();
        uint256 przTotalSupply = przToken.totalSupply();
        
        uint256 btcAmount = (btcTotalSupply * 2) / 100; // 2% of BTC supply
        uint256 przAmount = (przTotalSupply * 2) / 100; // 2% of PRZ supply

        // Distribute tokens to each address
        address[] memory users = new address[](4);
        users[0] = USER_1;
        users[1] = USER_2;
        users[2] = USER_3;
        users[3] = USER_4;

        for (uint i = 0; i < users.length; i++) {
            // Transfer BTC
            btcToken.transfer(users[i], btcAmount);
            // Transfer PRZ
            przToken.transfer(users[i], przAmount);
        }

        vm.stopPrank();

        // Verify balances
        for (uint i = 0; i < users.length; i++) {
            assertEq(btcToken.balanceOf(users[i]), btcAmount, "Incorrect BTC balance");
            assertEq(przToken.balanceOf(users[i]), przAmount, "Incorrect PRZ balance");
        }

        // Verify owner's remaining balance
        uint256 expectedBtcRemaining = btcTotalSupply - (btcAmount * users.length);
        uint256 expectedPrzRemaining = przTotalSupply - (przAmount * users.length);
        
        assertEq(btcToken.balanceOf(USER_0), expectedBtcRemaining, "Incorrect remaining BTC balance");
        assertEq(przToken.balanceOf(USER_0), expectedPrzRemaining, "Incorrect remaining PRZ balance");
    }

    function test_DistributeTokensFailsWithInsufficientBalance() public {
        // Start acting as USER_0 (owner)
        vm.startPrank(USER_0);

        // Calculate 2% of total supply for each token
        uint256 btcTotalSupply = btcToken.totalSupply();
        uint256 przTotalSupply = przToken.totalSupply();
        
        uint256 btcAmount = (btcTotalSupply * 2) / 100; // 2% of BTC supply
        uint256 przAmount = (przTotalSupply * 2) / 100; // 2% of PRZ supply

        // Try to distribute more tokens than available
        uint256 excessiveAmount = btcTotalSupply + 1;
        
        // This should fail with ERC20InsufficientBalance error
        vm.expectRevert(abi.encodeWithSelector(
            bytes4(keccak256("ERC20InsufficientBalance(address,uint256,uint256)")),
            USER_0,
            btcTotalSupply,
            excessiveAmount
        ));
        btcToken.transfer(USER_1, excessiveAmount);

        vm.stopPrank();
    }
} 