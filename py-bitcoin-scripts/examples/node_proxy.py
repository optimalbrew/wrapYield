# Copyright (C) 2018-2025 The python-bitcoin-utils developers
#
# This file is part of python-bitcoin-utils
#
# It is subject to the license terms in the LICENSE file found in the top-level
# directory of this distribution.
#
# No part of python-bitcoin-utils, including this file, may be copied,
# modified, propagated, or distributed except according to the terms contained
# in the LICENSE file.


"""
https://developer.bitcoin.org/reference/rpc/index.html for more information
"""

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy


def main():
    # always remember to setup the network
    setup("regtest")

    # get a node proxy using default host and port
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()

    # call the node's getblockcount JSON-RPC method
    count = proxy.getblockcount()

    # call the node's getblockhash JSON-RPC method
    block_hash = proxy.getblockhash(count)

    # call the node's getblock JSON-RPC method and print result
    block = proxy.getblock(block_hash)
    print(block)

    # print only the difficulty of the network
    print(block["difficulty"])

    proxy = NodeProxy("bitcoin", "localtest").get_proxy()
    
    try:
        proxy.loadwallet('mywallet')
        print('loaded mywallet')
    except:
        try:
            print("Loading failed. Try creating wallet 'mywallet'.")
            proxy.createwallet('mywallet')
        except:
            print("Error creating wallet 'mywallet'. Maybe already loaded" )

    addr = proxy.getnewaddress("first_address", "bech32")
    proxy.generatetoaddress(101, addr)
    print(f'\nBalance: {proxy.getbalance()}')
  
    
    wallet_info = proxy.getwalletinfo()
    print(f"\nWallet info: {wallet_info}")


    #get a new address. Optionally add a label and type
    addr = proxy.getnewaddress("first_address", "bech32") # or "legacy" for P2PKH, or "p2sh-segwit" for P2SH-P2WPKH
    print(f"\nNew address: {addr}")

    # generate 101 blocks to mature the coins
    proxy.generatetoaddress(101, addr)
     # get the balance of the wallet
    balance = proxy.getbalance()
    print(f"\nWallet balance: {balance}")

    #After that, just single block generation is needed to mature the coins
    proxy.generatetoaddress(1, addr)
    # get the balance again
    balance = proxy.getbalance()
    print(f"Wallet balance after generating another block: {balance}")

    # send some bitcoins to the new address
    txid = proxy.sendtoaddress(addr, 0.1)
    print(f"Transaction ID: {txid}")

    # get the transaction details
    tx_details = proxy.gettransaction(txid)
    print(f"Transaction details: {tx_details}")
    
    proxy.getaddressinfo(addr)

    proxy.listaddressgroupings()

    #import a private key
    pvtkey = "cRvyLwCPLU88jsyj94L7iJjQX5C2f8koG4G2gevN4BeSGcEvfKe9" #this is in WIP
    #desc_info_wpkh = proxy.getdescriptorinfo("wpkh(" + pvtkey + ")")
    desc_info_sh = proxy.getdescriptorinfo("sh(wpkh(" + pvtkey + "))")
    print(f"\nDescriptor info: {desc_info_sh}")
    #print(f"\n\nDescriptor info: {desc_info_wpkh}") 

    #import descriptor
    proxy.importdescriptors([
        {
            "desc": desc_info_sh['descriptor'],
            "timestamp": "now",
            "active": True,
            "label": "p2sh-wpkh_key"
         }#,
        # {
        #     "desc": desc_info_wpkh['descriptor'],
        #     "timestamp": "now",
        #     "active": True,
        #     "label": "wpkh_key"
        # }
    ])
    
    # get an address using the p2sh-wpkh descriptor
    p2sh_wpkh_addr = proxy.getnewaddress("p2sh-wpkh_address", "p2sh-segwit")
    print(f"\nP2SH-WPKH Address: {p2sh_wpkh_addr}") 
    tx_fund = proxy.sendtoaddress(p2sh_wpkh_addr, 0.1)
    tx_details = proxy.gettransaction(tx_fund)
    print(f"Transaction details: {tx_details}")

    print("\n\nList of descriptors in the wallet:")

    desc_list = proxy.listdescriptors(True)
    print(desc_list)

    proxy.unloadwallet('mywallet')
    print("Wallet unloaded successfully.")



if __name__ == "__main__":
    main()