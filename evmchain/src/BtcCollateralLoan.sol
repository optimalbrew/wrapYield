// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./EtherSwap.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Bitcoin-Collateralized Loan Contract
 * @dev A smart contract for handling collateralized loans where Bitcoin is used as collateral
 * The contract integrates with EtherSwap.sol (from Boltz.exchange) for atomic swaps between Bitcoin and Ethereum
 * These are not really swaps in the sense that the bitcoin collateral will remain in joint custody
 * Such details about the bitcoin side of things are treated as external data here.
 * e.g. the preimage hash of the borrower's preimage is used by lender to commit btc to collateral address,
 * but this is only possible because the borrower has signed a pre-signed btc tx with the lender's public key.
 * Such details are explained in the project documentation
 * The borrower can reclaim the collateral only if the loan is repaid successfully.
 * If the borrower defaults, the lender will get the collateral
 * While HTLCs make atomicity possible, they cannot guarantee participation of both parties.
 * Thus, if the lender does not accept loan repayment, then the borrower cannot reclaim the collateral.
 * In this case, the borrower can recover their attempted repayment, and also slash the lender's bond.
 * The loans are meant to be in rBTC for use in Rootstock (1:1 peg with BTC), so a price oracle is not required.
 * There is no possibility of liquidation of LTV going over 100%.
 * When used in other chains, an oracle will be needed for pricing (e.g. ETH 2 BTC) and liquidation mechanisms
 * will need to be implemented.
 */
contract BtcCollateralLoan is Ownable, ReentrancyGuard {
    // ============ STATE VARIABLES ============

    /// @dev The EtherSwap contract instance
    EtherSwap public etherSwap;

    /// @dev Current lender's Bitcoin Schnorr (x only) public key, 32 bytes (assumed valid, only solidity length check)
    string public lenderBtcPubkey;

    /// @dev Contract parameters
    uint256 public constant PROCESSING_FEE = 0.001 ether;
    /// rBTC (about $100) refundable processing fee (spam prevention)
    uint256 public constant MIN_LOAN_AMOUNT = 0.005 ether;
    /// rBTC (about $500) Minimum loan amount

    /// 1% Origin fee for activated loan, used on bitcoin side
    uint256 public constant ORIGIN_FEE_PERCENTAGE_DIVISOR = 1000;

    /// 10% lender bond percentage
    uint256 public constant LENDER_BOND_PERCENTAGE = 10;

    /// Lender bond percentage (10% of loan amount)

    //todo: Ensure that changes to these parameters do not affect active loans
    uint256 public timelockLoanReq; // t_B (shorter than t_O) // enforced on the evm side
    
    //this needs to be conservatively large, so that once expressed in bitcoin blocks (e.g. 1:20 ratio), it is 
    // still large enoughto ensure it does not lead to situations where the borrower has custody of both
    // the BTC collateral and the EVM chain loan at the same time.
    uint256 public timelockBtcEscrow; // t_0 // enforced on the bitcoin side, should not be used here
    
    uint256 public timelockRepaymentAccept; // t_L // enforced on the evm side
    
    //this can safely be very large. Also needs to be converted to bitcoin blocks using a ratio e.g. 1:20
    uint256 public timelockBtcCollateral; // t_1 (longer than t_L) // enforced on the bitcoin side, not used here

    /// @dev Duration starts once loan is activated. e.g. 3000*180 blocks (6 months on rootstock)
    uint256 public loanDuration; //t_D, needs to be earlier than t_1 (which is when BTC collateral is released to lender)
  
    /// @dev currently unused.
    uint256 public loanInterestRate;

    /// @dev Loan counter: This is total number of loans requested thus far, not the actual number outstanding or issued
    uint256 private _loanIds;

    // ============ ENUMS ============

    enum LoanStatus {
        Requested, // Loan request submitted
        Offered, // Lender has offered the loan
        Active, // Borrower claimed loan using their preimage -> which is used by lender on bitcoin side
        RefundedToLender, // Initial loan setup failed, refund to lender
        RepaymentInProgress, // Borrower initiated repayment, pending lender acceptance
        Repaid, // Lender claimed repayment using their preimage -> which is used by borrower on bitcoin side
        RefundedToBorrower, // Lender didn't accept repayment (loses bond, but gets BTC collateral)
        Defaulted // Borrower defaulted, lender gets BTC collateral, lender gets bond back

    }

    // ============ STRUCTS ============
    // todo: check if this is the best way to store the data, do that once the struct members are finalized
    struct Loan {
        address borrowerAddr; //borrower EVM address
        string borrowerBtcPubkey; //borrower's bitcoin Schnorr (x only) public key, 32 bytes
        uint256 amount; //loan amount
        uint256 collateralAmount; //collateral amount @todo: may not be needed
        uint256 bondAmount; //lender's bond amount
        LoanStatus status; //loan status
        bytes32 preimageHashBorrower; //borrower's preimage hash
        bytes32 preimageHashLender; //lender's preimage hash
        uint256 requestBlockheight;
        uint256 offerBlockheight;
        uint256 activationBlockheight;
        uint256 repaymentBlockheight;
    }

    // ============ MAPPINGS ============

    /**
     * @dev Mapping from loan ID to loan struct
     * this is the main identifier
     */
    mapping(uint256 => Loan) public loans;

    /**
     * @dev Mapping from borrower address to loan ID. Enables reverse lookup of loan ID by borrower address.
     * which is useful for offchain systems and frontends.
     */
    mapping(address => uint256) public borrowerToLoanId;

    // ============ EVENTS ============

    event LenderUpdated(address indexed lender, string btcPubkey);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress);
    event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 amount, uint256 bondAmount);
    event LoanActivated(uint256 indexed loanId, address indexed borrower);
    event LoanRefundedToLender(uint256 indexed loanId, address indexed lender);
    event RepaymentAttempted(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event RepaymentAccepted(uint256 indexed loanId, address indexed lender);
    event RepaymentRefundedToBorrowerWithBond(uint256 indexed loanId, address indexed borrower, uint256 bondAmount);
    event ParametersUpdated(
        uint256 loanDuration,
        uint256 timelockLoanReq,
        uint256 timelockBtcEscrow,
        uint256 timelockRepaymentAccept,
        uint256 timelockBtcCollateral
    );
    event LoanDefaulted(uint256 indexed loanId, address indexed lender, uint256 bondAmount);
    event LoanDeleted(uint256 indexed loanId, address indexed borrower);
    event EtherSwapAddressSet(address indexed etherSwapAddress);

    // ============ MODIFIERS ============

    modifier onlyLender() {
        require(msg.sender == owner(), "Loan: caller not lender");
        _;
    }

    modifier loanExists(uint256 loanId) {
        //Note: this just checks for valid index as fast fail. If a loan has been deleted, it will not be in the mapping
        // but solidity will not revert and will return a default value for the struct.
        require(loanId > 0 && loanId <= _loanIds, "Loan: does not exist");
        _;
    }

    modifier correctLoanStatus(uint256 loanId, LoanStatus expectedStatus) {
        require(loans[loanId].status == expectedStatus, "Loan: incorrect status");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(
        string memory _lenderBtcPubkey, // Schnorr (x only) public key, 32 bytes (64 char hex string)
        uint256 _loanDuration,
        uint256 _timelockLoanReq,
        uint256 _timelockBtcEscrow,
        uint256 _timelockRepaymentAccept,
        uint256 _timelockBtcCollateral
    ) Ownable(msg.sender) {
        require(bytes(_lenderBtcPubkey).length == 64, "Loan: inval BTC pubkey"); //need x only pubkey

        lenderBtcPubkey = _lenderBtcPubkey;
        loanDuration = _loanDuration;
        timelockLoanReq = _timelockLoanReq;
        timelockBtcEscrow = _timelockBtcEscrow;
        timelockRepaymentAccept = _timelockRepaymentAccept;
        timelockBtcCollateral = _timelockBtcCollateral;
    }

    // ============ SETTER FUNCTIONS ============

    /**
     * @dev Set the EtherSwap contract address (only lender can call)
     * @param _etherSwapAddress The EtherSwap contract address
     * this will lock in a specific etherswap version. updates will not be possible.
     * Todo: production app should allow updates - but be careful about contract storage
     * perhaps use proxy patterns
     */
    function setEtherSwapAddress(address _etherSwapAddress) external onlyLender {
        require(_etherSwapAddress != address(0), "Loan: inval EtherSwap addr");
        require(address(etherSwap) == address(0), "Loan: EtherSwap addr already set");
        
        etherSwap = EtherSwap(_etherSwapAddress);
        emit EtherSwapAddressSet(_etherSwapAddress);
    }

    // ============ LENDER FUNCTIONS ============

    /**
     * @dev Update lender's Bitcoin public key
     * @param newBtcPubkey New Bitcoin public key (64 char hex string)  
     */
    function updateLenderBtcPubkey(string memory newBtcPubkey) external onlyLender {
        require(bytes(newBtcPubkey).length == 64, "Loan: inval BTC pubkey"); //need x only pubkey
        lenderBtcPubkey = newBtcPubkey;
        emit LenderUpdated(msg.sender, newBtcPubkey);
    }

    /**
     * @dev Update contract parameters (only lender can call)
     * how will this impact active loans?
     */
    function updateParameters(
        uint256 _loanDuration,
        uint256 _timelockLoanReq,
        uint256 _timelockBtcEscrow,
        uint256 _timelockRepaymentAccept,
        uint256 _timelockBtcCollateral
    ) external onlyLender {
        require(_timelockBtcEscrow > _timelockLoanReq, "Loan: t_0 must > t_B");
        require(_timelockBtcCollateral > _timelockRepaymentAccept, "Loan: t_1 must > t_L");

        loanDuration = _loanDuration;
        timelockLoanReq = _timelockLoanReq;
        timelockBtcEscrow = _timelockBtcEscrow;
        timelockRepaymentAccept = _timelockRepaymentAccept;
        timelockBtcCollateral = _timelockBtcCollateral;

        emit ParametersUpdated(_loanDuration, _timelockLoanReq, _timelockBtcEscrow, _timelockRepaymentAccept, _timelockBtcCollateral);
    }

    /**
     * @dev Extend loan offer by locking funds in EtherSwap
     * @param loanId The loan ID to offer
     * @param preimageHashBorrower hash of preimage chosen by borrower, when revealed lender uses to commit btc to collateral address
     * @param preimageHashLender hash of preimage chosen by lender, when revealed borrower uses to claim BTC from collateral address
     */
    function extendLoanOffer(uint256 loanId, bytes32 preimageHashBorrower, bytes32 preimageHashLender)
        external
        payable
        onlyLender
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.Requested)
        nonReentrant
    {
        Loan storage loan = loans[loanId];
    
        uint256 bondAmount = (loan.amount * LENDER_BOND_PERCENTAGE) / 100;
        require(msg.value == loan.amount + bondAmount, "Loan: incorrect value sent");

        // Lock the loan amount in EtherSwap
        uint256 timelock = block.number + timelockLoanReq;
        etherSwap.lock{value: loan.amount}(preimageHashBorrower, address(this), timelock);

        //lock the lender's bond amount in loan contract
        payable(address(this)).transfer(bondAmount);

        // Update loan state
        loan.status = LoanStatus.Offered;
        loan.preimageHashBorrower = preimageHashBorrower;
        loan.preimageHashLender = preimageHashLender;
        loan.bondAmount = bondAmount;
        loan.offerBlockheight = block.number;

        emit LoanOffered(loanId, msg.sender, loan.amount, bondAmount);
    }

    /**
     * @dev Withdraw loan offer (refund from EtherSwap)
     * @param loanId The loan ID to withdraw
     */
    function withdrawLoanOffer(uint256 loanId)
        external
        onlyLender
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.Offered)
        nonReentrant
    {
        Loan storage loan = loans[loanId];

        // Refund from EtherSwap
        uint256 timelock = block.number + timelockLoanReq;
        etherSwap.refund(loan.preimageHashBorrower, loan.amount, address(this), timelock);

        // Update loan state
        loan.status = LoanStatus.RefundedToLender;

        emit LoanRefundedToLender(loanId, msg.sender);
    }

    /**
     * @dev Accept loan repayment by claiming from EtherSwap
     * @param loanId The loan ID
     * @param preimageLender The preimage (chosen by lender) for accepting the repayment.
     */
    function acceptLoanRepayment(uint256 loanId, bytes32 preimageLender)
        external
        onlyLender
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.RepaymentInProgress)
        nonReentrant
    {
        Loan storage loan = loans[loanId];

        // Claim repayment from EtherSwap
        uint256 timelock = loan.repaymentBlockheight + timelockRepaymentAccept;
        etherSwap.claim(preimageLender, loan.amount, address(this), address(this), timelock);

        //if above is successful, then the claimed ether is sent to the lender
        payable(msg.sender).transfer(loan.amount); 

        // Update loan state
        loan.status = LoanStatus.Repaid;

        emit RepaymentAccepted(loanId, msg.sender);
    }

    /**
     * @dev Mark loan as defaulted and withdraw lender's bond if loan is not repaid within timelockRepaymentAccept
     * @param loanId The loan ID
     */
    function markAsDefaulted(uint256 loanId)
        external
        onlyLender
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.Active)
        nonReentrant
    {
        Loan storage loan = loans[loanId];
        require(
            //this should use block number
            block.number > loan.activationBlockheight + loanDuration,
            "Loan: cannot mark defaulted yet"
        );
        loan.status = LoanStatus.Defaulted;

        //return the lender's bond
        payable(msg.sender).transfer(loan.bondAmount);

        emit LoanDefaulted(loanId, msg.sender, loan.bondAmount);
    }

    // ============ BORROWER FUNCTIONS ============

    /**
     * @dev Request a loan
     * @param amount The loan amount in ETH
     * @param btcAddress The Bitcoin address for escrow (p2TR so 62 chars or 63 max in regtest)
     * @param btcPubkey The borrower's Bitcoin Schnorr (x only) public key, 32 bytes
     * @param preimageHashBorrower hash of preimage chosen by borrower, when revealed lender uses to commit btc to collateral address
     */
    function requestLoan(
        uint256 amount,
        string memory btcAddress,
        string memory btcPubkey,
        bytes32 preimageHashBorrower
    ) external payable nonReentrant {
        require(msg.value >= PROCESSING_FEE, "Loan: insuff proc fee");
        require(amount >= MIN_LOAN_AMOUNT, "Loan: amt must be > min");
        require(bytes(btcAddress).length >= 62 && bytes(btcAddress).length <= 63, "Loan: inval P2TR addr");
        require(bytes(btcPubkey).length == 64, "Loan: inval BTC pubkey");
        require(borrowerToLoanId[msg.sender] == 0, "Loan: borrower has active loan");

        _loanIds++; //loan map is 1 indexed, not 0 indexed. but since deletion is allowed, do not treat _loanIds as the total number of loans
        uint256 loanId = _loanIds;

        loans[loanId] = Loan({
            borrowerAddr: msg.sender,
            borrowerBtcPubkey: btcPubkey,
            amount: amount,
            collateralAmount: 0, // Will be set when collateral is provided
            bondAmount: 0,
            status: LoanStatus.Requested,
            preimageHashBorrower: preimageHashBorrower,
            preimageHashLender: bytes32(0),
            requestBlockheight: block.number,
            offerBlockheight: 0,
            activationBlockheight: 0,
            repaymentBlockheight: 0
        });

        borrowerToLoanId[msg.sender] = loanId;

        emit LoanRequested(loanId, msg.sender, amount, btcAddress);
    }

    /**
     * @dev Accept loan offer by claiming from EtherSwap
     * @param loanId The loan ID
     * @param preimageBorrower The preimage (chosen by borrower) for accepting the loan offer.
     */
    function acceptLoanOffer(uint256 loanId, bytes32 preimageBorrower)
        external
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.Offered)
        nonReentrant
    {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.borrowerAddr, "Loan: caller not borrower");

        // Claim loan from EtherSwap
        uint256 timelock = loan.offerBlockheight + timelockLoanReq;
        etherSwap.claim(
            preimageBorrower, //this allows lender to commit btc to collateral address (using pre-signed btc tx)
            loan.amount,
            address(this), //claim address
            address(this), //refund address both are the same here
            timelock
        );

        //if above is successful, then the claimed ether is sent to the borrower
        //and reimburse the processing fee
        payable(msg.sender).transfer(loan.amount + PROCESSING_FEE); 

        // Update loan state
        loan.status = LoanStatus.Active;
        loan.activationBlockheight = block.number;       

        emit LoanActivated(loanId, msg.sender);
    }

    /**
     * @dev Attempt loan repayment by locking funds in EtherSwap
     * @param loanId The loan ID
     * @param preimageHashLender Unique preimage hash for repayment
     */
    function attemptRepayment(uint256 loanId, bytes32 preimageHashLender)
        external
        payable
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.Active)
        nonReentrant
    {
        Loan storage loan = loans[loanId];
        // anyone can repay a loan
        //require(msg.sender == loan.borrowerAddr, "Loan: caller is not the borrower");
        require(block.number < loan.activationBlockheight + loanDuration, "Loan: past due");
        require(msg.value == loan.amount, "Loan: incorrect rpmt amt");

        // Lock repayment in EtherSwap
        uint256 timelock = block.number + timelockRepaymentAccept;
        etherSwap.lock{value: msg.value}(preimageHashLender, address(this), timelock);

        // Update loan state
        loan.status = LoanStatus.RepaymentInProgress;
        loan.repaymentBlockheight = block.number;

        emit RepaymentAttempted(loanId, msg.sender, msg.value);
    }

    /**
     * @dev Withdraw repayment attempt (refund from EtherSwap). Lender did not accept repayment.
     * @param loanId The loan ID
     */
    function withdrawRepaymentAttempt(uint256 loanId)
        external
        loanExists(loanId)
        correctLoanStatus(loanId, LoanStatus.RepaymentInProgress)
        nonReentrant
    {
        Loan storage loan = loans[loanId];
        // this we restrict to borrower for now.
        require(msg.sender == loan.borrowerAddr, "Loan: caller not borrower");
        require(loan.preimageHashLender == bytes32(0), "Loan: rpmt already accepted");

        // Refund from EtherSwap
        uint256 timelock = block.number + timelockRepaymentAccept;
        etherSwap.refund(loan.preimageHashBorrower, loan.amount, address(this), timelock);

        // Update loan state
        loan.status = LoanStatus.RefundedToBorrower;

        //send the lender's bond to the borrower
        payable(msg.sender).transfer(loan.bondAmount);

        emit RepaymentRefundedToBorrowerWithBond(loanId, msg.sender, loan.bondAmount);
    }

    // bitcoin utility functions

    /**
     * @dev Extract timestamp from Bitcoin header
     * @param header The Bitcoin header bytes
     * @return Timestamp in seconds
     * may be useful later is switching from block number to timestamp
     */
    function extractTimestamp(bytes memory header) public pure returns (uint32) {
        require(header.length == 80, "Invalid hdr len");

        // Extract timestamp from bytes 68-71 (little-endian)
        uint32 ts =
            uint32(uint8(header[68])) |
            (uint32(uint8(header[69])) << 8) |
            (uint32(uint8(header[70])) << 16) |
            (uint32(uint8(header[71])) << 24);

        return ts;
    }

    
    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get loan details
     * @param loanId The loan ID
     * @return Loan struct
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        require(loanId > 0 && loanId <= _loanIds, "Loan: loan does not exist");
        return loans[loanId];
    }

    /**
     * @dev Get total number of loans ever requested. This is not the number of active loans.
     * @return Total loan count
     */
    function getTotalLoans() external view returns (uint256) {
        return _loanIds;
    }

    /**
     * @dev Get loan ID by borrower address
     * @param borrower The borrower address
     * @return Loan ID
     */
    function getLoanIdByBorrower(address borrower) external view returns (uint256) {
        return borrowerToLoanId[borrower];
    }

    // ============ DELETION FUNCTIONS ============

    /**
     * @dev Delete a completed, defaulted, or abandoned loan request to free up storage
     * @param loanId The loan ID to delete
     */
    function deleteCompletedLoan(uint256 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];
        require(
            loan.status == LoanStatus.Repaid || loan.status == LoanStatus.Defaulted
                || loan.status == LoanStatus.RefundedToLender || loan.status == LoanStatus.RefundedToBorrower,
            "Loan: cant delete active loan"
        );

        // Only the borrower or lender can delete the loan
        require(msg.sender == loan.borrowerAddr || msg.sender == owner(), "Loan: only borrower or lender can delete");

        address borrower = loan.borrowerAddr;

        // Delete the loan data
        delete loans[loanId];
        delete borrowerToLoanId[borrower];

        emit LoanDeleted(loanId, borrower);
    }

    // ============ EMERGENCY FUNCTIONS ============

    /**
     * @dev Emergency function to withdraw stuck ETH (only lender)
     */
    function emergencyWithdraw() external onlyLender {
        uint256 balance = address(this).balance;
        require(balance > 0, "Loan: no ETH to withdraw");

        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Loan: ETH transfer failed");
    }

    // ============ RECEIVE FUNCTION ============

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}
