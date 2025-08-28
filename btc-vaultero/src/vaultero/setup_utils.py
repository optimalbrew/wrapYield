#from bitcoinutils.setup import setup
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey

setup("regtest")

def local_setup(proxy: NodeProxy):
    # Setup the Bitcoin node connecti
    try:
        #check if wallet exists
        wallets = proxy.listwallets()
        
        if not wallets or 'mywallet' not in wallets:
            print("Wallet 'mywallet' not found. Creating it.")
            proxy.createwallet('mywallet')
        else:
            print("Wallet 'mywallet' found. Loading it.")
        proxy.loadwallet('mywallet')
        print('Loaded mywallet')
    except Exception as e:
        print(f"Error creating or loading wallet 'mywallet': {e}")

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

# for tests: return the txid and vout of the utxo
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

