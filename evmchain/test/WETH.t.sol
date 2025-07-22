// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lib/forge-std/src/Test.sol";
import "../src/WETH.sol";

contract WETHTest is Test {
    WETH weth;

    function setUp() public {
        weth = new WETH();
    }

    function testDepositMintsWETH() public {
        uint256 depositAmount = 1 ether;
        weth.deposit{value: depositAmount}();
        assertEq(weth.balanceOf(address(this)), depositAmount);
    }

    function testWithdrawBurnsWETHAndSendsETH() public {
        uint256 depositAmount = 1 ether;
        weth.deposit{value: depositAmount}();
        uint256 balanceBefore = address(this).balance;
        weth.withdraw(depositAmount);
        uint256 balanceAfter = address(this).balance;
        assertEq(weth.balanceOf(address(this)), 0);
        assertEq(balanceAfter, balanceBefore + depositAmount);
    }

    function testReceiveMintsWETH() public {
        uint256 depositAmount = 2 ether;
        (bool sent, ) = address(weth).call{value: depositAmount}("");
        require(sent, "ETH send failed");
        assertEq(weth.balanceOf(address(this)), depositAmount);
    }

    receive() external payable {}
} 