// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import "../src/ProtocolConfig.sol";

/**
 * @title Protocol Configuration Test
 * @dev Test contract for the ProtocolConfig library
 * 
 * This contract tests all the constants, functions, and utilities
 * provided by the ProtocolConfig library to ensure they work correctly
 * and match the values from the JSON configuration.
 * 
 * Run with: forge test --match-contract ProtocolConfigTest -vv
 */
contract ProtocolConfigTest is Test {
    using ProtocolConfig for *;
    
    function setUp() public {
        // Setup test environment
        console.log("Testing Protocol Configuration...");
    }
    
    // ============ TEST CONSTANTS ============
    
    function testVersionInfo() public {
        string memory version = ProtocolConfig.getVersion();
        string memory description = ProtocolConfig.getDescription();
        string memory generatedOn = ProtocolConfig.getGeneratedOn();
        
        assertEq(version, "1.0.0");
        assertEq(description, "Shared configuration parameters for BTC Yield Protocol");
        
        // Check that the file was auto-generated (generatedOn should not be empty)
        assertTrue(bytes(generatedOn).length > 0);
        
        console.log("Version:", version);
        console.log("Description:", description);
        console.log("Generated on:", generatedOn);
    }
    
    function testFeeConstants() public {
        // Test processing fee (0.001 ether)
        uint256 processingFee = ProtocolConfig.getProcessingFee();
        assertEq(processingFee, 0.001 ether);
        
        // Test loan limits
        uint256 minLoan = ProtocolConfig.getMinLoanAmount();
        uint256 maxLoan = ProtocolConfig.getMaxLoanAmount();
        assertEq(minLoan, 0.005 ether);
        assertEq(maxLoan, 100 ether);
        
        // Test fee percentages
        uint256 originFee = ProtocolConfig.getOriginFeePercentage();
        uint256 lenderBond = ProtocolConfig.getLenderBondPercentage();
        assertEq(originFee, 1); // 1% = 1/1000
        assertEq(lenderBond, 10);       // 10%
        
        console.log("Processing fee:", processingFee);
        console.log("Min loan amount:", minLoan);
        console.log("Max loan amount:", maxLoan);
        console.log("Origination fee percentage:", originFee);
        console.log("Lender bond percentage:", lenderBond);
    }
    
    function testTimelockConstants() public {
        uint256 loanReq = ProtocolConfig.getTimelockLoanReq();
        uint256 btcEscrow = ProtocolConfig.getTimelockBtcEscrow();
        uint256 repaymentAccept = ProtocolConfig.getTimelockRepaymentAccept();
        uint256 btcCollateral = ProtocolConfig.getTimelockBtcCollateral();
        uint256 loanDuration = ProtocolConfig.getLoanDuration();
        
        assertEq(loanReq, 1000);
        assertEq(btcEscrow, 2000);
        assertEq(repaymentAccept, 1500);
        assertEq(btcCollateral, 543000);
        assertEq(loanDuration, 540000);
        
        console.log("Timelock loan request (t_B):", loanReq);
        console.log("Timelock BTC escrow (t_0):", btcEscrow);
        console.log("Timelock repayment accept (t_L):", repaymentAccept);
        console.log("Timelock BTC collateral (t_1):", btcCollateral);
        console.log("Loan duration (t_D):", loanDuration);
    }
    
    function testInterestRateConstants() public {
        uint256 defaultRate = ProtocolConfig.getDefaultInterestRateBps();
        uint256 minRate = ProtocolConfig.getMinInterestRateBps();
        uint256 maxRate = ProtocolConfig.getMaxInterestRateBps();
        uint256 bpsDivisor = ProtocolConfig.getBasisPointsDivisor();
        
        assertEq(defaultRate, 800);  // 8% = 800 basis points
        assertEq(minRate, 0);      // 0% = 100 basis points
        assertEq(maxRate, 2500);     // 25% = 2500 basis points
        assertEq(bpsDivisor, 10000); // 100% = 10000 basis points
        
        console.log("Default interest rate (bps):", defaultRate);
        console.log("Min interest rate (bps):", minRate);
        console.log("Max interest rate (bps):", maxRate);
        console.log("Basis points divisor:", bpsDivisor);
    }
    
    // ============ TEST UTILITY FUNCTIONS ============
    
    function testBlockConversions() public {
        uint256 evmBlocks = 1000;
        uint256 btcBlocks = ProtocolConfig.evmBlocksToBtcBlocks(evmBlocks);
        uint256 backToEvm = ProtocolConfig.btcBlocksToEvmBlocks(btcBlocks);
        
        // With 1:20 ratio, 1000 EVM blocks = 50 BTC blocks
        assertEq(btcBlocks, 50);
        assertEq(backToEvm, evmBlocks);
        
        console.log("EVM blocks:", evmBlocks);
        console.log("BTC blocks:", btcBlocks);
        console.log("Back to EVM:", backToEvm);
    }
    
    function testFeeCalculations() public {
        uint256 loanAmount = 2.5 ether;
        
        // Test origination fee (1% of loan amount)
        uint256 originFee = ProtocolConfig.calculateOriginationFee(loanAmount);
        assertEq(originFee, 0.025 ether); // 2.5 * 0.01 = 0.025
        
        // Test lender bond (10% of loan amount)
        uint256 lenderBond = ProtocolConfig.calculateLenderBond(loanAmount);
        assertEq(lenderBond, 0.25 ether); // 2.5 * 0.1 = 0.25
        
        console.log("Loan amount:", loanAmount);
        console.log("Origination fee:", originFee);
        console.log("Lender bond:", lenderBond);
    }
    
    function testInterestCalculations() public {
        uint256 principal = 1 ether;
        uint256 interestRate = 800; // 8% in basis points
        uint256 duration = 540000;  // 6 months in blocks
        uint256 blocksPerYear = 1095000; // Rootstock blocks per year
        
        uint256 interest = ProtocolConfig.calculateInterest(
            principal,
            interestRate,
            duration,
            blocksPerYear
        );
        
        // Expected: 1 ETH * 8% * (540000/1095000) ≈ 0.0394 ETH
        // Allowing some precision tolerance
        assertApproxEqRel(interest, 0.0394 ether, 0.01 ether); // 1% tolerance
        
        uint256 totalRepayment = ProtocolConfig.calculateTotalRepayment(
            principal,
            interestRate,
            duration,
            blocksPerYear
        );
        
        assertEq(totalRepayment, principal + interest);
        
        console.log("Principal:", principal);
        console.log("Interest calculated:", interest);
        console.log("Total repayment:", totalRepayment);
    }
    
    function testValidationFunctions() public {
        // Test timelock ordering
        assertTrue(ProtocolConfig.validateTimelockOrdering());
        
        // Test loan amount validation
        assertTrue(ProtocolConfig.validateLoanAmount(0.1 ether));  // Valid
        assertTrue(ProtocolConfig.validateLoanAmount(1 ether));    // Valid
        assertFalse(ProtocolConfig.validateLoanAmount(0.001 ether)); // Too small
        assertFalse(ProtocolConfig.validateLoanAmount(1000 ether));  // Too large
        
        // Test interest rate validation
        assertTrue(ProtocolConfig.validateInterestRate(500));  // 5% - valid
        assertTrue(ProtocolConfig.validateInterestRate(800));  // 8% - valid
        //assertFalse(ProtocolConfig.validateInterestRate(50));  // 0.5% - too small
        assertFalse(ProtocolConfig.validateInterestRate(3000)); // 30% - too large
        
        console.log("Timelock ordering valid:", ProtocolConfig.validateTimelockOrdering());
        console.log("Loan amount 1 ETH valid:", ProtocolConfig.validateLoanAmount(1 ether));
        console.log("Interest rate 8% valid:", ProtocolConfig.validateInterestRate(800));
    }
    
    function testNetworkDetection() public {
        // The test will run on Anvil (chain ID 31337)
        string memory network = ProtocolConfig.getCurrentNetwork();
        
        assertTrue(ProtocolConfig.isDevelopmentNetwork());
        assertFalse(ProtocolConfig.isTestnetNetwork());
        assertFalse(ProtocolConfig.isMainnetNetwork());
        
        // Should be "anvil-local" for chain ID 31337
        assertEq(network, "anvil-local");
        
        console.log("Current network:", network);
        console.log("Is development:", ProtocolConfig.isDevelopmentNetwork());
    }
    
    // ============ TEST EDGE CASES ============
    
    function testZeroLoanAmount() public {
        assertFalse(ProtocolConfig.validateLoanAmount(0));
        
        uint256 originFee = ProtocolConfig.calculateOriginationFee(0);
        uint256 lenderBond = ProtocolConfig.calculateLenderBond(0);
        
        assertEq(originFee, 0);
        assertEq(lenderBond, 0);
    }
    
    function testMaxValues() public {
        uint256 maxLoan = ProtocolConfig.getMaxLoanAmount();
        
        assertTrue(ProtocolConfig.validateLoanAmount(maxLoan));
        
        uint256 originFee = ProtocolConfig.calculateOriginationFee(maxLoan);
        uint256 lenderBond = ProtocolConfig.calculateLenderBond(maxLoan);
        
        // Max loan is 100 ETH, so origin fee should be 1 ETH and bond 10 ETH
        assertEq(originFee, 1 ether);
        assertEq(lenderBond, 10 ether);
        
        console.log("Max loan amount:", maxLoan);
        console.log("Origin fee for max loan:", originFee);
        console.log("Lender bond for max loan:", lenderBond);
    }
    
    function testDefaultInterestCalculation() public {
        uint256 principal = 10 ether;
        uint256 defaultRate = ProtocolConfig.getDefaultInterestRateBps();
        uint256 fullDuration = ProtocolConfig.getLoanDuration();
        
        uint256 interest = ProtocolConfig.calculateInterest(
            principal,
            defaultRate,
            fullDuration,
            0  // Use default blocks per year
        );
        
        // Should calculate interest for 10 ETH at 8% for 6 months
        // Expected: ~0.394 ETH (10 * 0.08 * 0.493)
        assertTrue(interest > 0);
        assertTrue(interest < principal); // Interest should be less than principal for 6 months
        
        console.log("Interest for 10 ETH, 8%, 6 months:", interest);
    }
    
    // ============ TEST INTEGRATION WITH EXISTING CONSTANTS ============
    
    function testCompatibilityWithExistingContract() public {
        // Test that our config values match what's currently in BtcCollateralLoan.sol
        
        // These should match the hardcoded values in the existing contract
        assertEq(ProtocolConfig.getProcessingFee(), 0.001 ether);
        assertEq(ProtocolConfig.getMinLoanAmount(), 0.005 ether);
        assertEq(ProtocolConfig.getOriginFeePercentage(), 1);
        assertEq(ProtocolConfig.getLenderBondPercentage(), 10);
        
        console.log("All constants match existing BtcCollateralLoan contract values");
    }
    
    function testTimelockConstraints() public {
        // Test the constraints mentioned in BtcCollateralLoan.sol comments
        uint256 t_B = ProtocolConfig.getTimelockLoanReq();
        uint256 t_0 = ProtocolConfig.getTimelockBtcEscrow();
        uint256 t_L = ProtocolConfig.getTimelockRepaymentAccept();
        uint256 t_1 = ProtocolConfig.getTimelockBtcCollateral();
        uint256 t_D = ProtocolConfig.getLoanDuration();
        // From contract: t_0 must > t_B and t_1 must > t_L
        assertTrue(t_0 > t_B, "t_0 must be greater than t_B");
        assertTrue(t_1 > t_L + t_D, "t_1 must be greater than t_L + t_D");
        
        console.log("All timelock constraints satisfied");
        console.log("t_0 value:", t_0);
        console.log("t_B value:", t_B);
        console.log("t_0 > t_B:", t_0 > t_B);
        console.log("t_1 value:", t_1);
        console.log("t_L value:", t_L);
        console.log("t_1 > t_L:", t_1 > t_L);
        console.log("t_D value:", t_D);
        console.log("t_1 > t_L + t_D:", t_1 > t_L + t_D);
    }
}
