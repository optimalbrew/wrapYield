// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../lib/forge-std/src/Test.sol";
import "../src/BtcCollateralLoan.sol";
import "../src/EtherSwap.sol";
import "../src/LoanFactory.sol"; //used for testing. Deploying will fail due to large contract size.

contract BtcCollateralLoanTest is Test {
    BtcCollateralLoan public loan;
    EtherSwap public etherSwap;
    LoanFactory public factory;
    
    address public lender;
    address public borrower;
    address public borrower2;
    
    // Test data - 32 bytes (64 char hex string) each for pubkeys, 63 or 64 char for address (not hex)
    string public constant LENDER_BTC_PUBKEY = "12345678901234567890123456789012abcdef0123456789abcdef0123456789";
    string public constant BORROWER_BTC_PUBKEY = "abcdef0123456789abcdef012345678912345678901234567890123456789012";
    // this is NOT a HEX string, it is a base58 encoded address. Actual validity is not checked.
    string public constant BORROWER_BTC_ADDRESS = "bcrt1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5j";
    bytes32 public constant BORROWER_P2TR0_TXID = 0x0000000000000000000000000000000000000000000000000000000000000001;
    uint32 public constant BORROWER_P2TR0_VOUT = 1;
    
    uint256 public constant LOAN_AMOUNT = 1 ether;
    uint256 public constant PROCESSING_FEE = 0.001 ether;
    uint256 public constant MIN_LOAN_AMOUNT = 0.005 ether;

    uint256 public constant LENDER_BOND_PERCENTAGE = 10;
    
    // Timelocks and duration (in blocks)
    uint256 public constant LOAN_DURATION = 3000*180; //approx 6 months on rootstock
    uint256 public constant TIMELOCK_LOAN_REQ = 100;
    uint256 public constant TIMELOCK_BTC_ESCROW = 200;
    uint256 public constant TIMELOCK_REPAYMENT_ACCEPT = 150;
    uint256 public constant TIMELOCK_BTC_COLLATERAL = LOAN_DURATION + 288; //288 bitcoin blocks (approx 2 days)

    
    // Preimages and hashes
    bytes32 public preimageBorrower = keccak256("borrower_preimage");
    bytes32 public preimageLender = keccak256("lender_preimage");
    bytes32 public preimageHashBorrower = sha256(abi.encodePacked(preimageBorrower));
    bytes32 public preimageHashLender = sha256(abi.encodePacked(preimageLender));
    
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress);
    event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 amount, uint256 bondAmount);
    event LoanActivated(uint256 indexed loanId, address indexed borrower);
    event RepaymentAttempted(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event RepaymentAccepted(uint256 indexed loanId, address indexed lender);
    event LoanDeleted(uint256 indexed loanId, address indexed borrower);
    event EtherSwapAddressSet(address indexed etherSwapAddress);

    function setUp() public {
        lender = makeAddr("lender");
        borrower = makeAddr("borrower");
        borrower2 = makeAddr("borrower2");
        
        // Fund test accounts with ETH
        vm.deal(lender, 100 ether);
        vm.deal(borrower, 100 ether);
        vm.deal(borrower2, 100 ether);
        
        // Deploy factory and contracts as lender
        factory = new LoanFactory();
        vm.startPrank(lender);
        (address etherSwapAddress, address loanAddress) = factory.deployContracts(
            LENDER_BTC_PUBKEY,
            LOAN_DURATION,
            TIMELOCK_LOAN_REQ,
            TIMELOCK_BTC_ESCROW,
            TIMELOCK_REPAYMENT_ACCEPT,
            TIMELOCK_BTC_COLLATERAL
        );
        vm.stopPrank();
        
        loan = BtcCollateralLoan(payable(loanAddress));
        etherSwap = EtherSwap(etherSwapAddress);
    }

    // ============ HELPER FUNCTIONS ============

    function assertLoanStatus(BtcCollateralLoan.Loan memory loanData, BtcCollateralLoan.LoanStatus expectedStatus) internal pure {
        assertEq(uint8(loanData.status), uint8(expectedStatus));
    }

    function requestLoan(address _borrower, uint256 _amount) internal returns (uint256) {
        vm.startPrank(_borrower);
        loan.requestLoan{value: PROCESSING_FEE}(
            _amount,
            BORROWER_BTC_ADDRESS,
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        uint256 loanId = loan.getTotalLoans();
        vm.stopPrank();
        return loanId;
    }

    function offerLoan(uint256 _loanId) internal {
        vm.startPrank(lender);
        loan.extendLoanOffer{value: LOAN_AMOUNT + (LOAN_AMOUNT * LENDER_BOND_PERCENTAGE) / 100}(
            _loanId,
            preimageHashBorrower,
            preimageHashLender
        );
        vm.stopPrank();
    }

    function acceptLoan(uint256 _loanId) internal {
        vm.startPrank(borrower);
        loan.acceptLoanOffer(_loanId, preimageBorrower);
        vm.stopPrank();
    }

    function attemptRepayment(uint256 _loanId) internal {
        vm.startPrank(borrower);
        loan.attemptRepayment{value: LOAN_AMOUNT}(_loanId, preimageHashLender);
        vm.stopPrank();
    }

    // ============ CONSTRUCTOR TESTS ============

    function testConstructor() public view {
        assertEq(loan.lenderBtcPubkey(), LENDER_BTC_PUBKEY);
        assertEq(loan.loanDuration(), LOAN_DURATION);
        assertEq(loan.timelockLoanReq(), TIMELOCK_LOAN_REQ);
        assertEq(loan.timelockBtcEscrow(), TIMELOCK_BTC_ESCROW);
        assertEq(loan.timelockRepaymentAccept(), TIMELOCK_REPAYMENT_ACCEPT);
        assertEq(loan.timelockBtcCollateral(), TIMELOCK_BTC_COLLATERAL);
        assertEq(loan.getTotalLoans(), 0);
    }

    function testConstructorInvalidBtcPubkey() public {
        vm.expectRevert("Loan: inval BTC pubkey");
        new BtcCollateralLoan(
            "0x123456789012345678901234567890123456789012345678901234567890123", // 31 bytes
            LOAN_DURATION,
            TIMELOCK_LOAN_REQ,
            TIMELOCK_BTC_ESCROW,
            TIMELOCK_REPAYMENT_ACCEPT,
            TIMELOCK_BTC_COLLATERAL
        );
    }

    // ============ SETTER TESTS ============

    function testSetEtherSwapAddressAlreadySet() public {
        address newEtherSwap = makeAddr("newEtherSwap");
        
        vm.startPrank(lender);
        vm.expectRevert("Loan: EtherSwap addr already set");
        loan.setEtherSwapAddress(newEtherSwap);
        vm.stopPrank();
    }

    // ============ LOAN REQUEST TESTS ============

    function testRequestLoan() public {
        vm.startPrank(borrower);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit LoanRequested(1, borrower, LOAN_AMOUNT, BORROWER_BTC_ADDRESS);
        
        loan.requestLoan{value: PROCESSING_FEE}(
            LOAN_AMOUNT,
            BORROWER_BTC_ADDRESS,
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        
        vm.stopPrank();
        
        assertEq(loan.getTotalLoans(), 1);
        assertEq(loan.getLoanIdByBorrower(borrower), 1);
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(1);
        assertEq(loanData.borrowerAddr, borrower);
        assertEq(loanData.amount, LOAN_AMOUNT);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Requested);
    }

    function testRequestLoanInsufficientFee() public {
        vm.startPrank(borrower);
        
        vm.expectRevert("Loan: insuff proc fee");
        loan.requestLoan{value: PROCESSING_FEE - 0.0001 ether}(
            LOAN_AMOUNT,
            BORROWER_BTC_ADDRESS,
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        
        vm.stopPrank();
    }

    function testRequestLoanBelowMinimum() public {
        vm.startPrank(borrower);
        
        vm.expectRevert("Loan: amt must be > min");
        loan.requestLoan{value: PROCESSING_FEE}(
            MIN_LOAN_AMOUNT - 0.001 ether,
            BORROWER_BTC_ADDRESS,
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        
        vm.stopPrank();
    }

    function testRequestLoanInvalidBtcAddress() public {
        vm.startPrank(borrower);
        
        vm.expectRevert("Loan: inval P2TR addr");
        loan.requestLoan{value: PROCESSING_FEE}(
            LOAN_AMOUNT,
            "invalid_address",
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        
        vm.stopPrank();
    }

    function testRequestLoanInvalidBtcPubkey() public {
        vm.startPrank(borrower);
        
        vm.expectRevert("Loan: inval BTC pubkey");
        loan.requestLoan{value: PROCESSING_FEE}(
            LOAN_AMOUNT,
            BORROWER_BTC_ADDRESS,
            "0x1234", // Too short
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        
        vm.stopPrank();
    }

    function testRequestLoanBorrowerAlreadyHasLoan() public {
        // Request first loan
        requestLoan(borrower, LOAN_AMOUNT);
        
        // Try to request second loan
        vm.startPrank(borrower);
        vm.expectRevert("Loan: borrower has active loan");
        loan.requestLoan{value: PROCESSING_FEE}(
            LOAN_AMOUNT,
            BORROWER_BTC_ADDRESS,
            BORROWER_BTC_PUBKEY,
            preimageHashBorrower,
            BORROWER_P2TR0_TXID,
            BORROWER_P2TR0_VOUT
        );
        vm.stopPrank();
    }

    // ============ LOAN OFFER TESTS ============

    function testExtendLoanOffer() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        
        vm.startPrank(lender);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit LoanOffered(loanId, lender, LOAN_AMOUNT, (LOAN_AMOUNT * LENDER_BOND_PERCENTAGE) / 100);
        
        loan.extendLoanOffer{value: LOAN_AMOUNT + (LOAN_AMOUNT * LENDER_BOND_PERCENTAGE) / 100}(
            loanId,
            preimageHashBorrower,
            preimageHashLender
        );
        
        vm.stopPrank();
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Offered);
        assertEq(loanData.bondAmount, (LOAN_AMOUNT * 10) / 100);
    }

    function testExtendLoanOfferOnlyLender() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        
        vm.startPrank(borrower);
        vm.expectRevert("Loan: caller not lender");
            loan.extendLoanOffer{value: LOAN_AMOUNT + (LOAN_AMOUNT * LENDER_BOND_PERCENTAGE) / 100}(
            loanId,
            preimageHashBorrower,
            preimageHashLender
        );
        vm.stopPrank();
    }

    function testExtendLoanOfferWrongStatus() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        
        vm.startPrank(lender);
        //once the loan is offered, the lender cannot extend the offer again
        vm.expectRevert("Loan: incorrect status");
        loan.extendLoanOffer{value: LOAN_AMOUNT + (LOAN_AMOUNT * LENDER_BOND_PERCENTAGE) / 100}(
            loanId,
            preimageHashBorrower,
            preimageHashLender
        );
        vm.stopPrank();
    }

    // ============ LOAN ACCEPTANCE TESTS ============

    function testAcceptLoanOffer() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        
        //borrower balance before accepting the loan
        uint256 borrowerBalanceBefore = borrower.balance;

        vm.startPrank(borrower);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit LoanActivated(loanId, borrower);
        
        loan.acceptLoanOffer(loanId, preimageBorrower);
        
        vm.stopPrank();
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Active);
        
        // Check that loan amount was sent + processing fee was reimbursed
        assertEq(borrower.balance - borrowerBalanceBefore, LOAN_AMOUNT + PROCESSING_FEE);
    }

    function testAcceptLoanOfferWrongBorrower() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        
        vm.startPrank(borrower2);
        vm.expectRevert("Loan: caller not borrower");
        loan.acceptLoanOffer(loanId, preimageBorrower);
        vm.stopPrank();
    }

    // ============ REPAYMENT TESTS ============

    function testAttemptRepayment() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        
        //borrower balance before attempting repayment
        uint256 borrowerBalanceBefore = borrower.balance;

        vm.startPrank(borrower);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit RepaymentAttempted(loanId, borrower, LOAN_AMOUNT);
        
        loan.attemptRepayment{value: LOAN_AMOUNT}(loanId, preimageHashLender);
        
        vm.stopPrank();
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.RepaymentInProgress);
        assertEq(borrowerBalanceBefore - borrower.balance, LOAN_AMOUNT);
    }

    function testAttemptRepaymentFromAnyone() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        vm.startPrank(borrower2);
        // borrower2 can repay, but to recover BTC collateral, it is still borrower 1 who needs to sign & add preimagelender (if revealed)
        vm.expectEmit(true, true, false, true, address(loan));
        emit RepaymentAttempted(loanId, borrower2, LOAN_AMOUNT);
        loan.attemptRepayment{value: LOAN_AMOUNT}(loanId, preimageHashLender);
        vm.stopPrank();
    }

    function testAttemptRepaymentWrongAmount() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        
        vm.startPrank(borrower);
        vm.expectRevert("Loan: incorrect rpmt amt");
        loan.attemptRepayment{value: LOAN_AMOUNT - 0.1 ether}(loanId, preimageHashLender);
        vm.stopPrank();
    }

    function testAttemptRepaymentPastDue() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        vm.roll(block.number + LOAN_DURATION + 1); //use `vmwarp()` if switching to timestamp instead of block number
        vm.startPrank(borrower);
        vm.expectRevert("Loan: past due");
        loan.attemptRepayment{value: LOAN_AMOUNT}(loanId, preimageHashLender);
        vm.stopPrank();
    }

    function testAcceptRepayment() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        attemptRepayment(loanId);

        //lender balance before accepting the repayment
        uint256 lenderBalanceBefore = lender.balance;

        vm.startPrank(lender);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit RepaymentAccepted(loanId, lender);
        
        loan.acceptLoanRepayment(loanId, preimageLender);
        
        vm.stopPrank();
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Repaid);
        assertEq(lender.balance - lenderBalanceBefore, LOAN_AMOUNT);
    }
    // ============ MARK AS DEFAULTED TESTS ============

    function testMarkAsDefaulted() public {
        //lender balance before requesting the loan
        uint256 lenderBalancePreLoan = lender.balance;

        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        vm.roll(block.number + LOAN_DURATION + 1); //use `vmwarp()` if switching to timestamp instead of block number
        vm.startPrank(lender);
        loan.markAsDefaulted(loanId);
        vm.stopPrank();
        assertLoanStatus(loan.getLoan(loanId), BtcCollateralLoan.LoanStatus.Defaulted);
        //bond is back, but not loan (can capture collateral
        assertEq(lenderBalancePreLoan - lender.balance, LOAN_AMOUNT);
    }

    // ============ DELETION TESTS ============

    function testDeleteCompletedLoan() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        attemptRepayment(loanId);
        
        vm.startPrank(lender);
        loan.acceptLoanRepayment(loanId, preimageLender);
        vm.stopPrank();
        
        // Delete the loan
        vm.startPrank(borrower);
        
        vm.expectEmit(true, true, false, true, address(loan));
        emit LoanDeleted(loanId, borrower);
        
        loan.deleteCompletedLoan(loanId);
        
        vm.stopPrank();
        
        // Verify loan is deleted
        loan.getLoan(loanId);
        //check loan.borrowerAddr is 0x0000000000000000000000000000000000000000
        assertEq(loan.getLoan(loanId).borrowerAddr, address(0));
        
    }

    function testDeleteActiveLoanFails() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        offerLoan(loanId);
        acceptLoan(loanId);
        
        vm.startPrank(borrower);
        vm.expectRevert("Loan: cant delete active loan");
        loan.deleteCompletedLoan(loanId);
        vm.stopPrank();
    }

    // ============ INTEGRATION TESTS ============

    function testCompleteLoanFlow() public {
        // 1. Request loan
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        assertEq(loan.getTotalLoans(), 1);
        
        // 2. Offer loan
        offerLoan(loanId);
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Offered);
        
        // 3. Accept loan
        acceptLoan(loanId);
        loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Active);
        
        // 4. Attempt repayment
        attemptRepayment(loanId);
        loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.RepaymentInProgress);
        
        // 5. Accept repayment
        vm.startPrank(lender);
        loan.acceptLoanRepayment(loanId, preimageLender);
        vm.stopPrank();
        
        loanData = loan.getLoan(loanId);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Repaid);
        
        // 6. Delete loan
        vm.startPrank(borrower);
        loan.deleteCompletedLoan(loanId);
        vm.stopPrank();
        
        // Verify loan is deleted and borrower can request new loan
        assertEq(loan.getLoanIdByBorrower(borrower), 0);
        requestLoan(borrower, LOAN_AMOUNT);
    }

    // ============ VIEW FUNCTION TESTS ============

    function testGetLoan() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        
        BtcCollateralLoan.Loan memory loanData = loan.getLoan(loanId);
        assertEq(loanData.borrowerAddr, borrower);
        assertEq(loanData.amount, LOAN_AMOUNT);
        assertLoanStatus(loanData, BtcCollateralLoan.LoanStatus.Requested);
    }

    function testGetLoanNonexistent() public {
        vm.expectRevert("Loan: loan does not exist");
        loan.getLoan(999);
    }

    function testGetTotalLoans() public {
        assertEq(loan.getTotalLoans(), 0);
        
        requestLoan(borrower, LOAN_AMOUNT);
        assertEq(loan.getTotalLoans(), 1);
        
        requestLoan(borrower2, LOAN_AMOUNT);
        assertEq(loan.getTotalLoans(), 2);
    }

    function testGetLoanIdByBorrower() public {
        uint256 loanId = requestLoan(borrower, LOAN_AMOUNT);
        assertEq(loan.getLoanIdByBorrower(borrower), loanId);
        assertEq(loan.getLoanIdByBorrower(borrower2), 0);
    }

    // ============ EMERGENCY TESTS ============

    function testEmergencyWithdraw() public {
        // Send some ETH to contract
        payable(address(loan)).transfer(1 ether);
        
        uint256 initialBalance = lender.balance;
        
        vm.startPrank(lender);
        loan.emergencyWithdraw();
        vm.stopPrank();
        
        assertEq(lender.balance, initialBalance + 1 ether);
        assertEq(address(loan).balance, 0);
    }

    function testEmergencyWithdrawOnlyLender() public {
        payable(address(loan)).transfer(1 ether);
        
        vm.startPrank(borrower);
        vm.expectRevert("Loan: caller not lender");
        loan.emergencyWithdraw();
        vm.stopPrank();
    }

    function testEmergencyWithdrawNoBalance() public {
        vm.startPrank(lender);
        vm.expectRevert("Loan: no ETH to withdraw");
        loan.emergencyWithdraw();
        vm.stopPrank();
    }

    // ============ RECEIVE FUNCTION TESTS ============

    function testReceive() public {
        payable(address(loan)).transfer(1 ether);
        assertEq(address(loan).balance, 1 ether);
    }

    // // ============ BITCOIN UTILITY FUNCTIONS ============

    // function testExtractTimestamp() public view {
    //     //for block 908894, timestamp is 1754503783
    //     bytes memory header = hex"0000602055e3bbd59b2c8cfe50aa38a44345b552c617cf62324f01000000000000000000ce5aea68c318b6fb4cf850d5998745211a13eeb03ce20b62bc7c9b514112420e679a93689e3402172b2917c7";
    //     uint32 timestamp = loan.extractTimestamp(header);
    //     assertEq(timestamp, 1754503783); //2025-08-06 12:09:43 UTC
    // }

    // function testExtractTimestampHeaderTooLong() public {
    //     //header is too long
    //     bytes memory header = hex"000000602055e3bbd59b2c8cfe50aa38a44345b552c617cf62324f01000000000000000000ce5aea68c318b6fb4cf850d5998745211a13eeb03ce20b62bc7c9b514112420e679a93689e3402172b2917c7";
    //     vm.expectRevert("Invalid hdr len");
    //     loan.extractTimestamp(header);
    // }   

    // function testExtractTimestampHeaderTooShort() public {
    //     //header is too short
    //     bytes memory header = hex"602055e3bbd59b2c8cfe50aa38a44345b552c617cf62324f01000000000000000000ce5aea68c318b6fb4cf850d5998745211a13eeb03ce20b62bc7c9b514112420e679a";
    //     vm.expectRevert("Invalid hdr len");
    //     loan.extractTimestamp(header);
    // }

} 