"""
At present, the Loan class methods are boilerplate.
Unused: may not be needed as we are moving to node.js for the backend.
But keeping it here for now (initial plan was to use python for the backend).
"""

from enum import Enum
from typing import Optional
from dataclasses import dataclass

from bitcoinutils.keys import PublicKey

class LoanStatus(Enum):
    """Enumeration for loan status values."""
    PENDING = "PENDING" # borrower requested loan on RSK and has deposited funds to escrow
    ACTIVE = "ACTIVE" # borrower accepted loan offer on RSK, loan initialized atomically via TX1.
    LOAN_INIT_FAILED = "LOAN_INIT_FAILED" # loan not offered by lender or borrower did not accept
    REPAID = "REPAID" # loan has been fully repaid
    DEFAULTED = "DEFAULTED" # loan has been defaulted by borrower, collateral claimed by lender
    SEIZED = "SEIZED" # collateral seized by lender (borrower not at fault. Lender will be slashed on RSK)
    UNKNOWN = "UNKNOWN" # loan status is unknown (no record of loan request on RSK)

@dataclass
class Loan:
    """A class representing a loan in the BTC vault system."""
    
    amount: float # in BTC
    interest_rate: float # in percentage default 0.0
    origination_fee: float # in satoshis default 0
    duration: int  # Duration (num blocks)
    lender: PublicKey # bitcoin pubkey    
    borrower: PublicKey # bitcoin pubkey
    preimageHash_borrower: str # hash of the preimage set by borrower
    preimageHash_lender: str # hash of the preimage set by lender
    timelock_0: int  # Timelock for borrower's escape hatch (num blocks)
    timelock_1: int  # Timelock for lender's collateral claim (num blocks)
    status: LoanStatus = LoanStatus.UNKNOWN
    loan_id: str = "" # loan id on RSK
    
    def __post_init__(self):
        """Validate loan parameters after initialization."""
        if self.amount <= 0:
            raise ValueError("Loan amount must be positive")
        if self.interest_rate < 0:
            raise ValueError("Interest rate cannot be negative")
        if self.duration <= 0:
            raise ValueError("Duration must be positive")
        if not self.lender or not self.borrower:
            raise ValueError("Lender and borrower must be specified")
        if not self.preimageHash_borrower or not self.preimageHash_lender:
            raise ValueError("Preimage hashes must be specified")
        
        # Validate SHA256 hash length (64 hex characters)
        if len(self.preimageHash_borrower) != 64:
            raise ValueError("preimageHash_borrower must be a 64-character SHA256 hash")
        if len(self.preimageHash_lender) != 64:
            raise ValueError("preimageHash_lender must be a 64-character SHA256 hash")
        
        # Validate that hashes contain only valid hex characters (case-insensitive)
        if not all(c in '0123456789abcdefABCDEF' for c in self.preimageHash_borrower):
            raise ValueError("preimageHash_borrower must contain only valid hexadecimal characters")
        if not all(c in '0123456789abcdefABCDEF' for c in self.preimageHash_lender):
            raise ValueError("preimageHash_lender must contain only valid hexadecimal characters")
        if self.timelock_0 <= 0 or self.timelock_1 <= 0:
            raise ValueError("Timelocks must be positive")
    
    def accept(self) -> None:
        """Accept the loan offer."""
        if self.status != LoanStatus.PENDING:
            raise ValueError(f"Cannot accept loan with status: {self.status}")
        self.status = LoanStatus.ACTIVE
    
    def reject(self) -> None:
        """Reject the loan offer."""
        if self.status != LoanStatus.PENDING:
            raise ValueError(f"Cannot reject loan with status: {self.status}")
        self.status = LoanStatus.LOAN_INIT_FAILED
    
    def complete(self) -> None:
        """Mark the loan as completed."""
        if self.status != LoanStatus.ACTIVE:
            raise ValueError(f"Cannot complete loan with status: {self.status}")
        self.status = LoanStatus.REPAID
    
    def is_active(self) -> bool:
        """Check if the loan is currently active."""
        return self.status == LoanStatus.ACTIVE
    
    def can_be_spent_by_lender(self, current_block_height: int) -> bool:
        """Check if the lender can spend the collateral (after timelock)."""
        return (self.status == LoanStatus.ACTIVE and 
                current_block_height >= self.timelock_1)
    
    def can_be_spent_by_borrower(self, current_block_height: int) -> bool:
        """Check if the borrower can spend the escrow (after timelock)."""
        return (self.status == LoanStatus.ACTIVE and 
                current_block_height >= self.timelock_0)

