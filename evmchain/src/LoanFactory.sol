// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./EtherSwap.sol";
import "./BtcCollateralLoan.sol";

/**
 * @title Loan Factory Contract
 * @dev Factory contract that deploys both EtherSwap and BtcCollateralLoan contracts
 * in the correct order to maintain the security model where EtherSwap can only be
 * called by the authorized loan contract.
 */
contract LoanFactory {
    // Events
    event ContractsDeployed(
        address indexed etherSwap,
        address indexed loanContract,
        address indexed lender
    );

    /**
     * @dev Deploy both EtherSwap and BtcCollateralLoan contracts
     * @param lenderBtcPubkey The lender's Bitcoin Schnorr (x only) public key, 32 bytes
     * @param timelockLoanReq Timelock for loan requests (t_B)
     * @param timelockBtcEscrow Timelock for Bitcoin escrow (t_0)
     * @param timelockRepaymentAccept Timelock for repayment acceptance (t_L)
     * @param timelockBtcCollateral Timelock for Bitcoin collateral (t_1)
     * @return etherSwapAddress The deployed EtherSwap contract address
     * @return loanAddress The deployed BtcCollateralLoan contract address
     */
    function deployContracts(
        string memory lenderBtcPubkey,
        uint256 timelockLoanReq,
        uint256 timelockBtcEscrow,
        uint256 timelockRepaymentAccept,
        uint256 timelockBtcCollateral
    ) external returns (address etherSwapAddress, address loanAddress) {
        // Validate parameters
        require(bytes(lenderBtcPubkey).length == 32, "Factory: invalid BTC Schnorr pubkey");
        require(timelockBtcEscrow > timelockLoanReq, "Factory: t_0 must be > t_B");
        require(timelockBtcCollateral > timelockRepaymentAccept, "Factory: t_1 must be > t_L");

        // Step 1: Deploy BtcCollateralLoan first (without EtherSwap address)
        BtcCollateralLoan loanContract = new BtcCollateralLoan(
            lenderBtcPubkey,
            timelockLoanReq,
            timelockBtcEscrow,
            timelockRepaymentAccept,
            timelockBtcCollateral
        );

        // Step 2: Deploy EtherSwap with the loan contract address
        EtherSwap etherSwapContract = new EtherSwap(address(loanContract));

        // Step 3: Update the loan contract with the actual EtherSwap address (as factory owner)
        loanContract.setEtherSwapAddress(address(etherSwapContract));
        
        // Step 4: Transfer ownership to the caller (lender)
        loanContract.transferOwnership(msg.sender);

        etherSwapAddress = address(etherSwapContract);
        loanAddress = address(loanContract);

        emit ContractsDeployed(etherSwapAddress, loanAddress, msg.sender);

        return (etherSwapAddress, loanAddress);
    }

    /**
     * @dev Get the deployment bytecode for EtherSwap
     * @param loanContractAddress The address of the loan contract
     * @return The deployment bytecode
     */
    function getEtherSwapBytecode(address loanContractAddress) external pure returns (bytes memory) {
        return abi.encodePacked(
            type(EtherSwap).creationCode,
            abi.encode(loanContractAddress)
        );
    }

    /**
     * @dev Get the deployment bytecode for BtcCollateralLoan
     * @param lenderBtcPubkey The lender's Bitcoin public key
     * @param timelockLoanReq Timelock for loan requests
     * @param timelockBtcEscrow Timelock for Bitcoin escrow
     * @param timelockRepaymentAccept Timelock for repayment acceptance
     * @param timelockBtcCollateral Timelock for Bitcoin collateral
     * @return The deployment bytecode
     */
    function getLoanBytecode(
        string memory lenderBtcPubkey,
        uint256 timelockLoanReq,
        uint256 timelockBtcEscrow,
        uint256 timelockRepaymentAccept,
        uint256 timelockBtcCollateral
    ) external pure returns (bytes memory) {
        return abi.encodePacked(
            type(BtcCollateralLoan).creationCode,
            abi.encode(
                lenderBtcPubkey,
                timelockLoanReq,
                timelockBtcEscrow,
                timelockRepaymentAccept,
                timelockBtcCollateral
            )
        );
    }
} 