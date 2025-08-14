# EVM yield vault using BTC-collateralized loans

This is a poc to implement a pathway for bitcoin holders to earn yield from an
EVM chain without giving up complete control of BTC. The  BTC will remain 
locked as collateral in joint custody with the lender on the EVM chain.

Loan initiation is atomic, using HTLC (e.g. www.Boltz.exchange). While this is not
a swap, the process is still trustless. Loan repayment (and collateral release) is 
also atomic, but not trustless. This is because the lender cannt be forced to accept
repayment. In this case the lender can be slashed by the borrower. If the lender does
accept the repayment, then the BTC is relased atomically using HTLC logic.  

## Repo Structure

### Python package for bitcoin side of things

The dir `btc-vaultero` has a python package `vaultero` to implement the bitcoin side of the 
logic for the bitcoin-colleteralized loan. 

See the package [readme](btc-vaultero/README.md) for more info on setup and testing within a venv.



### Bitcoin core backend (docker)

The tests use a bitcoin core backend running in "regtest". There is a docker file for this purpose
in the directory `btc-backend`.

Start the container `docker compose up -d` before running the tests.

### EVM contracts

The loan is offered and repaid on the EVM side, the contracts and tests are in `evmchain`.
These are implenented using foundry.

### Bitcoin scripts

The vaultero package uses `bitcoinutils`. The directory `py-bitcoin-scripts` contains some examples from the original bitcoin utils repo. 
They have been extended to suit our needs. As with the package tests, start the bitcoin container before running the scripts.

The code in the directory `rust-bitcoin-scripts` contains early attempts to use miniscript for the PoC. These are still very elementary.