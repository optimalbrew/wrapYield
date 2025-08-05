# EVM yield vault using BTC-collateralized loans
 This is a poc to implement a pathway for bitcoin holders to earn yield from an
  EVM chain without giving up complete control of BTC. The  BTC will remain 
  locked as collateral in joint custody with the lender on the EVM chain.

Loan initiation is atomic, using HTLC (e.g. www.Boltz.exchange). While this is not
a swap, the process is still trustless. Loan repayment (and collateral release) is 
also atomic, but not trustless. This is because the lender cannt be forced to accept
repayment. In this case the lender can be slashed by the borrower. If the lender does
accept the repayment, then the BTC is relased atomically using HTLC logic.  
