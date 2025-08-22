// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./ProtocolConfig.sol";
import "./EtherSwap.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Integration Example Contract
 * @dev Example of how to use ProtocolConfig.sol with the existing BTC Collateral Loan system
 * 
 * This demonstrates how to migrate from hardcoded constants to the centralized configuration.
 * This is a simplified version of BtcCollateralLoan.sol using the new configuration system.
 */
contract ConfigurablebtcCollateralLoan is Ownable, ReentrancyGuard {
    
    // ============ USING PROTOCOL CONFIG ============
    using ProtocolConfig for *;
    
    // ============ STATE VARIABLES ============
    
    /// @dev The EtherSwap contract instance
    EtherSwap public etherSwap;
    
    /// @dev Current lender's Bitcoin Schnorr (x only) public key
    string public lenderBtcPubkey;
    
    /// @dev Loan counter
    uint256 private _loanIds;
    
    // ============ EVENTS ============
    
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 amount, uint256 bondAmount);
    event ConfigParametersDisplayed(string description, string version);
    
    // ============ CONSTRUCTOR ============
    
    constructor(string memory _lenderBtcPubkey) Ownable(msg.sender) {
        require(bytes(_lenderBtcPubkey).length == ProtocolConfig.BTC_PUBKEY_LENGTH, "Invalid BTC pubkey length");
        lenderBtcPubkey = _lenderBtcPubkey;
        
        // Display config info for demonstration
        emit ConfigParametersDisplayed(ProtocolConfig.getDescription(), ProtocolConfig.getVersion());
    }
    
    // ============ CONFIGURATION USAGE EXAMPLES ============
    
    /**
     * @dev Request a loan using configuration parameters
     */
    function requestLoan(uint256 amount, string memory btcAddress, string memory btcPubkey, bytes32 preimageHash) 
        external 
        payable 
        nonReentrant 
    {
        // Use configuration for validation and fees
        require(msg.value >= ProtocolConfig.getProcessingFee(), "Insufficient processing fee");
        require(ProtocolConfig.validateLoanAmount(amount), "Invalid loan amount");
        require(bytes(btcAddress).length >= ProtocolConfig.P2TR_ADDRESS_MIN_LENGTH && 
                bytes(btcAddress).length <= ProtocolConfig.P2TR_ADDRESS_MAX_LENGTH, "Invalid P2TR address");
        require(bytes(btcPubkey).length == ProtocolConfig.BTC_PUBKEY_LENGTH, "Invalid BTC pubkey");
        
        _loanIds++;
        
        emit LoanRequested(_loanIds, msg.sender, amount);
    }
    
    /**
     * @dev Offer a loan using configuration parameters
     */
    function offerLoan(uint256 loanId, uint256 loanAmount, bytes32 preimageHashBorrower) 
        external 
        payable 
        onlyOwner 
        nonReentrant 
    {
        // Calculate bond amount using configuration
        uint256 bondAmount = ProtocolConfig.calculateLenderBond(loanAmount);
        require(msg.value == loanAmount + bondAmount, "Incorrect value sent");
        
        // Use configuration timelock
        uint256 timelock = block.number + ProtocolConfig.getTimelockLoanReq();
        
        emit LoanOffered(loanId, msg.sender, loanAmount, bondAmount);
    }
    
    /**
     * @dev Calculate total fees for a loan using configuration
     */
    function calculateLoanFees(uint256 loanAmount) 
        external 
        pure 
        returns (uint256 processingFee, uint256 originationFee, uint256 lenderBond) 
    {
        processingFee = ProtocolConfig.getProcessingFee();
        originationFee = ProtocolConfig.calculateOriginationFee(loanAmount);
        lenderBond = ProtocolConfig.calculateLenderBond(loanAmount);
    }
    
    /**
     * @dev Calculate interest for a loan using configuration
     */
    function calculateLoanInterest(uint256 principal, uint256 customDurationBlocks) 
        external 
        pure 
        returns (uint256 interest, uint256 totalRepayment) 
    {
        uint256 durationBlocks = customDurationBlocks > 0 ? customDurationBlocks : ProtocolConfig.getLoanDuration();
        
        interest = ProtocolConfig.calculateInterest(
            principal,
            ProtocolConfig.getDefaultInterestRateBps(),
            durationBlocks,
            1095000 // Rootstock blocks per year
        );
        
        totalRepayment = principal + interest;
    }
    
    /**
     * @dev Get all timelock values for Bitcoin integration
     */
    function getBitcoinTimelocks() 
        external 
        pure 
        returns (
            uint256 loanReqBtc,
            uint256 btcEscrowBtc, 
            uint256 repaymentAcceptBtc,
            uint256 btcCollateralBtc,
            uint256 loanDurationBtc
        ) 
    {
        loanReqBtc = ProtocolConfig.evmBlocksToBtcBlocks(ProtocolConfig.getTimelockLoanReq());
        btcEscrowBtc = ProtocolConfig.evmBlocksToBtcBlocks(ProtocolConfig.getTimelockBtcEscrow());
        repaymentAcceptBtc = ProtocolConfig.evmBlocksToBtcBlocks(ProtocolConfig.getTimelockRepaymentAccept());
        btcCollateralBtc = ProtocolConfig.evmBlocksToBtcBlocks(ProtocolConfig.getTimelockBtcCollateral());
        loanDurationBtc = ProtocolConfig.evmBlocksToBtcBlocks(ProtocolConfig.getLoanDuration());
    }
    
    /**
     * @dev Validate timelock constraints for loan operations
     */
    function validateTimelockConstraints() external pure returns (bool valid, string memory message) {
        if (!ProtocolConfig.validateTimelockOrdering()) {
            return (false, "Timelock ordering constraints not satisfied");
        }
        return (true, "All timelock constraints satisfied");
    }
    
    /**
     * @dev Get network information for the current deployment
     */
    function getDeploymentInfo() 
        external 
        view 
        returns (
            string memory network,
            bool isDev,
            bool isTestnet,
            bool isMainnet,
            uint256 chainId
        ) 
    {
        network = ProtocolConfig.getCurrentNetwork();
        isDev = ProtocolConfig.isDevelopmentNetwork();
        isTestnet = ProtocolConfig.isTestnetNetwork();
        isMainnet = ProtocolConfig.isMainnetNetwork();
        chainId = block.chainid;
    }
    
    // ============ MIGRATION HELPERS ============
    
    /**
     * @dev Compare new config values with old hardcoded values
     * This helps verify that migration doesn't change existing behavior
     */
    function verifyMigrationCompatibility() external pure returns (bool compatible) {
        // Check that new config matches old hardcoded values
        bool processingFeeMatch = ProtocolConfig.getProcessingFee() == 0.001 ether;
        bool minLoanMatch = ProtocolConfig.getMinLoanAmount() == 0.005 ether;  
        bool originFeeMatch = ProtocolConfig.getOriginFeePercentageDivisor() == 1000;
        bool bondMatch = ProtocolConfig.getLenderBondPercentage() == 10;
        
        return processingFeeMatch && minLoanMatch && originFeeMatch && bondMatch;
    }
    
    /**
     * @dev Emergency function to check all configuration parameters
     */
    function emergencyConfigCheck() 
        external 
        pure 
        returns (
            bool allParametersValid,
            bool timelockOrderingValid,
            bool interestRatesValid,
            string memory version
        ) 
    {
        allParametersValid = true;
        
        // Validate timelocks
        timelockOrderingValid = ProtocolConfig.validateTimelockOrdering();
        
        // Validate interest rates
        uint256 defaultRate = ProtocolConfig.getDefaultInterestRateBps();
        uint256 minRate = ProtocolConfig.getMinInterestRateBps();  
        uint256 maxRate = ProtocolConfig.getMaxInterestRateBps();
        
        interestRatesValid = (defaultRate >= minRate && defaultRate <= maxRate);
        
        version = ProtocolConfig.getVersion();
        
        allParametersValid = timelockOrderingValid && interestRatesValid;
    }
}
