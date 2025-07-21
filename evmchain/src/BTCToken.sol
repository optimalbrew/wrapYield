// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BTCToken is ERC20 {
    constructor() ERC20("Bitcoin", "BTC") {
        // Mint 10 million tokens with 18 decimals
        // 10_000_000 * 10^18
        _mint(msg.sender, 10_000_000 * 10**decimals());
    }
} 