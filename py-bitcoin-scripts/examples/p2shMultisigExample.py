"""
# Advanced P2SH example: 2-of-3 Multisignature P2SH address
# This demonstrates creating a P2SH address with a multisig redeem script
# and spending from it using multiple signatures
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
    # STEP 1: Create a 2-of-3 multisig P2SH address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating 2-of-3 multisig P2SH address")
    print("="*60)
    
    # Create 3 private keys for the multisig
    priv_key_1 = PrivateKey()
    priv_key_2 = PrivateKey()
    priv_key_3 = PrivateKey()
    
    # Get their public keys
    pub_key_1 = priv_key_1.get_public_key()
    pub_key_2 = priv_key_2.get_public_key()
    pub_key_3 = priv_key_3.get_public_key()
    
    print(f"Private Key 1 (WIF): {priv_key_1.to_wif()}")
    print(f"Private Key 2 (WIF): {priv_key_2.to_wif()}")
    print(f"Private Key 3 (WIF): {priv_key_3.to_wif()}")
    print(f"Public Key 1: {pub_key_1.to_hex()}")
    print(f"Public Key 2: {pub_key_2.to_hex()}")
    print(f"Public Key 3: {pub_key_3.to_hex()}")
    
    # Create 2-of-3 multisig redeem script: 2 <pubkey1> <pubkey2> <pubkey3> 3 OP_CHECKMULTISIG
    redeem_script = Script([
        "OP_2",  # Require 2 signatures
        pub_key_1.to_hex(),
        pub_key_2.to_hex(), 
        pub_key_3.to_hex(),
        "OP_3",  # Total of 3 public keys
        "OP_CHECKMULTISIG"
    ])
    print(f"Redeem Script: {redeem_script.to_hex()}")
    
    # Create P2SH address from the redeem script
    p2sh_address = P2shAddress.from_script(redeem_script)
    print(f"P2SH Address: {p2sh_address.to_string()}")
    
    # ============================================================================
    # STEP 2: Fund the multisig P2SH address
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding the multisig P2SH address")
    print("="*60)
    
    # Send some BTC to the P2SH address
    funding_amount = 0.15
    tx_fund = proxy.sendtoaddress(p2sh_address.to_string(), funding_amount)
    print(f"Funding transaction ID: {tx_fund}")
    
    # Generate a block to confirm the funding transaction
    proxy.generatetoaddress(1, addr)
    print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details to find the UTXO
    tx_details = proxy.gettransaction(tx_fund)
    
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
    # STEP 3: Create a transaction to spend from multisig P2SH
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Creating spend transaction from multisig P2SH")
    print("="*60)
    
    # Create a destination address
    dest_private_key = PrivateKey()
    dest_address = dest_private_key.get_public_key().get_address()
    print(f"Destination address: {dest_address.to_string()}")
    
    # Create transaction input from the P2SH UTXO
    txin = TxInput(tx_fund, vout)
    
    # Create transaction output (send most of the funds, leave some for fees)
    spend_amount = 0.14
    txout = TxOutput(to_satoshis(spend_amount), dest_address.to_script_pub_key())
    
    # Create the transaction
    tx = Transaction([txin], [txout])
    print(f"Raw unsigned transaction:\n{tx.serialize()}")
    
    # ============================================================================
    # STEP 4: Sign the transaction with 2 signatures (2-of-3)
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Signing the transaction with 2 signatures")
    print("="*60)
    
    # Sign with private key 1
    sig1 = priv_key_1.sign_input(tx, 0, redeem_script)
    print(f"Signature 1: {sig1}")
    
    # Sign with private key 2
    sig2 = priv_key_2.sign_input(tx, 0, redeem_script)
    print(f"Signature 2: {sig2}")
    
    # Set the scriptSig (unlocking script)
    # For multisig P2SH, the scriptSig contains: OP_0 <sig1> <sig2> <redeem_script>
    # Note: OP_0 is a dummy value for the first stack item (required by CHECKMULTISIG)
    txin.script_sig = Script(["OP_0", sig1, sig2, redeem_script.to_hex()])
    
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
            
    except Exception as e:
        print(f"Could not get transaction details: {e}")
    
    print("\n" + "="*60)
    print("MULTISIG P2SH FLOW COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Created 2-of-3 multisig P2SH address: {p2sh_address.to_string()}")
    print(f"- Funded with: {funding_amount} BTC")
    print(f"- Spent: {spend_amount} BTC to {dest_address.to_string()}")
    print(f"- Transaction ID: {txid}")
    print(f"- Redeem script: {redeem_script.to_hex()}")
    print(f"- Required 2 signatures from 3 possible keys")
    print(f"- Private keys (WIF):")
    print(f"  Key 1: {priv_key_1.to_wif()}")
    print(f"  Key 2: {priv_key_2.to_wif()}")
    print(f"  Key 3: {priv_key_3.to_wif()}")


if __name__ == "__main__":
    main() 