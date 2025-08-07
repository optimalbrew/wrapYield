"""
Example: Spend from a 4-leaf Taproot address via Script Path (Hashlock, Multisig, CSV, or Siglock)

Merkle Tree Layout:
#         Merkle Root
#         /        \
#    Branch0      Branch1  
#   /      \      /      \
# S0       S1     S2      S3
Hashlock Multi  CSV     Siglock

This script allows spending from any of the four script paths using the correct ControlBlock and Witness stack.

Author: Aaron Zhang (@aaron_recompile)
"""

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput, Sequence
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
import hashlib

def get_leaf_scripts(alice_pub, bob_pub):
    preimage = "helloworld"
    hashlock_script = Script([
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        'OP_TRUE'
    ])

    multisig_script = Script([
        'OP_0',
        alice_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        'OP_2',
        'OP_EQUAL'
    ])

    seq = Sequence(TYPE_RELATIVE_TIMELOCK, 2)
    csv_script = Script([
        seq.for_script(),
        'OP_CHECKSEQUENCEVERIFY',
        'OP_DROP',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    sig_script = Script([
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    return [hashlock_script, multisig_script, csv_script, sig_script], preimage


def local_setup(proxy):
    # Setup the Bitcoin node connecti
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

    alice_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
    bob_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")

    alice_pub = alice_priv.get_public_key()
    bob_pub = bob_priv.get_public_key()

    scripts, preimage = get_leaf_scripts(alice_pub, bob_pub)
    # hashlock, multisig, csv, siglock
    tree = [[scripts[0], scripts[1]], [scripts[2], scripts[3]]]

    taproot_address = alice_pub.get_taproot_address(tree)
    print("Taproot address:", taproot_address.to_string())

    leaf_index = 3
    # Input the index of the script to spend
    tapleaf_script = scripts[leaf_index]
 
    # Input your UTXO info here
    input_amount = 0.15 #initial amount to fund to p2tr address
    output_amount = 0.10
    change_amount = 0.0499
    fee = input_amount - output_amount - change_amount
    print(f"Input amount: {input_amount} BTC, Output amount: {output_amount} BTC, Change amount: {change_amount}, Fee: {fee} BTC BTC")
    prev_txid, vout = fund_address(taproot_address, input_amount, proxy, addr)
    

    # Input your receiver address here
    #receiver_address = dest_address.to_string()
    #print(f"Receiver address: {receiver_address}")

    # Create transaction inputs and outputs
    txin = TxInput(prev_txid, vout)
    #print transaction details
    print(f"Transaction details: {proxy.gettxout(prev_txid, vout)}")

    # Create Script objects for both outputs
    txout1 = TxOutput(to_satoshis(output_amount), dest_address.to_script_pub_key())
    txout2 = TxOutput(to_satoshis(change_amount), taproot_address.to_script_pub_key())  # change back to same Taproot
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)

    # Handle different script paths based on leaf_index
    if leaf_index == 0:
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(alice_pub,tree,leaf_index, is_odd=taproot_address.is_odd())

        # Hashlock script path
        preimage_hex = preimage.encode('utf-8').hex()
        witness = TxWitnessInput([
            preimage_hex,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    elif leaf_index == 1:
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(alice_pub,tree,leaf_index, is_odd=taproot_address.is_odd())
        # Multisig script path
        sigB = bob_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        sigA = alice_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        witness = TxWitnessInput([
            sigB, sigA,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    elif leaf_index == 2:
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(alice_pub,tree,leaf_index, is_odd=taproot_address.is_odd())
        # CSV timelock script path - need to set sequence
        seq = Sequence(TYPE_RELATIVE_TIMELOCK, 2)
        seq_for_n_seq = seq.for_input_sequence()
        assert seq_for_n_seq is not None
        txin.sequence = seq_for_n_seq
        
        sig = bob_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        witness = TxWitnessInput([
            sig,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    elif leaf_index == 3:
        print("Spending from Siglock script path")
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(alice_pub,tree,leaf_index, is_odd=taproot_address.is_odd())
        # Simple siglock script path
        sig = bob_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        witness = TxWitnessInput([
            sig,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    else:
        raise Exception("Invalid leaf index")

    tx.witnesses.append(witness)

    #print("Final transaction (raw):")
    #print(tx.serialize())

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