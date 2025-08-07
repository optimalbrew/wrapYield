"""
Spends 3 inputs one of which is not segwit
Thus, 2 inputs (from p2tr) use witness stack and 1 uses sigscript
"""


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

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput
from bitcoinutils.keys import P2pkhAddress, PrivateKey
from bitcoinutils.script import Script


def local_setup(proxy):
    # Setup the Bitcoin node connection
    try:
        proxy.loadwallet('mywallet')
        print('Loaded mywallet')
    except:
        try:
            print("Loading failed. Try creating wallet 'mywallet'.")
            proxy.createwallet('mywallet')
        except:
            print("Error creating wallet 'mywallet'. Maybe already loaded")

    # Generate some initial coins
    addr = proxy.getnewaddress("first_address", "bech32")
    proxy.generatetoaddress(101, addr)
    print(f'\nInitial Balance: {proxy.getbalance()} BTC')
    
    # generate a destination address
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    #return the node proxy and destination address
    return addr, dest_address

#return the txid and vout of the utxo
def fund_address(to_address, amount, proxy, addr): 
    # Send some BTC to the Taproot address
    funding_amount = amount
    tx_fund = proxy.sendtoaddress(to_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}") 
    # Generate 10 block to confirm the funding transaction and for op_CSV
    proxy.generatetoaddress(10, addr)
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    #print(f"Transaction details: {tx_details}")
    
    # Find the output that went to our Taproot address
    vout = None
    for detail in tx_details['details']:
        if detail['address'] == to_address.to_string():
            vout = detail['vout']
            break
    
    if vout is None:
        print("Error: Could not find the correct output")
        return
    
    print(f"Found UTXO at vout: {vout}")
    return tx_fund, vout
    
def main():
    
    setup("regtest")
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()# make sure bitcoin node is running in regtest mode prior to running this script
    addr, dest_address = local_setup(proxy)

    # the key that corresponds to the P2WPKH address
    priv1 = PrivateKey("cV3R88re3AZSBnWhBBNdiCKTfwpMKkYYjdiR13HQzsU7zoRNX7JL")
    priv2 = PrivateKey("cSfna7riKJdNU7skpRUx17WYANNsyHTA2FmuzLpFzpp37xpytgob")
    priv3 = PrivateKey("cNxX8M7XU8VNa5ofd8yk1eiZxaxNrQQyb7xNpwAmsrzEhcVwtCjs")

    pub1 = priv1.get_public_key()
    pub2 = priv2.get_public_key()
    pub3 = priv3.get_public_key()

    fromAddress1 = pub1.get_taproot_address()
    fromAddress2 = pub2.get_address()
    fromAddress3 = pub3.get_taproot_address()
    print(fromAddress1.to_string())
    print(fromAddress2.to_string())
    print(fromAddress3.to_string())

    # all amounts are needed to sign a taproot input
    # (depending on sighash)
    amount1 = 0.00005
    amount2 = 0.0001312
    amount3 = 0.00005
    amounts = [to_satoshis(amount1), to_satoshis(amount2), to_satoshis(amount3)]

    # Fund the 3 fromAddress's to generate the UTXO's
    txid1, vout1 = fund_address(fromAddress1, amount1, proxy, addr)
    txid2, vout2 = fund_address(fromAddress2, amount2, proxy, addr)
    txid3, vout3 = fund_address(fromAddress3, amount3, proxy, addr)

    # all scriptPubKeys are needed to sign a taproot input
    # (depending on sighash) but always of the spend input
    script_pubkey1 = fromAddress1.to_script_pub_key()
    script_pubkey2 = fromAddress2.to_script_pub_key()
    script_pubkey3 = fromAddress3.to_script_pub_key()
    utxos_script_pubkeys = [script_pubkey1, script_pubkey2, script_pubkey3]

    toAddress = P2pkhAddress("mtVHHCqCECGwiMbMoZe8ayhJHuTdDbYWdJ")

    # create transaction input from tx id of UTXO
    txin1 = TxInput(txid1, vout1)
    txin2 = TxInput(txid2, vout2)
    txin3 = TxInput(txid3, vout3)

    # create transaction output
    txOut = TxOutput(to_satoshis(0.00022), toAddress.to_script_pub_key())

    # create transaction without change output - if at least a single input is
    # segwit we need to set has_segwit=True
    tx = Transaction([txin1, txin2, txin3], [txOut], has_segwit=True)

    print("\nRaw transaction:\n" + tx.serialize())

    print("\ntxid: " + tx.get_txid())
    print("\ntxwid: " + tx.get_wtxid())

    # sign taproot input
    # to create the digest message to sign in taproot we need to
    # pass all the utxos' scriptPubKeys and their amounts
    sig1 = priv1.sign_taproot_input(tx, 0, utxos_script_pubkeys, amounts)
    sig2 = priv2.sign_input(tx, 1, utxos_script_pubkeys[1])
    sig3 = priv3.sign_taproot_input(tx, 2, utxos_script_pubkeys, amounts)

    #set witness sets the witness at a particular input index
    tx.set_witness(0, TxWitnessInput([sig1]))
    txin2.script_sig = Script([sig2, pub2.to_hex()])
    tx.set_witness(2, TxWitnessInput([sig3]))

    try:
        # Try to broadcast the transaction
        txid = proxy.sendrawtransaction(tx.serialize())
        print(f"✅ Transaction broadcast successfully! TXID: {txid}")         
    except Exception as e:
        print(f"\n❌ ERROR: Transaction failed to broadcast: {e}")
        #Decode the inputs to the raw transaction to inspect it
        print(f"Decoded transaction:\n{proxy.decoderawtransaction(tx.serialize())}")


if __name__ == "__main__":
    main()