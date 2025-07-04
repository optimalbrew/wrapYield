# bitcoin backend
Using bitcoind in a docker container. Just for testing (regtest, initially).
Not meant for use in production. RPC passwords are the common test values.

Start (or restart) the service with 

```
docker compose up
```

Verify it's working (not needed, since we have enabled `printtoconsole` for logs)

```
docker exec -it bitcoind-regtest bitcoin-cli \
  -regtest \
  -rpcuser=bitcoin \
  -rpcpassword=localtest \
  getblockchaininfo
```


Can verify wallet commands are available (they are not always enabled by default).

```
docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=localtest help | grep wallet
```

Create a wallet

```
docker exec -it bitcoind-regtest bitcoin-cli \
  -regtest \
  -rpcuser=bitcoin \
  -rpcpassword=localtest \
  createwallet "testwallet"
```

Get a new address

```
docker exec -it bitcoind-regtest bitcoin-cli \
  -regtest \
  -rpcuser=bitcoin \
  -rpcpassword=localtest \
  -rpcwallet=testwallet \
  getnewaddress

# bcrt1qetyjadtaqwc40jn9qttezz3qn3qx78wk7rs6w9 # for example
```

Mine 100+1 blocks to get coins for this address

```
docker exec -it bitcoind-regtest bitcoin-cli \
  -regtest \
  -rpcuser=bitcoin \
  -rpcpassword=localtest \
  -rpcwallet=testwallet \
  generatetoaddress 101 bcrt1qetyjadtaqwc40jn9qttezz3qn3qx78wk7rs6w9
```

Use `docker compose down` to stop the container.

Remove the stopped container (compose down should remove it, but in case).

```
docker rm bitcoind-regtest
```

