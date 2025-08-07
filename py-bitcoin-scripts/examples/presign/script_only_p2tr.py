"""
Example: Create a P2TR address that can ONLY be spent via script path

This demonstrates how to use a NUMS (Nothing-Up-My-Sleeve) key as the internal key
to ensure that the P2TR address cannot be spent via key path, only via script path.

The NUMS key is a well-known public key that has no known private key, making it
impossible to spend via key path.

Author: Based on BIP-341 Taproot specification (https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)

Original 4 script Taproot Example from Author: Aaron Zhang (@aaron_recompile): 
"""

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey, PublicKey
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput, Sequence
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
import hashlib

def get_nums_key():
    """
    Returns the NUMS (Nothing-Up-My-Sleeve) key.
    This is a well-known public key that has no known private key.
    Using this as the internal key ensures the P2TR can only be spent via script path.
    
    The NUMS key is: 0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6
    """
    # This is the NUMS key from BIP-341
    nums_hex = "0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6"
    return PublicKey.from_hex(nums_hex)

def get_leaf_scripts(alice_pub, bob_pub):
    """Create script leaves for the Taproot address"""
    preimage = "helloworld"
    
    # Hashlock script
    hashlock_script = Script([
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        'OP_TRUE'
    ])

    # Multisig script (2-of-2)
    multisig_script = Script([
        'OP_0',
        alice_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        'OP_2',
        'OP_EQUAL'
    ])

    # CSV timelock script
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, 2)
    csv_script = Script([
        seq.for_script(),
        'OP_CHECKSEQUENCEVERIFY',
        'OP_DROP',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    # Simple signature script
    sig_script = Script([
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    return [hashlock_script, multisig_script, csv_script, sig_script], preimage

def local_setup(proxy):
    """Setup the Bitcoin node connection and generate initial coins"""
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
    return addr, dest_address

def fund_address(to_address, amount, proxy, addr): 
    """Fund the Taproot address and return the UTXO details"""
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

def main():
    setup("regtest")
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()
    addr, dest_address = local_setup(proxy)

    # Create keys for Alice and Bob
    alice_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
    bob_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")

    alice_pub = alice_priv.get_public_key()
    bob_pub = bob_priv.get_public_key()

    print("=== Script-Only P2TR Demo ===")
    print("Creating a P2TR address that can ONLY be spent via script path")
    print("This is achieved by using a NUMS key as the internal key")

    # Get the NUMS key (no known private key)
    nums_key = get_nums_key()
    print(f"NUMS Internal Key: {nums_key.to_hex()}")
    print("Note: This key has no known private key, so key path spending is impossible")

    # Create scripts
    scripts, preimage = get_leaf_scripts(alice_pub, bob_pub)
    
    # Create a 2x2 tree structure
    tree = [[scripts[0], scripts[1]], [scripts[2], scripts[3]]]
    
    # Create Taproot address using NUMS key as internal key
    taproot_address = nums_key.get_taproot_address(tree)
    print(f"Script-Only Taproot Address: {taproot_address.to_string()}")
    print("This address can ONLY be spent via script path, not key path!")

    # Fund the Taproot address
    input_amount = 0.15
    output_amount = 0.10
    change_amount = 0.0499
    fee = input_amount - output_amount - change_amount
    print(f"\nInput amount: {input_amount} BTC, Output amount: {output_amount} BTC, Change amount: {change_amount}, Fee: {fee} BTC")
    
    prev_txid, vout = fund_address(taproot_address, input_amount, proxy, addr)

    # Create transaction inputs and outputs
    txin = TxInput(prev_txid, vout)
    txout1 = TxOutput(to_satoshis(output_amount), dest_address.to_script_pub_key())
    txout2 = TxOutput(to_satoshis(change_amount), taproot_address.to_script_pub_key())
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)

    # Demonstrate spending via script path (hashlock)
    print("\n=== Spending via Script Path (Hashlock) ===")
    leaf_index = 0  # hashlock script
    tapleaf_script = scripts[leaf_index]
    ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=taproot_address.is_odd())

    # Create witness with preimage
    preimage_hex = preimage.encode('utf-8').hex()
    witness = TxWitnessInput([
        preimage_hex,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])

    tx.witnesses.append(witness)

    try:
        txid = proxy.sendrawtransaction(tx.serialize())
        print(f"✅ Script path spend successful! TXID: {txid}")
        
        # Generate a block to confirm
        proxy.generatetoaddress(1, addr)
        print(f"Transaction confirmed! Final balance: {proxy.getbalance()} BTC")
        
        print("\n=== Key Path Spending Attempt ===")
        print("If someone tried to spend this via key path, it would fail because:")
        print("1. The NUMS key has no known private key")
        print("2. Even if they tried to forge a signature, it would be invalid")
        print("3. The only valid spending path is via script path with correct witness")
        
    except Exception as e:
        print(f"\n❌ ERROR: Transaction failed to broadcast: {e}")
        print(f"Decoded transaction:\n{proxy.decoderawtransaction(tx.serialize())}")

if __name__ == "__main__":
    main()
