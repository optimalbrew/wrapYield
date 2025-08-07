# Bitcoin Utils
Use with pyenv .. bitcoin-utils

Look at examples at https://github.com/karask/python-bitcoin-utils/tree/master/examples

=====IMPORTANT=======

# Bitcoin utilities library
Uses bitcoinutils 

#pip3 install bitcoin-utils #see warning below

NOTE: pip will install the latest release (at time of writing), which is from a year ago. The latest examples in the repo do not work with that. For example, the released version does not have an op_code for op_CheckSigAdd (taproot), which has been merged in the main repo. Instead of the release version (i.e. from pip), use the version of the library from the main branch [github](https://github.com/karask/python-bitcoin-utils). That's what I did manually, by cloning the repo, overwriting the version installed by pip.

===================

## Note: This project requires a Bitcoin Core node running in regtest mode
- there is a docker compose for this in `btc-backend` directory
- and the `rpc username: bitcoin`, and `passwd: localtest`
- start the container e.g. `docker compose up -d` # in ../btc-backend
- The examples are designed to work with Bitcoin Core v22.0 or later that supports Taproot (BIPs 340, 341, 342) 


