"""
# Complete P2WSH example: Create, fund, and spend from a P2WSH address
# This demonstrates the full flow of:
# 1. Creating a P2WSH address with a custom witness script
# 2. Funding the P2WSH address
# 3. Spending from the P2WSH address using witness data
"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput
from bitcoinutils.keys import P2pkhAddress, PrivateKey, P2wshAddress
from bitcoinutils.script import Script


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
    # STEP 1: Create a P2WSH address with a custom witness script
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating P2WSH address with custom witness script")
    print("="*60)
    
    # Create a private key for the P2WSH spending
    p2wsh_private_key = PrivateKey()
    p2wsh_public_key = p2wsh_private_key.get_public_key()
    
    print(f"Private Key (WIF): {p2wsh_private_key.to_wif()}")
    print(f"Public Key: {p2wsh_public_key.to_hex()}")
    
    # Create a simple witness script: <pubkey> OP_CHECKSIG
    # This is a basic P2PK script wrapped in P2WSH
    witness_script = Script([p2wsh_public_key.to_hex(), "OP_CHECKSIG"])
    print(f"Witness Script: {witness_script.to_hex()}")
    
    # Create P2WSH address from the witness script
    p2wsh_address = P2wshAddress.from_script(witness_script)
    print(f"P2WSH Address: {p2wsh_address.to_string()}")
    print(f"Witness Program: {p2wsh_address.to_witness_program()}")
    
    # ============================================================================
    # STEP 2: Fund the P2WSH address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the P2WSH address")
    print("="*60)
    
    # Send some BTC to the P2WSH address
    funding_amount = 0.1
    tx_fund = proxy.sendtoaddress(p2wsh_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    #print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    print(f"Transaction details: {tx_details}")
    
    # Find the output that went to our P2WSH address
    vout = None
    for detail in tx_details['details']:
        if detail['address'] == p2wsh_address.to_string():
            vout = detail['vout']
            break
    
    if vout is None:
        print("Error: Could not find the correct output")
        return
    
    print(f"Found UTXO at vout: {vout}")
    
    # ============================================================================
    # STEP 3: Create a transaction to spend from P2WSH
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Creating spend transaction from P2WSH")
    print("="*60)
    
    # Create a destination address (P2PKH)
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the P2WSH UTXO
    txin = TxInput(tx_fund, vout)
    
    # Create transaction output (send most of the funds, leave some for fees)
    spend_amount = 0.09
    txout = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction with SegWit enabled
    tx = Transaction([txin], [txout], has_segwit=True)
    print(f"Raw unsigned transaction:\n{tx.serialize()}")
    
    # ============================================================================
    # STEP 4: Sign the transaction
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Signing the transaction")
    print("="*60)
    
    # Sign the input using the private key and witness script 
    # and the index of the input being signed (this is NOT the vout!)
    sig = p2wsh_private_key.sign_input(tx, 0, witness_script)
    print(f"Signature: {sig}")
    
    # Create the witness (signature + witness script)
    # For P2WSH, the witness contains: <signature> <witness_script>
    tx.witnesses.append(TxWitnessInput([sig, witness_script.to_hex()]))
    
    # Get the signed transaction
    signed_tx = tx.serialize()
    print(f"Raw signed transaction:\n{signed_tx}")
    print(f"Transaction ID: {tx.get_txid()}")
    
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
    
    # Try to get raw transaction details (works for any transaction)
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
            
    except Exception as e:
        print(f"Could not get transaction details: {e}")
    
    # ============================================================================
    # STEP 7: Demonstrate SegWit benefits
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 7: SegWit Benefits Analysis")
    print("="*60)
    
    print("SegWit Benefits Demonstrated:")
    print("✅ Smaller transaction sizes (witness data separated)")
    print("✅ Better privacy (witness doesn't affect transaction ID)")
    print("✅ Enhanced security (improved script execution model)")
    print("✅ Lower fees (witness data gets discount)")
    print("✅ Future-proof (enables Lightning Network, Taproot)")
    
    print(f"\nTransaction Structure Comparison:")
    print(f"- P2SH: Uses script_sig in transaction data")
    print(f"- P2WSH: Uses witness data (separated from transaction)")
    print(f"- Address Format: Bech32 (bcrt1...) vs Base58 (2N...)")
    
    print("\n" + "="*60)
    print("P2WSH FLOW COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Created P2WSH address: {p2wsh_address.to_string()}")
    print(f"- Witness Program: {p2wsh_address.to_witness_program()}")
    print(f"- Funded with: {funding_amount} BTC")
    print(f"- Spent: {spend_amount} BTC to {dest_address.to_string()}")
    print(f"- Transaction ID: {txid}")
    print(f"- Witness script: {witness_script.to_hex()}")
    print(f"- Private key (WIF): {p2wsh_private_key.to_wif()}")
    print(f"- SegWit transaction format demonstrated!")


if __name__ == "__main__":
    main() 