# Contracts for BTC to EVM vaulted yield project

- A `loan` contract will manage the info about the BTC collateral
- Use Boltz's etherswap HTLC contract to implement the loan by "atomically locking" 
BTC in a "collateral UTXO" after the borrower uses a preimage to claim the loan in rBTC (or ETH for testing)
- The same `etherswap` contract can be called to handle repayment logic (also atomic). In this case, the lender
reveals a preimage while accepting the loan repayment, which the borrower can use to reclaim the locked BTC.
- If the loan is not repaid, it is assumed that the BTC collateral can be spent by the lender alone after a 
long timelock.
- If the lender "does not accept" the borrower's repayment within a certain timeframe, the borrower can reclaim  
the assets and also slash the a security bond posted by the lender.
- For security, the Boltz `etherswap` contract is modified so that it can only
be called from the loan contract.


System Diagrams are in the project's root directory: [timing](../figs/timeline.svg) and [system contracts](../figs/system-contracts.svg)





### Vaults

As an extension, the borrower can use the loaned assets to invest in a vault implemented using erc4626. 

This is an experimental version. Production grade example: https://github.com/morpho-org/morpho-optimizers-vaults/blob/main/src/ERC4626UpgradeableSafe.sol


## Install Foundry

```
curl -L https://foundry.paradigm.xyz | bash
```

Got error about `libusb` and asked to install via brew. Not installing for now

Source the environment or open new terminal and `foundryup`

Check with `forge --version`

```
forge init
```

=============

The following information is outdated.

## Wrapped BTC

Now we deploy a third erc20 token called `WBTC` as a wrapped around the `BTC` token 
- this token contract should have user_0 as the owner
- WBTC tokens can be minted as a wrapper around the BTC token, by locking BTC tokens to mint an equivalent amount of WBTC tokens
- a WBTC holder can recover the underlying BTC token using a `burn` transaction 


The WBTC token contract has the following features:
1. It's a standard ERC20 token with symbol "WBTC" and name "Wrapped Bitcoin"
2. Users can wrap BTC tokens by calling the `wrap()` function, which:
    * Locks the specified amount of BTC tokens in the contract
    * Mints an equivalent amount of WBTC tokens
3. Users can unwrap WBTC tokens by calling the unwrap() function, which:
    * Burns the specified amount of WBTC tokens
    * Returns the equivalent amount of BTC tokens
4. The contract includes:
    * ReentrancyGuard for security
    * Events for wrapping and unwrapping
    * A function to check the amount of locked BTC tokens

To deploy the WBTC token,
```
forge script script/DeployWBTC.s.sol --rpc-url http://localhost:8545 --broadcast
```

Got an error .. reentrancy guard not found.

```
# try again with specific version
forge install OpenZeppelin/openzeppelin-contracts
```

After deployment, you'll need to:
1. Add the WBTC token address to your `.env` file:
2. Approve the WBTC contract to spend BTC tokens before wrapping (using the BTC token's `approve()` function)


Modify the base wrapper to give the owner special powers. The owner can mint WBTC without locking any BTC tokens. The owner can do this by entering the amount and two additional pieces of data in hex format.
- The first piece of data represents an outpoint of a bitcoin tx i.e. a unique UTXO
- the second piece of data, also in hex, represents a time in the future in UTC in seconds        
- the owner (user_0) can burn some WBTC by posting other data [64 bytes] also in hex format 


Deploy the modifued contract and save the deployed address in .env

```
forge script script/DeployWBTC.s.sol --rpc-url http://localhost:8545 --broadcast
```

The log is 

```
== Logs ==
  Deploying WBTC token...
  BTC Token address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  WBTC Token deployed to: 0x09635F643e140090A9A8Dcd712eD6285858ceBef 
  # deployed several times as I kept added more features to WBTC iteratively
  
Contract Features:
  1. Regular wrapping/unwrapping of BTC
  2. Owner-only minting with txid, index, and duration
  3. Owner-only burning with txid

```

### test the wrapper

warning: 

```shell
$ forge test --match-path test/TestWBTC.t.sol -vv
$ forge test --match-path "test/*" -v # or -vv -vvv for additional info
```



## Foundry
The standard Foundry readme content appears below



**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test -vv
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/DeployBTC.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
