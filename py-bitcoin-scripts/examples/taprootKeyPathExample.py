"""
# Complete Taproot Key Path Example
# This demonstrates the full flow of:
# 1. Creating a Taproot address (key path only)
# 2. Funding the Taproot address
# 3. Spending from the Taproot address using key path
"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput
from bitcoinutils.keys import PrivateKey, P2trAddress


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
    # STEP 1: Create a Taproot address (key path only)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating Taproot address (key path only)")
    print("="*60)
    
    # Create a private key for the Taproot address
    taproot_private_key = PrivateKey()
    taproot_public_key = taproot_private_key.get_public_key()
    
    print(f"Private Key (WIF): {taproot_private_key.to_wif()}")
    print(f"Public Key: {taproot_public_key.to_hex()}")
    print(f"X-only Public Key: {taproot_public_key.to_x_only_hex()}")
    
    # Create Taproot address from the public key (key path only)
    taproot_address = taproot_public_key.get_taproot_address()
    print(f"Taproot Address: {taproot_address.to_string()}")
    print(f"Witness Program: {taproot_address.to_witness_program()}")
    print(f"Address Type: {taproot_address.get_type()}")
    
    # ============================================================================
    # STEP 2: Fund the Taproot address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the Taproot address")
    print("="*60)
    
    # Send some BTC to the Taproot address
    funding_amount = 0.1
    tx_fund = proxy.sendtoaddress(taproot_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    #print(f"Balance after funding: {proxy.getbalance()} BTC")
    
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
    # STEP 3: Create a transaction to spend from Taproot (key path)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Creating spend transaction from Taproot (key path)")
    print("="*60)
    
    # Create a destination address (P2PKH for simplicity)
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the Taproot UTXO
    txin = TxInput(tx_fund, vout)
    
    # Create transaction output (send most of the funds, leave some for fees)
    spend_amount = 0.09
    txout = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction (must set has_segwit=True for Taproot)
    tx = Transaction([txin], [txout], has_segwit=True)
    print(f"Raw unsigned transaction:\n{tx.serialize()}")
    
    # ============================================================================
    # STEP 4: Sign the transaction (key path)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Signing the transaction (key path)")
    print("="*60)
    
    # For key path spending, we need:
    # 1. The UTXO amounts
    # 2. The scriptPubKeys of all inputs
    amounts = [to_satoshis(funding_amount)]
    utxo_script_pubkeys = [taproot_address.to_script_pub_key()]
    
    # Sign the input using the private key (key path spending)
    # The private key is automatically tweaked for Taproot
    sig = taproot_private_key.sign_taproot_input(
        tx, 
        0, 
        utxo_script_pubkeys, 
        amounts,
        script_path=False  # This is key path spending
    )
    print(f"Signature: {sig}")
    
    # Add the witness (for key path, just the signature)
    tx.witnesses.append(TxWitnessInput([sig]))
    
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
    print("TAPROOT KEY PATH FLOW COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Created Taproot address: {taproot_address.to_string()}")
    print(f"- Funded with: {funding_amount} BTC")
    print(f"- Spent: {spend_amount} BTC to {dest_address.to_string()}")
    print(f"- Transaction ID: {txid}")
    print(f"- Private key (WIF): {taproot_private_key.to_wif()}")
    print(f"- Public key: {taproot_public_key.to_hex()}")
    print(f"- X-only public key: {taproot_public_key.to_x_only_hex()}")
    print(f"- Spending method: Key path (direct signature)")


if __name__ == "__main__":
    main() 