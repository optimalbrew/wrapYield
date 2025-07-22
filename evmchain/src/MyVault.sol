// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//https://docs.openzeppelin.com/contracts/5.x/erc4626#defending_with_a_virtual_offset
// contains warning of inflation attacks
/** The "inflation attack" on an ERC4626 vault occurs when the vault is empty and the 
 * first user deposits a small amount of the underlying asset, then someone else sends
 *  tokens directly to the vault (bypassing the deposit function), and then the first
 *  user withdraws, extracting more than they put in. This is possible because the 
 * share-to-asset ratio is undefined or manipulable when the vault is empty
 
 The standard protection is to ensure that the first deposit mints shares 1:1 with
  assets, and that direct transfers to the vault do not affect the share/asset ratio
 * */

import "../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import "./WETH.sol";

contract MyVault is ERC4626 {
    bool private _initialized;
    uint256 public constant MINIMUM_LIQUIDITY = 10**3; // 1e3 shares locked
    address public constant DEAD_ADDRESS = address(1);

    constructor(WETH _weth)
        ERC4626(IERC20(address(_weth)))
        ERC20("MyVault", "MYVAULT")
    {}

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        uint256 shares;
        if (totalSupply() == 0) {
            // First deposit: mint MINIMUM_LIQUIDITY to address(1) 
            //protection against inflation attack
            shares = super.deposit(assets, receiver);
            _mint(DEAD_ADDRESS, MINIMUM_LIQUIDITY);
        } else {
            shares = super.deposit(assets, receiver);
        }
        return shares;
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        if (totalSupply() == 0) {
            // First mint: mint MINIMUM_LIQUIDITY to address(1)
            uint256 assets = super.mint(shares, receiver);
            _mint(DEAD_ADDRESS, MINIMUM_LIQUIDITY);
            return assets;
        } else {
            return super.mint(shares, receiver);
        }
    }
} 