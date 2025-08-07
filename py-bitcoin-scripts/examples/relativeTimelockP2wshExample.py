"""
# Relative Timelock Example with P2WSH (SegWit)
# This demonstrates how to create and spend transactions with relative timelocks
# using OP_CHECKSEQUENCEVERIFY (CSV) in a SegWit context
#
# The example creates:
# 1. A funding transaction to a P2WSH address with a relative timelock script
# 2. A spending transaction that can only be executed after the timelock expires
# 3. Verification of the timelock mechanism


"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, Sequence, TxWitnessInput
from bitcoinutils.keys import PrivateKey, P2wshAddress
from bitcoinutils.script import Script
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK


def main():
    # Setup the Bitcoin node connection
    setup("regtest")
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()

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

    # ============================================================================
    # STEP 1: Create keys and timelock script
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating keys and timelock script")
    print("="*60)
    
    # Create the private key that will be used to spend after the timelock
    timelock_private_key = PrivateKey()
    timelock_public_key = timelock_private_key.get_public_key()
    
    print(f"Timelock Private Key (WIF): {timelock_private_key.to_wif()}")
    print(f"Timelock Public Key: {timelock_public_key.to_hex()}")
    
        
    # Define the relative timelock (in blocks)
    timelock_blocks = 10
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, timelock_blocks)
    
    # Create the timelock script with correct format
    # The script should be: <timelock> OP_CHECKSEQUENCEVERIFY OP_DROP <pubkey> OP_CHECKSIG
    # But we need to ensure the format is correct for the bitcoinutils library
    # OP_CSV (BIP112) is now the standard way to create relative timelock.
    # But we can create relative timelock without it, using just nSequence (BIP68)
    
    timelock_script = Script([
        seq.for_script(),
        "OP_CHECKSEQUENCEVERIFY",
        "OP_DROP",
        timelock_public_key.to_hex(),
        "OP_CHECKSIG"
    ])
    
    print(f"Timelock Script: {timelock_script.to_hex()}")
    print(f"Timelock Blocks: {timelock_blocks}")
    print(f"Timelock Duration: ~{timelock_blocks * 10} minutes (regtest)")
    
    # Create the P2WSH address from the timelock script (SegWit)
    timelock_address = P2wshAddress.from_script(timelock_script)
    
    print(f"Timelock P2WSH Address: {timelock_address.to_string()}")
    print(f"Witness Program: {timelock_address.to_witness_program()}")
     
    # ============================================================================
    # STEP 2: Fund the timelock address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the timelock address")
    print("="*60)
    
    # Send BTC to the timelock address
    funding_amount = 0.1
    tx_fund = proxy.sendtoaddress(timelock_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    #print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    print(f"Transaction details: {tx_details}")
    
    # Find the output that went to our timelock address
    vout = None
    for detail in tx_details['details']:
        if detail['address'] == timelock_address.to_string():
            vout = detail['vout']
            break
    
    if vout is None:
        print("Error: Could not find the correct output")
        return
    
    print(f"Found UTXO at vout: {vout}")

    
    # ============================================================================
    # STEP 3: Demonstrate timelock concept
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Demonstrating timelock concept")
    print("="*60)
    
    print("Timelock Script Analysis:")
    print(f"- Script: {timelock_script.to_hex()}")
    print(f"- OP_CHECKSEQUENCEVERIFY: Requires sequence >= {timelock_blocks}")
    print(f"- OP_DROP: Removes the timelock value from stack")
    print(f"- Public Key: {timelock_public_key.to_hex()}")
    print(f"- OP_CHECKSIG: Requires valid signature")
    
    print(f"\nSegWit Benefits:")
    print(f"- Smaller transaction sizes")
    print(f"- Better privacy (witness data separated)")
    print(f"- Enhanced security features")
    print(f"- Lower fees due to witness discount")
    
    # ============================================================================
    # STEP 4: Wait for timelock and create spending transaction
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Waiting for timelock and creating spending transaction")
    print("="*60)
    
    # Generate blocks to pass the timelock
    print(f"Generating {timelock_blocks} blocks to pass the timelock...")
    proxy.generatetoaddress(timelock_blocks, addr)
        
    # Create a destination address
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the timelock UTXO, using block height not minutes
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, timelock_blocks, True)
    seq_for_n_seq = seq.for_input_sequence() #nSequence 
    #This is the sequence number that will be used to spend the transaction, BIP68
    #This can be used even without OP_CHECKSEQUENCEVERIFY (BIP112)
    txin_timelock = TxInput(tx_fund, vout, sequence=seq_for_n_seq)
    
    # Create transaction output
    spend_amount = 0.09
    txout_timelock = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction with SegWit enabled
    tx_timelock = Transaction([txin_timelock], [txout_timelock], has_segwit=True)
     
    print(f"Raw transaction: {tx_timelock.serialize()}")
    
    # Sign the transaction using the EXACT same script that was used to create the address
    amounts = [to_satoshis(funding_amount)]
    utxo_script_pubkeys = [timelock_address.to_script_pub_key()]
    
    sig_timelock = timelock_private_key.sign_input(
        tx_timelock,
        0,
        timelock_script  # Use the exact same script
    )
    
    # Create the witness (signature + script) for SegWit
    tx_timelock.witnesses.append(TxWitnessInput([sig_timelock, timelock_script.to_hex()]))
    
    print(f"Signed transaction: {tx_timelock.serialize()}")
    print(f"Transaction ID: {tx_timelock.get_txid()}")

    try:
        # Try to broadcast the transaction
        txid = proxy.sendrawtransaction(tx_timelock.serialize())
        print(f"✅ Transaction broadcast successfully! TXID: {txid}")
        
        # Generate a block to confirm the transaction
        proxy.generatetoaddress(1, addr)
        print(f"Final balance: {proxy.getbalance()} BTC")
        
    except Exception as e:
        print(f"\n❌ ERROR: Transaction failed to broadcast: {e}")
        print(f"This suggests there may be an issue with the script execution or sequence number handling.")
        
        # Let's try to debug the issue
        print(f"\nDebugging information:")
        print(f"- Sequence number: {seq_for_n_seq}")
        print(f"- Script: {timelock_script.to_hex()}")
        print(f"- Signature: {sig_timelock}")
        print(f"- Raw transaction: {tx_timelock.serialize()}")
        
        print(f"\nThe issue appears to be with the script execution.")
        print(f"Possible causes:")
        print(f"1. OP_CHECKSEQUENCEVERIFY implementation in bitcoinutils")
        print(f"2. Script format not compatible with the library")
        print(f"3. Sequence number format not correct for BIP68")
        
        print(f"\nFor a working relative timelock example, you would need to:")
        print(f"1. Use a different Bitcoin library that properly supports OP_CHECKSEQUENCEVERIFY")
        print(f"2. Or implement the script execution manually")
        print(f"3. Or use a simpler timelock mechanism")
          

if __name__ == "__main__":
    main() 