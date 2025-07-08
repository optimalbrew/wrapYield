//! Simple Taproot spend example: single internal key, single script path (no multisig)

use bitcoin::secp256k1::{Secp256k1, SecretKey, KeyPair};
use bitcoin::key::XOnlyPublicKey;
use bitcoin::taproot::TaprootBuilder;
use bitcoin::{Address, Network};
use bitcoin::blockdata::script::ScriptBuf;
use bitcoin::opcodes::OP_TRUE;
use hex::ToHex;

/// Demonstrates creating a simple Taproot output with a single internal key and a single script path.
pub fn simple_taproot_demo() {
    // 1. Setup secp256k1 context and a random internal key
    let secp = Secp256k1::new();
    let sk_bytes = [4; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let keypair = KeyPair::from_secret_key(&secp, &sk);
    let xonly_pk = XOnlyPublicKey::from_keypair(&keypair).0;
    println!("Internal xonly pubkey: {}", xonly_pk);

    // 2. Create a simple script (e.g., anyone-can-spend OP_TRUE)
    let script = ScriptBuf::from_bytes(vec![OP_TRUE.to_u8()]);
    println!("Script leaf: {}", hex::encode(script.as_bytes()));

    // 3. Build the Taproot output key (with script path)
    let mut builder = TaprootBuilder::new();
    builder = builder.add_leaf(0, script.clone()).unwrap();
    let spend_info = builder.finalize(&secp, xonly_pk).unwrap();
    let taproot_output_key = spend_info.output_key();
    println!("Taproot output key: {}", taproot_output_key);

    // 4. Create a Taproot address
    let address = Address::p2tr_tweaked(taproot_output_key, Network::Regtest);
    println!("Taproot address: {}", address);
} 