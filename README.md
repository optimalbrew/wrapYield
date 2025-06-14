# Components for a BTC yiled project

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

A script to generate 10 private keys and their associated addresses
```
forge script script/GenerateKeys.s.sol
```

this will output something like

```
Script ran successfully.
Gas used: 92595
== Logs ==
  Generating 10 private keys and addresses:
  ----------------------------------------
  User 0:
  Private Key: 0x78541660797044910968829902406342334108369226379826116161446442989268089806461
  Address: 0x00d83E13A62e8E9F183fDbAa8642EF69192F644E
  ----------------------------------------
 and so on... for all accounts
```


Now let's create a script `SetupTestEnv.s.sol` to set up a local test environment and allocate 1 ETH to each of these addresses. We'll create a new script that will:
* Start a local Anvil node
* Fund each address with 1 ETH

Create the ERC20 token contract `BTCToken.sol`

### install the OpenZeppelin contracts

```
forge install OpenZeppelin/openzeppelin-contracts
```
This took a couple of minutes

### Create a deployment script for token `DeployBTC.s.sol`

Also create a `.env` file to store the pvt key for user_0

PRIVATE_KEY=0xac0974bec.....7bf4f2ff80

and then run the deploy script

```
forge script script/DeployBTC.s.sol --rpc-url http://localhost:8545 --broadcast
```

Before running this command, make sure:
1. You have created the .env file with the private key for user_0
2. You have a local Anvil node running (you can start it with `anvil` in a separate terminal)

```
Script ran successfully.

== Logs ==
  BTC Token deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  Total Supply: 10000000 BTC

## Setting up 1 EVM.

==========================

Chain 31337

Estimated gas price: 2.000000001 gwei

Estimated total gas used for script: 1232600

Estimated amount required: 0.0024652000012326 ETH

==========================

##### anvil-hardhat
✅  [Success] Hash: 0x7d4bbe0d8393cc2781f74e973c3c7c98e17233b4a558a8abdff0ab9b3a2b103b
Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Block: 1
Paid: 0.000948154000948154 ETH (948154 gas * 1.000000001 gwei)

✅ Sequence #1 on anvil-hardhat | Total Paid: 0.000948154000948154 ETH (948154 gas * avg 1.000000001 gwei)
                                                                                                    

==========================

ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.

```

### Deploy reward token `PRZ`

```
forge script script/DeployPRZ.s.sol --rpc-url http://localhost:8545 --broadcast
```

As above, make sure anvil is still running

```
  PRZ Token deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  Total Supply: 5000000 PRZ

```

Then distribute 2 percent of of the supply of BTC and PRZ to each of the 10 accounts. 

Add the token addresses to the `.env` file 

BTC_TOKEN_ADDRESS=<your_btc_token_address>
PRZ_TOKEN_ADDRESS=<your_prz_token_address>

and then run the distribution script

```
forge script script/DistributeTokens.s.sol --rpc-url http://localhost:8545 --broadcast
```

with log

```
Script ran successfully.

== Logs ==
  Distributing tokens...
  BTC amount per user: 200000 BTC
  PRZ amount per user: 100000 PRZ
  Transferred 200000 BTC to user_1 (0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
  Transferred 100000 PRZ to user_1 (0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
  ...
  ...
  Transferred 200000 BTC to user_9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720)
  Transferred 100000 PRZ to user_9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720)
  
Distribution complete!

## Setting up 1 EVM.

==========================

Chain 31337

Estimated gas price: 1.765802569 gwei

Estimated total gas used for script: 1335817

Estimated amount required: 0.002358789090313873 ETH

==========================

##### anvil-hardhat
✅  [Success] Hash: 0x7bd01393195a061acbe72096d36ab45db33cc6891069cdb407fb316ac53aeafa
Block: 3
Paid: 0.000040682077700057 ETH (52189 gas * 0.779514413 gwei)


##### anvil-hardhat
✅  [Success] Hash: 0xf4da936b9adeb4d30569bf96a14d36296a81a4a46f3558608641c3c793316a92
Block: 4
Paid: 0.000035622699947929 ETH (52201 gas * 0.682414129 gwei)

...
...

##### anvil-hardhat
✅  [Success] Hash: 0x29552764b9de7c5f62cce707a7bcc4d82221d039ad7c836d5705a2b16bfa70e7
Block: 13
Paid: 0.000010774295430773 ETH (52201 gas * 0.206400173 gwei)

✅ Sequence #1 on anvil-hardhat | Total Paid: 0.000347682743808816 ETH (939486 gas * avg 0.370085288 gwei)
                       
```

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
