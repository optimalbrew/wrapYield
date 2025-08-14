"""
Modified (original example from @aaron_recompile)

Start with spend_p2tr_four_scripts_by_script_path.py 
* uses a bitcoin node in regtest mode
* then add NUMS key as internal key - to ensure the P2TR can only be spent via script path ✅
* then add a script path that is a hashlock and a siglock ✅    
* then add a script path that is both a hashlock and a multisig ✅

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
        'OP_EQUAL' #chatgpt 5 The BIP342 pattern is: <pk1> OP_CHECKSIG <pk2> OP_CHECKSIGADD 2 OP_NUMEQUALVERIFY
    ])

    seq = Sequence(TYPE_RELATIVE_TIMELOCK, 144)
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

    #fail fast: checking hash is easier than verifying schnorr sig, so we can do that first
    hashlock_and_siglock_script = Script([ 
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    #try the other way around: this is not advised, because checking the hash is easier (fast fail)
    # hashlock_and_siglock_script_2 = Script([
    #     bob_pub.to_x_only_hex(),
    #     'OP_CHECKSIGVERIFY', #using op_chekSig leaves a 1 on the stack, we don't want that
    #     'OP_SHA256',
    #     hashlib.sha256(preimage.encode()).hexdigest(),
    #     'OP_EQUALVERIFY',
    #     'OP_TRUE'
    # ])

    hashlock_and_multisig_script = Script([
        'OP_SHA256',
        hashlib.sha256(preimage.encode()).hexdigest(),
        'OP_EQUALVERIFY',
        alice_pub.to_x_only_hex(),
        'OP_CHECKSIG',
        bob_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        'OP_2',
        'OP_NUMEQUALVERIFY', #will leave nothing, so add op_true to make it work.
        #'OP_EQUAL' #using op_equal instead of op_numequalverify does not need op_true
        'OP_TRUE'
    ])
    return [hashlock_script, multisig_script, csv_script, sig_script, hashlock_and_siglock_script, hashlock_and_multisig_script], preimage


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
    # hashlock, multisig, csv, siglock, hashlock and siglock, hashlock and multisig
    tree = [[[scripts[0], scripts[1]], [scripts[2], scripts[3]]], [scripts[4], scripts[5]]]

    nums_key = get_nums_key()

    taproot_address = nums_key.get_taproot_address(tree)
    print("Taproot address:", taproot_address.to_string())

    leaf_index = 2
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
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())

        # Hashlock script path
        preimage_hex = preimage.encode('utf-8').hex()
        witness = TxWitnessInput([
            preimage_hex,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    elif leaf_index == 1:
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())
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
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())
        # CSV timelock script path - need to set sequence
        seq = Sequence(TYPE_RELATIVE_TIMELOCK, 144)
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
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())
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
    elif leaf_index == 4:
        print("Spending from Hashlock and Siglock script path")
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())
        # Hashlock and siglock script path
        sig = bob_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        preimage_hex = preimage.encode('utf-8').hex()
        witness = TxWitnessInput([
            sig,
            preimage_hex,
            tapleaf_script.to_hex(),
            ctrl_block.to_hex()
        ])
    elif leaf_index == 5:
        print("Spending from Hashlock and Multisig script path")
        tapleaf_script = scripts[leaf_index]
        ctrl_block = ControlBlock(nums_key,tree,leaf_index, is_odd=taproot_address.is_odd())
        # Hashlock and siglock script path
        sig_Bob = bob_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        sig_Alice = alice_priv.sign_taproot_input(
            tx, 0,
            [taproot_address.to_script_pub_key()],
            [to_satoshis(input_amount)],
            script_path=True,
            tapleaf_script=tapleaf_script,
            tweak=False
        )
        preimage_hex = preimage.encode('utf-8').hex()
        witness = TxWitnessInput([
            sig_Bob,
            sig_Alice,
            preimage_hex,
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
        #for csv, we need to advance the chain by the timelock
        proxy.generatetoaddress(144, addr)
        txid = proxy.sendrawtransaction(tx.serialize())
        print(f"✅ Transaction broadcast successfully! TXID: {txid}")         
    except Exception as e:
        print(f"\n❌ ERROR: Transaction failed to broadcast: {e}")
        #Decode the inputs to the raw transaction to inspect it
        print(f"Decoded transaction:\n{proxy.decoderawtransaction(tx.serialize())}")

if __name__ == "__main__":
    main()