"""
# Complete Taproot Script Path Example
# This demonstrates the full flow of:
# 1. Creating a Taproot address with script paths
# 2. Funding the Taproot address
# 3. Spending from the Taproot address using script path
"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput
from bitcoinutils.keys import PrivateKey


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
    # STEP 1: Create Taproot address with script paths
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating Taproot address with script paths")
    print("="*60)
    
    # Create the internal key (this will be tweaked for the Taproot address)
    internal_private_key = PrivateKey()
    internal_public_key = internal_private_key.get_public_key()
    
    print(f"Internal Private Key (WIF): {internal_private_key.to_wif()}")
    print(f"Internal Public Key: {internal_public_key.to_hex()}")
    print(f"Internal X-only Public Key: {internal_public_key.to_x_only_hex()}")
    
    # Create script keys for different spending conditions
    script_key_1 = PrivateKey()
    script_key_2 = PrivateKey()
    
    print(f"Script Key 1 (WIF): {script_key_1.to_wif()}")
    print(f"Script Key 2 (WIF): {script_key_2.to_wif()}")
    
    # Create different script types
    # Script 1: Simple P2PK
    script_1 = Script([script_key_1.get_public_key().to_x_only_hex(), "OP_CHECKSIG"])
    
    # Script 2: 2-of-2 multisig
    script_2 = Script([
        "OP_2",
        script_key_1.get_public_key().to_x_only_hex(),
        script_key_2.get_public_key().to_x_only_hex(),
        "OP_2",
        "OP_CHECKMULTISIG"
    ])
    
    print(f"Script 1 (P2PK): {script_1.to_hex()}")
    print(f"Script 2 (2-of-2 multisig): {script_2.to_hex()}")
    
    # Create Taproot address with scripts
    # We'll use a simple structure: [script_1, script_2]
    taproot_scripts = [script_1, script_2]
    taproot_address = internal_public_key.get_taproot_address(taproot_scripts)
    
    print(f"Taproot Address: {taproot_address.to_string()}")
    print(f"Witness Program: {taproot_address.to_witness_program()}")
    print(f"Address Type: {taproot_address.get_type()}")
    print(f"Is Odd: {taproot_address.is_odd()}")
    
    # ============================================================================
    # STEP 2: Fund the Taproot address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the Taproot address")
    print("="*60)
    
    # Send some BTC to the Taproot address
    funding_amount = 0.15
    tx_fund = proxy.sendtoaddress(taproot_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    print(f"Transaction details: {tx_details}")
    
    # Find the output that went to our Taproot address
    vout = None
    for detail in tx_details['details']:
        if detail['address'] == taproot_address.to_string():
            vout = detail['vout']
            break
    
    if vout is None:
        print("Error: Could not find the correct output")
        return
    
    print(f"Found UTXO at vout: {vout}")
    
    # ============================================================================
    # STEP 3: Create a transaction to spend from Taproot (script path)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Creating spend transaction from Taproot (script path)")
    print("="*60)
    
    # Create a destination address
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the Taproot UTXO
    txin = TxInput(tx_fund, vout)
    
    # Create transaction output (send most of the funds, leave some for fees)
    spend_amount = 0.14
    txout = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction (must set has_segwit=True for Taproot)
    tx = Transaction([txin], [txout], has_segwit=True)
    print(f"Raw unsigned transaction:\n{tx.serialize()}")
    
    # ============================================================================
    # STEP 4: Sign the transaction (script path)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Signing the transaction (script path)")
    print("="*60)
    
    # We'll spend using script_1 (simple P2PK)
    # For script path spending, we need:
    # 1. The UTXO amounts
    # 2. The scriptPubKeys of all inputs
    # 3. The specific script we're using
    # 4. The merkle path to that script
    
    amounts = [to_satoshis(funding_amount)]
    utxo_script_pubkeys = [taproot_address.to_script_pub_key()]
    
    # Sign with the script key (no tweaking needed for script path)
    sig = script_key_1.sign_taproot_input(
        tx,
        0,
        utxo_script_pubkeys,
        amounts,
        script_path=True,
        tapleaf_script=script_1,
        tweak=False  # Don't tweak for script path
    )
    print(f"Signature: {sig}")
    
    # Create the control block (merkle path)
    # We need to specify which script we're using (index 0 for script_1)
    control_block = ControlBlock(internal_public_key, taproot_scripts, 0, is_odd=taproot_address.is_odd())
    print(f"Control Block: {control_block.to_hex()}")
    
    # Add the witness (signature + script + control block)
    tx.witnesses.append(TxWitnessInput([sig, script_1.to_hex(), control_block.to_hex()]))
    
    # Get the signed transaction
    signed_tx = tx.serialize()
    print(f"Raw signed transaction:\n{signed_tx}")
    print(f"Transaction ID: {tx.get_txid()}")
    print(f"Witness Transaction ID: {tx.get_wtxid()}")
    print(f"Transaction Size: {tx.get_size()} bytes")
    print(f"Virtual Size: {tx.get_vsize()} vbytes")
    
    # ============================================================================
    # STEP 5: Broadcast the transaction
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 5: Broadcasting the transaction")
    print("="*60)
    
    # Broadcast the transaction
    txid = proxy.sendrawtransaction(signed_tx)
    print(f"Broadcast transaction ID: {txid}")
    
    # Generate a block to confirm the spend transaction
    proxy.generatetoaddress(1, addr)
    print(f"Final balance: {proxy.getbalance()} BTC")
    
    # ============================================================================
    # STEP 6: Verify the results
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 6: Verification")
    print("="*60)
    
    # Try to get raw transaction details
    try:
        raw_tx = proxy.getrawtransaction(txid, True)
        print(f"Raw transaction details: {raw_tx}")
        
        # Check if the transaction is confirmed
        if 'confirmations' in raw_tx:
            print(f"Transaction confirmations: {raw_tx['confirmations']}")
        
        # Check the output amount
        if 'vout' in raw_tx and len(raw_tx['vout']) > 0:
            output_amount = raw_tx['vout'][0]['value']
            print(f"Output amount: {output_amount} BTC")
            
        # Check the witness data
        if 'vin' in raw_tx and len(raw_tx['vin']) > 0:
            witness = raw_tx['vin'][0].get('txinwitness', [])
            print(f"Witness data: {witness}")
            
    except Exception as e:
        print(f"Could not get transaction details: {e}")
    
    print("\n" + "="*60)
    print("TAPROOT SCRIPT PATH FLOW COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Created Taproot address: {taproot_address.to_string()}")
    print(f"- Funded with: {funding_amount} BTC")
    print(f"- Spent: {spend_amount} BTC to {dest_address.to_string()}")
    print(f"- Transaction ID: {txid}")
    print(f"- Internal key (WIF): {internal_private_key.to_wif()}")
    print(f"- Script keys (WIF):")
    print(f"  Script 1: {script_key_1.to_wif()}")
    print(f"  Script 2: {script_key_2.to_wif()}")
    print(f"- Spending method: Script path (using script_1)")
    print(f"- Script used: {script_1.to_hex()}")


if __name__ == "__main__":
    main() 