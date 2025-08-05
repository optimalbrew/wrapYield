// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//boilerplate ETH wrapper created using cursor

import "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
    constructor() ERC20("WETH", "WETH") {}

    // Deposit ETH and mint WETH tokens 1:1
    function deposit() external payable {
        require(msg.value > 0, "No ETH sent");
        _mint(msg.sender, msg.value);
    }

    // Burn WETH tokens and withdraw ETH 1:1
    function withdraw(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient WETH");
        _burn(msg.sender, amount);
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "ETH transfer failed");
    }

    // Allow contract to receive ETH
    receive() external payable {
        require(msg.value > 0, "No ETH sent");
        _mint(msg.sender, msg.value);
    }
} 