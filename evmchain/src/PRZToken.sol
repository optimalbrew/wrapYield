// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PRZToken is ERC20 {
    constructor() ERC20("Prize", "PRZ") {
        // Mint 5 million tokens with 18 decimals
        // 5_000_000 * 10^18
        _mint(msg.sender, 5_000_000 * 10**decimals());
    }
} 