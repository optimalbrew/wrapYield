use bitcoin_scripts::test_setup::BitcoinRPC;
use bitcoin::blockdata::script::ScriptBuf;
use bitcoin::taproot::{TaprootBuilder, LeafVersion};
use bitcoin::secp256k1::{Secp256k1, SecretKey, KeyPair};
use bitcoin::key::XOnlyPublicKey;
use bitcoin::{Address, Network, TxIn, TxOut, Transaction, OutPoint, Witness, Sequence};
use bitcoin::opcodes::OP_TRUE;
use hex;
use std::str::FromStr;
use bitcoin::script::PushBytesBuf;
use bitcoin::sighash::ScriptPath;

#[tokio::test]
async fn test_simple_taproot_script_spend() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("testwallet").await;
    let _ = rpc.load_wallet("testwallet").await;
    let _ = rpc.generate_keys(5).await.unwrap();

    let secp = Secp256k1::new();
    let sk_bytes = [5; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let keypair = KeyPair::from_secret_key(&secp, &sk);
    let xonly_pk = XOnlyPublicKey::from_keypair(&keypair).0;
    println!("Internal key (for TaprootBuilder): {}", hex::encode(xonly_pk.serialize()));

    // Generate a new keypair for the script path
    let script_sk = SecretKey::from_slice(&[2u8; 32]).unwrap();
    let script_keypair = KeyPair::from_secret_key(&secp, &script_sk);
    let script_xonly_pk = XOnlyPublicKey::from_keypair(&script_keypair).0;
    println!("Script key (for script leaf): {}", hex::encode(script_xonly_pk.serialize()));
    let script_pubkey = bitcoin::PublicKey::new(secp256k1::PublicKey::from_secret_key(&secp, &script_sk));
    let script_pubkey_bytes = script_pubkey.to_bytes();

    // Build script: <pubkey> OP_CHECKSIG
    let pubkey_array = script_xonly_pk.serialize();
    let pubkey_push = PushBytesBuf::try_from(&pubkey_array).unwrap();
    let mut script_builder = bitcoin::blockdata::script::Builder::new();
    let script = script_builder.push_slice(pubkey_push).push_opcode(bitcoin::opcodes::all::OP_CHECKSIG).into_script();
    let script_buf = ScriptBuf::from_bytes(script.to_bytes());
    println!("Script for Taproot leaf: {}", hex::encode(script_buf.as_bytes()));

    // Build Taproot output with <pubkey> OP_CHECKSIG leaf
    let mut builder = TaprootBuilder::new();
    builder = builder.add_leaf(0, script_buf.clone()).unwrap();
    let spend_info = builder.finalize(&secp, xonly_pk).unwrap();
    let taproot_output_key = spend_info.output_key();
    let address = Address::p2tr_tweaked(taproot_output_key, Network::Regtest);
    println!("Simple Taproot address: {}", address);

    // Fund the address
    let funding_address = rpc.get_new_address().await.unwrap();
    let _ = rpc.generate_to_address(101, &funding_address).await.unwrap();
    let send_amount = 0.1;
    let txid = rpc.send_to_address(&address.to_string(), send_amount).await.unwrap();
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    println!("Funded Taproot address with txid: {}", txid);

    // Find the UTXO
    let raw_tx_details = rpc.call_rpc("getrawtransaction", serde_json::json!([txid, true])).await.unwrap();
    let vout = raw_tx_details["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == address.to_string()
        })
        .expect("Taproot output not found in transaction");
    let output = &raw_tx_details["vout"].as_array().unwrap()[vout];
    let amount = output["value"].as_f64().unwrap();
    println!("Found UTXO: {}:{} (amount: {})", txid, vout, amount);

    // Build spending transaction (script path spend)
    let outpoint = OutPoint::new(bitcoin::Txid::from_str(&txid).unwrap(), vout as u32);
    let to_address = rpc.get_new_address().await.unwrap();
    let value = ((amount - 0.001) * 100_000_000.0) as u64;
    // The previous output (the Taproot UTXO being spent)
    let prev_txout = TxOut {
        value: (amount * 100_000_000.0) as u64,
        script_pubkey: address.script_pubkey(),
    };
    let txin = TxIn { previous_output: outpoint, script_sig: ScriptBuf::new(), sequence: Sequence(0xfffffffd), witness: Witness::new() };
    let txout = TxOut { value, script_pubkey: Address::from_str(&to_address).unwrap().require_network(Network::Regtest).unwrap().script_pubkey() };
    let mut tx = Transaction { version: 2, lock_time: bitcoin::absolute::LockTime::ZERO, input: vec![txin], output: vec![txout.clone()] };

    // Build witness for script path spend (<pubkey> OP_CHECKSIG)
    use bitcoin::sighash::{SighashCache, TapSighashType};
    use bitcoin::secp256k1::Message;
    let control_block = spend_info.control_block(&(script_buf.clone(), bitcoin::taproot::LeafVersion::TapScript)).unwrap();
    let mut cache = SighashCache::new(&mut tx);
    let script_path = ScriptPath::new(&script_buf, LeafVersion::TapScript);
    let sighash = cache.taproot_script_spend_signature_hash(0, &bitcoin::sighash::Prevouts::All(&[prev_txout]), script_path, TapSighashType::Default).unwrap();
    let msg = Message::from_slice(sighash.as_ref()).unwrap();
    let schnorr_sig = secp.sign_schnorr_no_aux_rand(&msg, &script_keypair);
    tx.input[0].witness.clear();
    tx.input[0].witness.push(schnorr_sig.as_ref().to_vec()); // Schnorr signature
    tx.input[0].witness.push(script_buf.to_bytes());
    tx.input[0].witness.push(control_block.serialize());

    // Debug print: show the witness stack
    println!("=== DEBUG: Taproot script path witness stack ===");
    for (i, elem) in tx.input[0].witness.iter().enumerate() {
        println!("  [{}] {} (len={})", i, hex::encode(elem), elem.len());
    }
    println!("=== END DEBUG ===");
    // Debug print: control block first byte (should be 0xc0 or 0xc1 for TapScript)
    let cb = tx.input[0].witness.last().unwrap();
    println!("Control block first byte: {:02x}", cb[0]);
    println!("Control block full hex: {}", hex::encode(cb));
    // Print the internal key from the control block (bytes 1..33)
    println!("Control block internal key: {}", hex::encode(&cb[1..33]));

    // Broadcast the spend
    let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);
    println!("Spending tx hex: {}", tx_hex);
    let spend_txid = rpc.send_raw_transaction(&tx_hex).await.unwrap();
    println!("Spend broadcasted: {}", spend_txid);
    // Confirm the spend
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    let spent = rpc.call_rpc("gettransaction", serde_json::json!([spend_txid, serde_json::Value::Null])).await.unwrap();
    assert!(spent["confirmations"].as_i64().unwrap() > 0, "Spend not confirmed");
    println!("Simple Taproot script path spend confirmed!");
}

#[tokio::test]
async fn test_simple_taproot_key_spend() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("testwallet_key").await;
    let _ = rpc.load_wallet("testwallet_key").await;
    let _ = rpc.generate_keys(5).await.unwrap();

    let secp = Secp256k1::new();
    let sk_bytes = [5; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let keypair = KeyPair::from_secret_key(&secp, &sk);
    let xonly_pk = XOnlyPublicKey::from_keypair(&keypair).0;
    println!("Internal key (for TaprootBuilder): {}", hex::encode(xonly_pk.serialize()));

    // Build Taproot output with NO script leaves (key spend only)
    let spend_info = TaprootBuilder::new().finalize(&secp, xonly_pk).unwrap();
    let taproot_output_key = spend_info.output_key();
    let address = Address::p2tr_tweaked(taproot_output_key, Network::Regtest);
    println!("Simple Taproot key spend address: {}", address);

    // Fund the address
    let funding_address = rpc.get_new_address().await.unwrap();
    let _ = rpc.generate_to_address(101, &funding_address).await.unwrap();
    let send_amount = 0.1;
    let txid = rpc.send_to_address(&address.to_string(), send_amount).await.unwrap();
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    println!("Funded Taproot key spend address with txid: {}", txid);

    // Find the UTXO
    let raw_tx_details = rpc.call_rpc("getrawtransaction", serde_json::json!([txid, true])).await.unwrap();
    let vout = raw_tx_details["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == address.to_string()
        })
        .expect("Taproot output not found in transaction");
    let output = &raw_tx_details["vout"].as_array().unwrap()[vout];
    let amount = output["value"].as_f64().unwrap();
    println!("Found UTXO: {}:{} (amount: {})", txid, vout, amount);

    // Build spending transaction (key spend)
    let outpoint = OutPoint::new(bitcoin::Txid::from_str(&txid).unwrap(), vout as u32);
    let to_address = rpc.get_new_address().await.unwrap();
    let value = ((amount - 0.001) * 100_000_000.0) as u64;
    // The previous output (the Taproot UTXO being spent)
    let prev_txout = TxOut {
        value: (amount * 100_000_000.0) as u64,
        script_pubkey: address.script_pubkey(),
    };
    let txin = TxIn { previous_output: outpoint, script_sig: ScriptBuf::new(), sequence: Sequence(0xfffffffd), witness: Witness::new() };
    let txout = TxOut { value, script_pubkey: Address::from_str(&to_address).unwrap().require_network(Network::Regtest).unwrap().script_pubkey() };
    let mut tx = Transaction { version: 2, lock_time: bitcoin::absolute::LockTime::ZERO, input: vec![txin], output: vec![txout.clone()] };

    // Build witness for key spend (just a Schnorr signature)
    use bitcoin::sighash::{SighashCache, TapSighashType};
    use bitcoin::secp256k1::Message;
    let mut cache = SighashCache::new(&mut tx);
    let sighash = cache.taproot_key_spend_signature_hash(0, &bitcoin::sighash::Prevouts::All(&[prev_txout]), TapSighashType::Default).unwrap();
    let msg = Message::from_slice(sighash.as_ref()).unwrap();
    let schnorr_sig = secp.sign_schnorr_no_aux_rand(&msg, &keypair);
    tx.input[0].witness.clear();
    tx.input[0].witness.push(schnorr_sig.as_ref().to_vec()); // Schnorr signature only

    // Debug print: show the witness stack
    println!("=== DEBUG: Taproot key spend witness stack ===");
    for (i, elem) in tx.input[0].witness.iter().enumerate() {
        println!("  [{}] {} (len={})", i, hex::encode(elem), elem.len());
    }
    println!("=== END DEBUG ===");

    // Broadcast the spend
    let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);
    println!("Spending tx hex: {}", tx_hex);
    let spend_txid = rpc.send_raw_transaction(&tx_hex).await.unwrap();
    println!("Key spend broadcasted: {}", spend_txid);
    // Confirm the spend
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    let spent = rpc.call_rpc("gettransaction", serde_json::json!([spend_txid, serde_json::Value::Null])).await.unwrap();
    assert!(spent["confirmations"].as_i64().unwrap() > 0, "Key spend not confirmed");
    println!("Simple Taproot key spend confirmed!");
} 