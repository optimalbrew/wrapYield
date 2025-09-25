# BTC Loan Protocol -  Architecture

This document describes the complete architecture of the Collateralized BTC Loan system


## Quick start for local testing

Clone the repo. I assume you have Foundry installed for smart contract development. This may require you
to install rust first. Most services run in docker. The project requires node: we use WAGMI for the dApp front end, and express for backend. Python 3.10+ is required for the bitcoin taproot scripts, addresses, transaction construction, signing and signature
verification. Python api is built using `bitcoinutils` which requires 3.10.

note: the scripts `start-local.sh` and `stop-local.sh` can be used to start/stop all service. Running `start-local.sh`
will copy the `.env` files, build docker images etc. 



1. Start a local anvil (Ethereum) from any terminal. For determinstic anvil accounts and testing, I use a fixed seed 
the lender address gets associated with this mnemonic - so we need to import it 

```bash
anvil --mnemonic-seed-unsafe 2
# copy the seed phrase into browser wallet!
```



2. Deploy the smart contracts (`BtcCollateralLoan` and `EtherSwap`). Do this from the `evmchain/` directory using the 
following script and the first anvil account's private key

```bash
# from evmchain/ directoy
forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
```
3. Start bitcoin core in `regtest` mode. This can be done from `btc-backend` with

```bash
docker compose up -d
```

In the same (`btc-backend/`) directory we have a script (make it executable) to fund a couple of wallets used for testing (one wallet for the borrower and one for lender). Unlike ethereum, we are not using browser-based wallets for bitcoin. We use 
bitcoin-core wallets.

```bash
./setup-wallets.sh
```

4. Start the Loan Dapp front end from `evm-dapp/`
```bash
npm run dev
```
this should start the dapp on `localhost:3000`


5. Start the backend service(s) from `backend-service`

```bash
docker compose up -d
```
this will start the backend service, two python-apis (for lender and one for borrower), and the postgres service.

If any of the containers are unhealthy or restartign then make sure bitcoin container is running and the wallets have been setup, also ensure anvil chain is up and contracts have been deployed.

If everything looks healthy, then go to the front end to test out the loan process. The forms have some default inputs that
should work to start with. On the bitcoin side, we need to interact with the python-api to send funds to the escrow address, 
and for the borrower to pre-sign a collateral commitment transaction. 

## The Loans Life Cycle

The flow is something like this. On the dapp (ocalhost:3000) there are two main views: borrower and lender. Start with the lender view
just to make sure the 

1. Prepare collateral: On the front end, before requesting a loan, a needs the borrower to fill in their preimage hash - which can be generated using the python-api. This hash is used along with borrower and lender pubkeys to generate the escrow address.
2. The borrower can use the python-api to send funds to this escrow address. The python-api can also be used to check that this is
the correct address. The amount suggested by the front end includes an origination fee on top of the loan and a small amount of sats for bitcoin network fees. The borrower can increase this further to allow for higher mining fees.
3. The txid and vout of the funding transaction are used to request a loan. 
4. Once a loan is requested, the lender will associate their own preimage hash with it. This is used by the python-api to
craft a transaction for the borrower to pre-sign. This pre-signed transaction will allow the lender to later spend the
escrow output and lock coins in a collateral output.
5. The borrower uses the lender's preimage hash to sign the transaction and uploads the signature on the front end.
6. The lender verifies that the signature is valid for that specific transaction. Only after that will the lender offer a loan.
7. Once a loan is offered the borrower can accept is using their secret preimage.
8. The lender uses the revealed preimage, and uses the python-api to complete the transaction to move the funds from the escrow to
the collateral output. This transaction also pays them the orgination fee.
9. Borrowers can repay the loan on the front end any time before the loan duration is over.
10. Once a repayment is in, the lender must accept it and reveal their secret preimage when doing so.
11. The borrower can use the python-api and the revealed preimage to retrieve their collateral - which completes the loan lifecycle

There are other ways that the escrow output and the collateral output can be spent. For example, in case of loan default, the lender gets the collateral output after a timelock. The python-api has methods to help with the construction of all necessary 
transations.


### Examples to get started
On the borrower and lender page the forms are mostly prefilled with test data that can be used readily.

However, we do need to run a couple of things by hand to complete the full cycle. The first is funding the escrow output

```bash
curl -X POST http://localhost:8002/bitcoin/fund-address \
  -H "Content-Type: application/json" \
  -d '{
    "address": "bcrt1pjffezpv29u3dgm3vxv8mv3pwxmy24n5y8d030795tzuce63ugc0q6ln2hx",
    "amount": 0.0102,
    "label": "test-funding"
  }'
```
The `txid` and `vout` will be needed when requesting a loan. The "address" is whatever the "escrow address" is. This
is different for each borrower and preimagehash used. The borrower page on the front end will display this address,
but we can also compute it directly with the python-api (see examples below)


The second interaction with the borrower-python-api is to generate a borrower signature. This can be generated using

```bash
curl -X POST "http://localhost:8002/transactions/borrower-signature" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "test-loan-example-012",
    "escrow_txid": "5b60ee94723d06f261ae475f9145a08a086d3450045c66bb93f0b38906af476d",
    "escrow_vout": 0,
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927",
    "preimage_hash_lender": "646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3",
    "borrower_timelock": 100,
    "lender_timelock": 27150,
    "collateral_amount": "0.01",
    "origination_fee": "0.0001",
    "borrower_private_key": "cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz"
  }' | jq
```

The generated JSON file with the signature will be in `/python-api/examples/` .. look for the same name as `"loan_id":` 
in the call, e.g. `test-loan-example-012.json`. The `escrow_txid` and `escrow_vout` in the call are the ones from the `fund-address` above. The json file, or its contents must be posted on the borrower page so the borrower's
signature can be verified by a lender - a necessary step before the lender will offer loan.

Apart from these two interactions on the bitcoin side, the prefilled values on the front end should be adequate to complete
a complete loan life cycle.


#### Escrow and Collateral Address generation examples

Even for the same borrower and lender pubkey, the initial escrow and the subsequent collateral outputs will 
be unique for each preimage hash combination (also the relative locktimes)

```bash
curl -X POST http://localhost:8002/vaultero/nums-p2tr-addr-0 -H "Content-Type: application/json" -d '{
  "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
  "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
  "preimage_hash_borrower": "114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927",
  "borrower_timelock": 100
}' | jq
```
The `borrower_timelock` of 100 bitcoin blocks just under a day.

and address of collateral output where the bitcoin collateral will be held for the duration of the loan 

```bash
curl -X POST http://localhost:8002/vaultero/nums-p2tr-addr-1 -H "Content-Type: application/json" -d '{
  "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
  "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
  "preimage_hash_lender": "646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3",
  "lender_timelock": 27150
}' | jq
```
The `lender timelock` is for the collateral, and this is for the duration of the loan, which is roughly 6 months. The smart contract stores these
values in terms of Roostock blocks. The backend converts them to bitcoin blocks (dividing by 20), before calling the python-api. When using the
python-api directly, users should be mindful of thiking in terms of bitcoin blocks (the python api has nothing to do with the evm-side of things). 


## Database and Loan States

For any given loan_id: 

```bash
#from anywhere: using full container name
docker exec -it btc-yield-postgres psql -U btc_yield_user -d btc_yield

#from backend-service, using service name
docker compose exec -it postgres psql -U btc_yield_user -d btc_yield
```

For a single loan, use `\x` to activate column view for better readability.

```bash
SELECT * FROM loans WHERE loan_req_id = '3';
```

The state of the collateral can be verified using the tx is (`collateral_commit_tx` in the `loans` table). The `vout` for 
the collateral output is 1 (output 0 is origation fee)

```bash
curl -X GET http://localhost:8001/utxo/collateral_commit_tx/1/details
```


To clear all rows from all 3 tables when testing with restarts
```bash
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "TRUNCATE TABLE loans, borrower_signatures, users;"
```



## 🏗️ **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Borrower      │    │   Node.js API   │    │   Python API    │    │  btc-vaultero   │
│   Frontend      │    │   (Port 3001)   │    │   (Port 8001)   │    │   Package       │
│                 │    │                 │    │                 │    │                 │
│ • MetaMask      │◄──►│ • PostgreSQL    │◄──►│ • Lender Keys   │◄──►│ • Bitcoin TX    │
│ • Local Wallet  │    │ • Signature DB  │    │ • TX Creation   │    │ • Cryptography  │
│ • Client Sigs   │    │ • Loan Mgmt     │    │ • Broadcasting  │    │ • Network Ops   │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                         ▲                         ▲
        │                         │                         │
        │ EVM Contracts            │ HTTP API                │ Python Calls
        ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EVM Chain     │    │   PostgreSQL    │    │   Bitcoin       │
│   Contracts     │    │   Database      │    │   Network       │
│                 │    │                 │    │                 │
│ • Loan State    │    │ • Users         │    │ • Transactions  │
│ • Timelock      │    │ • Loans         │    │ • Confirmation  │
│ • Events        │    │ • Signatures    │    │ • Broadcasting  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```


### **Code Organization**
```
btc-yield/
├── config/                 # Shared configuration system
├── btc-vaultero/          # Bitcoin transaction package  
├── evmchain/              # Solidity smart contracts
├── evm-dapp/              # Frontend React/Wagmi app
├── backend-service/       # Node.js API service
├── python-api/            # Python FastAPI service
└── ARCHITECTURE.md        # This document
```
