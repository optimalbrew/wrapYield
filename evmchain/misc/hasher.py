"""
generating preimages and preimage hashes for use in HTLC contracts such as BtcCollateralLoan.sol and EtherSwap.sol
Each loan has a preimage selected by the borrower and one by the lender

the  idea is to use the generate hashes using sha256 in a consistent way with python and solidity

The corresponding solidity code is in script/preimageGenerator.sol

* Strangely, solidity "packed" encoding is not the same as python's packed.
 * instead, it is the same as python's strict.

 * forge script script/preimageGenerator.sol
 * and 
 * python3 misc/hasher.py

"""

import hashlib

# helper for abi.encodePacked-style uint encoding
def encode_packed_uint(x: int) -> bytes:
    return x.to_bytes((x.bit_length() + 7) // 8 or 1, "big")

# helper for abi.encode-style uint encoding
def encode_uint(x: int) -> bytes:
    return x.to_bytes(32, "big")

def double_hash(hash_hex):
    """Hash the hash again using SHA256"""
    return hashlib.sha256(bytes.fromhex(hash_hex)).hexdigest()

print("=== Generating hashes for i=0 to i=5 ===")
print("Using Solidity 'packed' encoding (which matches Python 'strict')")
print()

for i in range(6):  # 0 to 5
    print(f"=== Iteration i = {i} ===")
    
    # Borrower hashes
    data_borrower = b"borrower" + encode_uint(i)
    hash_borrower = hashlib.sha256(data_borrower).hexdigest()
    double_hash_borrower = double_hash(hash_borrower)
    
    print("Borrower preimage:")
    print(hash_borrower)
    print("Borrower preimage hash:")
    print(double_hash_borrower)
    
    # Lender hashes
    data_lender = b"lender" + encode_uint(i)
    hash_lender = hashlib.sha256(data_lender).hexdigest()
    double_hash_lender = double_hash(hash_lender)
    
    print("Lender preimage:")
    print(hash_lender)
    print("Lender preimage hash:")
    print(double_hash_lender)
    
    print("---")

    """
    Sample results:
    === Iteration i = 0 ===
Borrower preimage:
05e5cdc502cc641787db0383a01d4b6baec69b62b6dbf9d9d9600872bbbed741
Borrower preimage hash:
4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1
Lender preimage:
38f9fa6b463f6e37f2cf7286f1f3bbf2e1fe33296f95629d9c343511f9bd35d5
Lender preimage hash:
646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3
---
=== Iteration i = 1 ===
Borrower preimage:
51a1a48a303eac94c5db7948f45afd24bed8f1996123ad0b8c690941767fb7b9
Borrower preimage hash:
829ffe3be04973f31edf2e863d51eae635a66a2eafd560fc109e381ebc891d1f
Lender preimage:
c71b05891e060371963c100544a0d664942436175ab65773954e59428745cf3d
Lender preimage hash:
558faf2cc0da7f3ab3906cd341618413033e258f84d9ec792c880b6b9ae3446e
---
=== Iteration i = 2 ===
Borrower preimage:
3a5b245e72c11664e345472b0bbd7870af8dc1040d1a49693eee8f63779ec7fb
Borrower preimage hash:
e59bafe7950bac5fabbe1ab81cbd37843fd410baca12bf74a360a8cbdc8aea05
Lender preimage:
59c289740dda868e22ca3fb1f66ba6f42bb6a4aa99f05f062ac4f098b71d5c34
Lender preimage hash:
6b6fdc0ea086b12523653fd7e10a91ba18ecfc04185bf76289172e702d51c754
---
=== Iteration i = 3 ===
Borrower preimage:
e5f5c616adf2c59bde5a9fce5eca7aa5cd3c729d3ac762736b095504d84783d8
Borrower preimage hash:
076062d6cd5679fe4c3f849ab62cf7b311d8e52e0a31e66fd826b74355a3ee88
Lender preimage:
c3da67e7540306f8f6b4a049c61f94c36dac0f5c4a5b982cfdb9bcb359c5cfa8
Lender preimage hash:
5a07b440ef01bf562d5df47639b2c2023571b9a28a20e8f21ef10c6b8222bc17
---
=== Iteration i = 4 ===
Borrower preimage:
ff415e8d9f7dee6c4c37b5395f3b23b751d61cfb8ad70a6b759701574d17a137
Borrower preimage hash:
22702ce74f52494dd099c70ee9e8690f69b4fd0ae0fc23cbe87bba0ab4f94df3
Lender preimage:
4f949257a44ff70576ef75ddb21fca28a0744690ae3c94bf1edfde011472e8d5
Lender preimage hash:
6f695d49d98ead9f78c1f0058ea87a597c82382e7f68d8fb3e7c7c6cd1213a3e
---
=== Iteration i = 5 ===
Borrower preimage:
279abb60f0d622f673aa7fa06c7fef1a797e4ac7b335b41f642abb75d0852fd4
Borrower preimage hash:
c6b356c4b0c2e93a8f9f7d8be4b5ece31dc4a07e709dc870cac260cbb27c3e82
Lender preimage:
f4354daf393696b19a316aaa852729df36126f93a63edb2b866a263cc8098cba
Lender preimage hash:
f4c8eaf690200fcc2a460076d2538399d76f49e0bc7840ed588579baf29dd4be
    
    """