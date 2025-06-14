// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/WBTCToken.sol";
import "../src/BTCToken.sol";

contract TestWBTC is Test {
    // Test addresses (using Anvil's default addresses)
    address constant USER_0 = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
    address constant USER_1 = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    address constant USER_2 = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);

    BTCToken public btcToken;
    WBTCToken public wbtcToken;

    function setUp() public {
        // Deploy BTC token as USER_0
        vm.startPrank(USER_0);
        btcToken = new BTCToken();
        
        // Deploy WBTC token
        wbtcToken = new WBTCToken(address(btcToken));
        vm.stopPrank();
        
        // Label addresses for better trace output
        vm.label(address(btcToken), "BTC Token");
        vm.label(address(wbtcToken), "WBTC Token");
        vm.label(USER_0, "User 0 (Owner)");
        vm.label(USER_1, "User 1");
        vm.label(USER_2, "User 2");

        // Transfer some BTC to test users from the deployer (USER_0)
        vm.startPrank(USER_0);
        btcToken.transfer(USER_1, 10 * 10**18); // 10 BTC to USER_1
        btcToken.transfer(USER_2, 10 * 10**18); // 10 BTC to USER_2
        vm.stopPrank();
    }

    function test_WrappingAndUnwrapping() public {
        // Start acting as USER_1
        vm.startPrank(USER_1);
        
        uint256 wrapAmount = 1 * 10**18; // 1 BTC
        
        // First approve WBTC contract to spend BTC
        btcToken.approve(address(wbtcToken), wrapAmount);
        
        // Wrap BTC to WBTC
        wbtcToken.wrap(wrapAmount);
        
        // Verify balances
        assertEq(wbtcToken.balanceOf(USER_1), wrapAmount);
        assertEq(btcToken.balanceOf(address(wbtcToken)), wrapAmount);
        
        // Unwrap half
        uint256 unwrapAmount = 0.5 * 10**18;
        wbtcToken.unwrap(unwrapAmount);
        
        // Verify balances after unwrap
        assertEq(wbtcToken.balanceOf(USER_1), wrapAmount - unwrapAmount);
        assertEq(btcToken.balanceOf(address(wbtcToken)), wrapAmount - unwrapAmount);
        assertEq(btcToken.balanceOf(USER_1), 9.5 * 10**18); // 10 BTC initial - 1 BTC wrapped + 0.5 BTC unwrapped
        
        vm.stopPrank();
    }

    function test_OwnerMintingAndBurning() public {
        // Start acting as owner (USER_0)
        vm.startPrank(USER_0);
        
        uint256 mintAmount = 2 * 10**18; // 2 WBTC
        bytes32 txid = keccak256("test_tx_1");
        uint32 index = 1;
        uint32 duration = 86400; // 1 day
        
        // Mint WBTC to USER_2
        wbtcToken.ownerMint(USER_2, mintAmount, txid, index, duration);
        
        // Verify balances
        assertEq(wbtcToken.balanceOf(USER_2), mintAmount);
        
        // Check maximum burn amount
        uint256 maxBurnAmount = wbtcToken.getMaxOwnerBurnAmount();
        assertEq(maxBurnAmount, mintAmount, "Max burn amount should equal minted amount");
        
        // Burn half
        uint256 burnAmount = 1 * 10**18;
        bytes32 burnTxid = keccak256("test_tx_2");
        wbtcToken.ownerBurn(USER_2, burnAmount, burnTxid);
        
        // Verify balances after burn
        assertEq(wbtcToken.balanceOf(USER_2), mintAmount - burnAmount);
        
        // Try to burn more than max amount (should fail)
        bytes32 failTxid = keccak256("test_tx_3");
        vm.expectRevert("Insufficient WBTC balance");
        wbtcToken.ownerBurn(USER_2, maxBurnAmount + 1, failTxid);
        
        vm.stopPrank();
    }

    function test_MaxBurnAmount() public {
        // Start acting as owner
        vm.startPrank(USER_0);
        
        // Mint some WBTC
        uint256 mintAmount = 5 * 10**18;
        wbtcToken.ownerMint(USER_2, mintAmount, keccak256("tx1"), 1, 86400);
        
        // Verify max burn amount (should be 5 WBTC since no BTC is locked yet)
        assertEq(wbtcToken.getMaxOwnerBurnAmount(), mintAmount);
        
        // Wrap some BTC (this should reduce max burn amount)
        vm.stopPrank();
        vm.startPrank(USER_1);
        uint256 wrapAmount = 2 * 10**18;
        btcToken.approve(address(wbtcToken), wrapAmount);
        wbtcToken.wrap(wrapAmount);
        
        // Check max burn amount again
        // Total supply = 7 WBTC (5 minted + 2 wrapped)
        // Locked BTC = 2 BTC
        // Max burn = 7 - 2 = 5 WBTC
        vm.stopPrank();
        vm.startPrank(USER_0);
        assertEq(wbtcToken.getMaxOwnerBurnAmount(), 5 * 10**18);
        
        vm.stopPrank();
    }
} 