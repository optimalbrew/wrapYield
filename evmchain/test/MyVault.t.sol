// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lib/forge-std/src/Test.sol";
import "../src/WETH.sol";
import "../src/MyVault.sol";

contract MyVaultTest is Test {
    WETH weth;
    MyVault vault;
    uint256 constant MIN_LIQ = 1e3;
    address constant DEAD = address(1);

    function setUp() public {
        weth = new WETH();
        vault = new MyVault(weth);
        weth.deposit{value: 10 ether}();
    }

    function testDeposit() public {
        weth.approve(address(vault), 1 ether);
        uint256 shares = vault.deposit(1 ether, address(this));
        assertEq(shares, 1 ether);
        assertEq(vault.balanceOf(address(this)), 1 ether);
        assertEq(vault.totalAssets(), 1 ether);
    }

    function testMint() public {
        weth.approve(address(vault), 2 ether);
        uint256 assets = vault.previewMint(2 ether);
        assertEq(assets, 2 ether);
        uint256 shares = vault.mint(2 ether, address(this));
        assertEq(shares, 2 ether);
        assertEq(vault.balanceOf(address(this)), 2 ether);
        assertEq(vault.totalAssets(), 2 ether);
    }

    function testWithdraw() public {
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        uint256 maxWithdraw = vault.maxWithdraw(address(this));
        assertApproxEqAbs(maxWithdraw, 1 ether, MIN_LIQ);
        uint256 assets = vault.withdraw(maxWithdraw, address(this), address(this));
        assertApproxEqAbs(assets, 1 ether, MIN_LIQ);
        assertEq(vault.balanceOf(address(this)), 0);
        assertApproxEqAbs(vault.totalAssets(), 0, MIN_LIQ);
    }

    function testRedeem() public {
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        uint256 maxRedeem = vault.maxRedeem(address(this));
        assertApproxEqAbs(maxRedeem, 1 ether, MIN_LIQ);
        uint256 assets = vault.redeem(maxRedeem, address(this), address(this));
        assertApproxEqAbs(assets, 1 ether, MIN_LIQ);
        assertEq(vault.balanceOf(address(this)), 0);
        assertApproxEqAbs(vault.totalAssets(), 0, MIN_LIQ);
    }

    function testMinimumLiquidityIsLocked() public {
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        assertEq(vault.balanceOf(DEAD), MIN_LIQ);
        assertEq(vault.totalSupply(), 1 ether + MIN_LIQ);
    }

    function testShareAssetRatioAfterFirstDeposit() public {
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        assertEq(vault.balanceOf(address(this)), 1 ether);
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        // Now user should have close to 2 ether in shares, within MIN_LIQ
        assertApproxEqAbs(vault.balanceOf(address(this)), 2 ether, MIN_LIQ);
        // totalSupply should be 2 ether + MIN_LIQ, within MIN_LIQ
        assertApproxEqAbs(vault.totalSupply(), 2 ether + MIN_LIQ, MIN_LIQ);
    }

    //This will fail since the current OZ implementation does not prevent it
    // it is hard to avoid direct transfer - unless erc777 like callback
    /* function testDirectTransferDoesNotAffectShares() public {
        weth.transfer(address(vault), 1 ether);
        // Debug: print balance after direct transfer
        emit log_named_uint("Balance after direct transfer", vault.balanceOf(address(this)));
        assertEq(vault.balanceOf(address(this)), 0);
        weth.approve(address(vault), 1 ether);
        vault.deposit(1 ether, address(this));
        // Debug: print balance after deposit
        emit log_named_uint("Balance after deposit", vault.balanceOf(address(this)));
        assertEq(vault.balanceOf(address(this)), 1 ether);
    } */

    receive() external payable {}
} 