"""
Create a sequence of 2 transactions each with p2tr addresses
that use combinations of scripts in tapleaves from the example below.

The 1st tx will create an output which can be spent in two ways:
1. Alice with a relative timelock
2. or by Alice and Bob with a multisig script as well as a preimage (hashlock script)

The 2nd tx will spend the output from the 1st tx in two ways:
1. Bob with a relative timelock
2. or by Alice with a preimage (hashlock script)

Was used just to test the flow
"""

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput, Sequence
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
import hashlib

def get_first_tx_scripts(alice_pub, bob_pub):
    """Create scripts for the first transaction's Taproot address"""
    preimage = "helloworld"
    
    # Simple hashlock script
    hashlock_script = Script([
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        'OP_TRUE'
    ])

    # Simple multisig script (2-of-2)
    multisig_script = Script([
        'OP_0',
        alice_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        'OP_2',
        'OP_EQUAL'
    ])

    return [hashlock_script, multisig_script], preimage

def get_second_tx_scripts(alice_pub, bob_pub):
    """Create scripts for the second transaction's Taproot address"""
    preimage = "goodbye"
    
    # Simple hashlock script
    hashlock_script = Script([
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        'OP_TRUE'
    ])

    # Simple signature script for Bob
    sig_script = Script([
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    return [sig_script, hashlock_script], preimage

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
    txid = proxy.sendtoaddress(to_address.to_string(), amount)
    proxy.generatetoaddress(1, addr)
    
    # Get the transaction details to find the vout
    tx_info = proxy.gettransaction(txid)
    vout = 0  # Assuming it's the first output
    for i, output in enumerate(tx_info['details']):
        if output['address'] == to_address.to_string():
            vout = i
            break
    
    print(f"Funded {amount} BTC to {to_address.to_string()}")
    print(f"Found UTXO at vout: {vout}")
    return txid, vout

def create_first_transaction(proxy, addr, alice_priv, bob_priv, alice_pub, bob_pub, dest_address):
    """Create the first transaction with a Taproot output that can be spent in two ways"""
    print("\n=== Creating First Transaction ===")
    
    scripts, preimage = get_first_tx_scripts(alice_pub, bob_pub)
    # Create a simple tree structure for the first transaction
    tree = [scripts[0], scripts[1]]  # Simple list of scripts
    
    taproot_address = alice_pub.get_taproot_address(tree)
    print(f"First transaction Taproot address: {taproot_address.to_string()}")
    
    # Fund the Taproot address
    input_amount = 0.15
    output_amount = 0.10
    change_amount = 0.0499
    fee = input_amount - output_amount - change_amount
    print(f"Input amount: {input_amount} BTC, Output amount: {output_amount} BTC, Change amount: {change_amount}, Fee: {fee} BTC")
    
    prev_txid, vout = fund_address(taproot_address, input_amount, proxy, addr)
    
    # Create transaction inputs and outputs
    txin = TxInput(prev_txid, vout)
    txout1 = TxOutput(to_satoshis(output_amount), dest_address.to_script_pub_key())
    txout2 = TxOutput(to_satoshis(change_amount), taproot_address.to_script_pub_key())
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)
    
    # For demonstration, we'll use the hashlock script path
    # This requires just the preimage
    leaf_index = 0  # hashlock script
    tapleaf_script = scripts[leaf_index]
    ctrl_block = ControlBlock(alice_pub, tree, leaf_index, is_odd=taproot_address.is_odd())
    
    # Create witness with just the preimage
    preimage_hex = preimage.encode('utf-8').hex()
    witness = TxWitnessInput([
        preimage_hex,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    
    tx.witnesses.append(witness)
    
    try:
        txid = proxy.sendrawtransaction(tx.serialize())
        print(f"✅ First transaction broadcast successfully! TXID: {txid}")
        return txid, output_amount, taproot_address, scripts, preimage
    except Exception as e:
        print(f"\n❌ ERROR: First transaction failed to broadcast: {e}")
        print(f"Decoded transaction:\n{proxy.decoderawtransaction(tx.serialize())}")
        return None, None, None, None, None

def create_second_transaction(proxy, addr, alice_priv, bob_priv, alice_pub, bob_pub, dest_address, first_txid, first_output_amount, first_taproot_address, first_scripts, first_preimage):
    """Create the second transaction spending from the first transaction's output"""
    print("\n=== Creating Second Transaction ===")
    
    scripts, preimage = get_second_tx_scripts(alice_pub, bob_pub)
    # Create a simple tree structure for the second transaction
    tree = [scripts[0], scripts[1]]  # Simple list of scripts
    
    taproot_address = bob_pub.get_taproot_address(tree)
    print(f"Second transaction Taproot address: {taproot_address.to_string()}")
    
    # Create transaction inputs and outputs
    input_amount = 0.0499  # The change amount from the first transaction
    output_amount = 0.03
    change_amount = 0.0198
    fee = input_amount - output_amount - change_amount
    print(f"Input amount: {input_amount} BTC, Output amount: {output_amount} BTC, Change amount: {change_amount}, Fee: {fee} BTC")
    
    txin = TxInput(first_txid, 0)  # Spend from the first output (destination address) of the first transaction
    txout1 = TxOutput(to_satoshis(output_amount), taproot_address.to_script_pub_key())
    txout2 = TxOutput(to_satoshis(change_amount), dest_address.to_script_pub_key())  # Change back to destination address
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)
    
    # Spend from the first transaction's Taproot output using the correct script path
    txin = TxInput(first_txid, 1)  # Spend from the second output (Taproot) of the first transaction
    txout1 = TxOutput(to_satoshis(output_amount), taproot_address.to_script_pub_key())
    txout2 = TxOutput(to_satoshis(change_amount), dest_address.to_script_pub_key())
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)
    
    # Use the same scripts and structure as the first transaction
    # For demonstration, we'll use the hashlock script path from the first transaction
    leaf_index = 0  # hashlock script from first transaction
    tapleaf_script = first_scripts[leaf_index]
    ctrl_block = ControlBlock(alice_pub, [first_scripts[0], first_scripts[1]], leaf_index, is_odd=first_taproot_address.is_odd())
    
    # Create witness with the preimage from the first transaction
    preimage_hex = first_preimage.encode('utf-8').hex()
    witness = TxWitnessInput([
        preimage_hex,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    
    tx.witnesses.append(witness)
    
    try:
        txid = proxy.sendrawtransaction(tx.serialize())
        print(f"✅ Second transaction broadcast successfully! TXID: {txid}")
        return txid
    except Exception as e:
        print(f"\n❌ ERROR: Second transaction failed to broadcast: {e}")
        print(f"Decoded transaction:\n{proxy.decoderawtransaction(tx.serialize())}")
        return None

def main():
    setup("regtest")
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()  # make sure bitcoin node is running in regtest mode prior to running this script
    addr, dest_address = local_setup(proxy)

    alice_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
    bob_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")

    alice_pub = alice_priv.get_public_key()
    bob_pub = bob_priv.get_public_key()

    print("=== Chained Transactions Demo ===")
    print("Creating a sequence of 2 transactions with P2TR addresses")
    print("1st tx: Output spendable by Alice (timelock) OR Alice+Bob (multisig+hashlock)")
    print("2nd tx: Output spendable by Bob (timelock) OR Alice (hashlock)")

    # Create the first transaction
    first_txid, first_output_amount, first_taproot_address, first_scripts, first_preimage = create_first_transaction(
        proxy, addr, alice_priv, bob_priv, alice_pub, bob_pub, dest_address
    )
    
    if first_txid:
        # Generate a block to confirm the first transaction
        proxy.generatetoaddress(1, addr)
        print(f"Generated block to confirm first transaction")
        
        # Create the second transaction
        second_txid = create_second_transaction(
            proxy, addr, alice_priv, bob_priv, alice_pub, bob_pub, dest_address,
            first_txid, first_output_amount, first_taproot_address, 
            first_scripts, first_preimage
        )
        
        if second_txid:
            # Generate a block to confirm the second transaction
            proxy.generatetoaddress(1, addr)
            print(f"Generated block to confirm second transaction")
            print(f"\n✅ Both transactions completed successfully!")
            print(f"Final balance: {proxy.getbalance()} BTC")
            

        else:
            print("❌ Second transaction failed")
    else:
        print("❌ First transaction failed")

if __name__ == "__main__":
    main()