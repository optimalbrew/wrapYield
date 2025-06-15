// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract WBTCToken is ERC20, ReentrancyGuard, Ownable2Step {
    IERC20 public immutable btcToken;
    
    struct MintData {
        bytes32 txid;      // 32 bytes transaction ID
        uint32 index;      // Index of the output
        uint32 duration;   // Duration in seconds
    }
    
    // Mapping to track used txids to prevent double-minting
    mapping(bytes32 => bool) public usedTxids;
    
    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);
    event OwnerMinted(
        uint256 amount, 
        bytes32 txid, 
        uint32 index, 
        uint32 duration
    );
    event OwnerBurned(
        uint256 amount,
        bytes32 txid
    );
    
    constructor(address _btcToken) 
        ERC20("Wrapped Bitcoin", "WBTC") 
        Ownable(msg.sender)
    {
        btcToken = IERC20(_btcToken);
    }
    
    /**
     * @dev Mints WBTC tokens by locking BTC tokens
     * @param amount Amount of BTC tokens to lock
     */
    function wrap(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer BTC tokens from user to this contract
        require(
            btcToken.transferFrom(msg.sender, address(this), amount),
            "BTC transfer failed"
        );
        
        // Mint equivalent amount of WBTC
        _mint(msg.sender, amount);
        
        emit Wrapped(msg.sender, amount);
    }
    
    /**
     * @dev Burns WBTC tokens to recover BTC tokens
     * @param amount Amount of WBTC tokens to burn
     */
    function unwrap(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Burn WBTC tokens
        _burn(msg.sender, amount);
        
        // Transfer equivalent amount of BTC back to user
        require(
            btcToken.transfer(msg.sender, amount),
            "BTC transfer failed"
        );
        
        emit Unwrapped(msg.sender, amount);
    }
    
    /**
     * @dev Owner-only function to mint WBTC without requiring BTC
     * @param amount Amount of WBTC to mint
     * @param txid 32-byte transaction ID
     * @param index Index of the output
     * @param duration Duration in seconds
     */
    function ownerMint(
        uint256 amount, 
        bytes32 txid, 
        uint32 index, 
        uint32 duration
    ) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(!usedTxids[txid], "Transaction ID already used");
        require(duration > 0, "Duration must be greater than 0");
        
        // Mark txid as used
        usedTxids[txid] = true;
        
        // Mint the tokens to the owner's address
        _mint(msg.sender, amount);
        
        emit OwnerMinted(amount, txid, index, duration);
    }

    /**
     * @dev Returns the maximum amount of WBTC that can be burned by the owner
     * This is the difference between total WBTC supply and locked BTC
     * Safety check to prevent burning more WBTC than the contract has BTC locked
     */
    function getMaxOwnerBurnAmount() public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        uint256 lockedBTC = btcToken.balanceOf(address(this));
        return totalSupply > lockedBTC ? totalSupply - lockedBTC : 0;
    }

    /**
     * @dev Owner-only function to burn WBTC without returning BTC
     * @param amount Amount of WBTC to burn
     * @param txid 32-byte transaction ID for tracking
     */
    function ownerBurn(
        uint256 amount,
        bytes32 txid
    ) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(!usedTxids[txid], "Transaction ID already used");
        require(balanceOf(msg.sender) >= amount, "Insufficient WBTC balance");
        
        // Check if the burn amount exceeds the maximum allowed
        uint256 maxBurnAmount = getMaxOwnerBurnAmount();
        require(amount <= maxBurnAmount, "Burn amount exceeds unbacked WBTC");
        
        // Mark txid as used
        usedTxids[txid] = true;
        
        // Burn the tokens from owner's address
        _burn(msg.sender, amount);
        
        emit OwnerBurned(amount, txid);
    }
    
    /**
     * @dev Returns the amount of BTC tokens locked in the contract
     */
    function getLockedBTC() external view returns (uint256) {
        return btcToken.balanceOf(address(this));
    }
} 