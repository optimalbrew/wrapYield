"""
# Taproot Comparison Example
# This demonstrates the key differences between key path and script path spending
# by creating two separate Taproot addresses and showing their characteristics
"""
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.utils import to_satoshis
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput
from bitcoinutils.keys import PrivateKey
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
    # STEP 1: Create two different Taproot addresses
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 1: Creating Taproot addresses for comparison")
    print("="*60)
    
    # Create keys for key path Taproot
    key_path_private_key = PrivateKey()
    key_path_public_key = key_path_private_key.get_public_key()
    
    print(f"Key Path Private Key (WIF): {key_path_private_key.to_wif()}")
    print(f"Key Path Public Key: {key_path_public_key.to_hex()}")
    print(f"Key Path X-only Public Key: {key_path_public_key.to_x_only_hex()}")
    
    # Create key path Taproot address (no scripts)
    key_path_address = key_path_public_key.get_taproot_address()
    print(f"Key Path Taproot Address: {key_path_address.to_string()}")
    print(f"Key Path Witness Program: {key_path_address.to_witness_program()}")
    
    # Create keys for script path Taproot
    script_path_internal_private_key = PrivateKey()
    script_path_internal_public_key = script_path_internal_private_key.get_public_key()
    
    script_key_1 = PrivateKey()
    script_key_2 = PrivateKey()
    
    print(f"\nScript Path Internal Private Key (WIF): {script_path_internal_private_key.to_wif()}")
    print(f"Script Path Internal Public Key: {script_path_internal_public_key.to_hex()}")
    print(f"Script Key 1 (WIF): {script_key_1.to_wif()}")
    print(f"Script Key 2 (WIF): {script_key_2.to_wif()}")
    
    # Create scripts for script path Taproot
    script_1 = Script([script_key_1.get_public_key().to_x_only_hex(), "OP_CHECKSIG"])
    script_2 = Script([
        "OP_2",
        script_key_1.get_public_key().to_x_only_hex(),
        script_key_2.get_public_key().to_x_only_hex(),
        "OP_2",
        "OP_CHECKMULTISIG"
    ])
    
    print(f"Script 1 (P2PK): {script_1.to_hex()}")
    print(f"Script 2 (2-of-2 multisig): {script_2.to_hex()}")
    
    # Create script path Taproot address
    script_path_scripts = [script_1, script_2]
    script_path_address = script_path_internal_public_key.get_taproot_address(script_path_scripts)
    
    print(f"Script Path Taproot Address: {script_path_address.to_string()}")
    print(f"Script Path Witness Program: {script_path_address.to_witness_program()}")
    
    # ============================================================================
    # STEP 2: Fund both addresses
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 2: Funding both Taproot addresses")
    print("="*60)
    
    # Fund key path address
    funding_amount_1 = 0.1
    tx_fund_1 = proxy.sendtoaddress(key_path_address.to_string(), funding_amount_1)
    print(f"Key Path Funding transaction ID: {tx_fund_1}")
    
    # Fund script path address
    funding_amount_2 = 0.15
    tx_fund_2 = proxy.sendtoaddress(script_path_address.to_string(), funding_amount_2)
    print(f"Script Path Funding transaction ID: {tx_fund_2}")
    
    # Generate a block to confirm the funding transactions
    proxy.generatetoaddress(1, addr)
    print(f"Balance after funding: {proxy.getbalance()} BTC")
    
    # Get transaction details
    tx_details_1 = proxy.gettransaction(tx_fund_1)
    tx_details_2 = proxy.gettransaction(tx_fund_2)
    
    # Find the outputs
    vout_1 = None
    vout_2 = None
    
    for detail in tx_details_1['details']:
        if detail['address'] == key_path_address.to_string():
            vout_1 = detail['vout']
            break
    
    for detail in tx_details_2['details']:
        if detail['address'] == script_path_address.to_string():
            vout_2 = detail['vout']
            break
    
    print(f"Key Path UTXO at vout: {vout_1}")
    print(f"Script Path UTXO at vout: {vout_2}")
    
    # ============================================================================
    # STEP 3: Demonstrate key path spending
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 3: Key Path Spending Demonstration")
    print("="*60)
    
    # Create destination address
    dest_private_key_1 = PrivateKey()
    dest_address_1 = dest_private_key_1.get_public_key().get_address()
    print(f"Destination address: {dest_address_1.to_string()}")
    
    # Create transaction input from the key path UTXO
    txin_1 = TxInput(tx_fund_1, vout_1)
    
    # Create transaction output
    spend_amount_1 = 0.09
    txout_1 = TxOutput(to_satoshis(spend_amount_1), dest_address_1.to_script_pub_key())
    
    # Create the transaction
    tx_1 = Transaction([txin_1], [txout_1], has_segwit=True)
    print(f"Key Path Raw unsigned transaction:\n{tx_1.serialize()}")
    
    # Sign using key path (simple case - no scripts)
    amounts_1 = [to_satoshis(funding_amount_1)]
    utxo_script_pubkeys_1 = [key_path_address.to_script_pub_key()]
    
    sig_1 = key_path_private_key.sign_taproot_input(
        tx_1,
        0,
        utxo_script_pubkeys_1,
        amounts_1,
        script_path=False,
        tweak=True
    )
    print(f"Key Path Signature: {sig_1}")
    
    # Add the witness (for key path, just the signature)
    tx_1.witnesses.append(TxWitnessInput([sig_1]))
    
    # Get the signed transaction
    signed_tx_1 = tx_1.serialize()
    print(f"Key Path Raw signed transaction:\n{signed_tx_1}")
    print(f"Key Path Transaction ID: {tx_1.get_txid()}")
    print(f"Key Path Transaction Size: {tx_1.get_size()} bytes")
    print(f"Key Path Virtual Size: {tx_1.get_vsize()} vbytes")
    
    # Broadcast the key path transaction
    txid_1 = proxy.sendrawtransaction(signed_tx_1)
    print(f"Key Path Broadcast transaction ID: {txid_1}")
    
    # ============================================================================
    # STEP 4: Demonstrate script path spending
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 4: Script Path Spending Demonstration")
    print("="*60)
    
    # Create destination address
    dest_private_key_2 = PrivateKey()
    dest_address_2 = dest_private_key_2.get_public_key().get_address()
    print(f"Destination address: {dest_address_2.to_string()}")
    
    # Create transaction input from the script path UTXO
    txin_2 = TxInput(tx_fund_2, vout_2)
    
    # Create transaction output
    spend_amount_2 = 0.14
    txout_2 = TxOutput(to_satoshis(spend_amount_2), dest_address_2.to_script_pub_key())
    
    # Create the transaction
    tx_2 = Transaction([txin_2], [txout_2], has_segwit=True)
    print(f"Script Path Raw unsigned transaction:\n{tx_2.serialize()}")
    
    # Sign using script path (script_1)
    amounts_2 = [to_satoshis(funding_amount_2)]
    utxo_script_pubkeys_2 = [script_path_address.to_script_pub_key()]
    
    sig_2 = script_key_1.sign_taproot_input(
        tx_2,
        0,
        utxo_script_pubkeys_2,
        amounts_2,
        script_path=True,
        tapleaf_script=script_1,
        tweak=False
    )
    print(f"Script Path Signature: {sig_2}")
    
    # Create the control block (merkle path)
    from bitcoinutils.utils import ControlBlock
    control_block = ControlBlock(script_path_internal_public_key, script_path_scripts, 0, is_odd=script_path_address.is_odd())
    print(f"Control Block: {control_block.to_hex()}")
    
    # Add the witness (signature + script + control block)
    tx_2.witnesses.append(TxWitnessInput([sig_2, script_1.to_hex(), control_block.to_hex()]))
    
    # Get the signed transaction
    signed_tx_2 = tx_2.serialize()
    print(f"Script Path Raw signed transaction:\n{signed_tx_2}")
    print(f"Script Path Transaction ID: {tx_2.get_txid()}")
    print(f"Script Path Transaction Size: {tx_2.get_size()} bytes")
    print(f"Script Path Virtual Size: {tx_2.get_vsize()} vbytes")
    
    # Broadcast the script path transaction
    txid_2 = proxy.sendrawtransaction(signed_tx_2)
    print(f"Script Path Broadcast transaction ID: {txid_2}")
    
    # Generate a block to confirm both transactions
    proxy.generatetoaddress(1, addr)
    print(f"Final balance: {proxy.getbalance()} BTC")
    
    # ============================================================================
    # STEP 5: Comparison and Analysis
    # ============================================================================
    print("\n" + "="*60)
    print("STEP 5: Comparison and Analysis")
    print("="*60)
    
    print("KEY PATH vs SCRIPT PATH COMPARISON:")
    print("="*40)
    print("Key Path Characteristics:")
    print(f"- Address: {key_path_address.to_string()}")
    print(f"- Witness Structure: [signature]")
    print(f"- Transaction Size: {tx_1.get_size()} bytes")
    print(f"- Virtual Size: {tx_1.get_vsize()} vbytes")
    print(f"- Complexity: Simple")
    print(f"- Efficiency: Most efficient")
    print(f"- Use Case: Simple payments")
    
    print("\nScript Path Characteristics:")
    print(f"- Address: {script_path_address.to_string()}")
    print(f"- Witness Structure: [signature, script, control_block]")
    print(f"- Transaction Size: {tx_2.get_size()} bytes")
    print(f"- Virtual Size: {tx_2.get_vsize()} vbytes")
    print(f"- Complexity: Complex")
    print(f"- Efficiency: Less efficient but more flexible")
    print(f"- Use Case: Advanced spending conditions")
    
    print("\n" + "="*60)
    print("TAPROOT COMPARISON COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("Summary:")
    print(f"- Key Path Transaction ID: {txid_1}")
    print(f"- Script Path Transaction ID: {txid_2}")
    print(f"- Key Path Private Key: {key_path_private_key.to_wif()}")
    print(f"- Script Path Internal Key: {script_path_internal_private_key.to_wif()}")
    print(f"- Script Keys: {script_key_1.to_wif()}, {script_key_2.to_wif()}")
    print(f"- Demonstrated both key path and script path spending methods!")


if __name__ == "__main__":
    main() 