"""
# Complete P2SH example: Create, fund, and spend from a P2SH address
# This demonstrates the full flow of:
# 1. Creating a P2SH address with a custom redeem script
# 2. Funding the P2SH address
# 3. Spending from the P2SH address
"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput
from bitcoinutils.keys import P2pkhAddress, PrivateKey, P2shAddress
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
    # STEP 1: Create a P2SH address with a custom redeem script
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating P2SH address with custom redeem script")
    print("="*60)
    
    # Create a private key for the P2SH spending
    p2sh_private_key = PrivateKey()
    p2sh_public_key = p2sh_private_key.get_public_key()
    
    print(f"Private Key (WIF): {p2sh_private_key.to_wif()}")
    print(f"Public Key: {p2sh_public_key.to_hex()}")
    
    # Create a simple redeem script: <pubkey> OP_CHECKSIG
    # This is a basic P2PK script wrapped in P2SH
    redeem_script = Script([p2sh_public_key.to_hex(), "OP_CHECKSIG"])
    print(f"Redeem Script: {redeem_script.to_hex()}")
    
    # Create P2SH address from the redeem script
    p2sh_address = P2shAddress.from_script(redeem_script)
    print(f"P2SH Address: {p2sh_address.to_string()}")
    
    # ============================================================================
    # STEP 2: Fund the P2SH address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the P2SH address")
    print("="*60)
    
    # Send some BTC to the P2SH address
    funding_amount = 0.1
    tx_fund = proxy.sendtoaddress(p2sh_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    #print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    print(f"Transaction details: {tx_details}")
    
    # Find the output that went to our P2SH address
    vout = None
    for detail in tx_details['details']:
        if detail['address'] == p2sh_address.to_string():
            vout = detail['vout']
            break
    
    if vout is None:
        print("Error: Could not find the correct output")
        return
    
    print(f"Found UTXO at vout: {vout}")
    
    # ============================================================================
    # STEP 3: Create a transaction to spend from P2SH
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Creating spend transaction from P2SH")
    print("="*60)
    
    # Create a destination address (P2PKH)
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the P2SH UTXO
    txin = TxInput(tx_fund, vout)
    
    # Create transaction output (send most of the funds, leave some for fees)
    spend_amount = 0.09
    txout = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction
    tx = Transaction([txin], [txout]) #see taproot example for has_segwit=True
    print(f"Raw unsigned transaction:\n{tx.serialize()}")
    
    # ============================================================================
    # STEP 4: Sign the transaction
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Signing the transaction")
    print("="*60)
    
    # Sign the input using the private key and redeem script 
    # and the index of the input being signed (this is NOT the vout!)
    sig = p2sh_private_key.sign_input(tx, 0, redeem_script)
    print(f"Signature: {sig}")
    
    # Set the scriptSig (unlocking script)
    # For P2SH, the scriptSig contains: <signature> <redeem_script>
    txin.script_sig = Script([sig, redeem_script.to_hex()])
    
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
    
    print("\n" + "="*60)
    print("P2SH FLOW COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Created P2SH address: {p2sh_address.to_string()}")
    print(f"- Funded with: {funding_amount} BTC")
    print(f"- Spent: {spend_amount} BTC to {dest_address.to_string()}")
    print(f"- Transaction ID: {txid}")
    print(f"- Redeem script: {redeem_script.to_hex()}")
    print(f"- Private key (WIF): {p2sh_private_key.to_wif()}")


if __name__ == "__main__":
    main()
