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
use bitcoin::key::TapTweak;

#[tokio::test]
async fn test_simple_taproot_script_spend() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("taproot_script_wallet").await;
    let _ = rpc.load_wallet("taproot_script_wallet").await;
    let rpc = rpc.with_wallet("taproot_script_wallet");
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
    let _ = rpc.create_wallet("taproot_key_wallet").await;
    let _ = rpc.load_wallet("taproot_key_wallet").await;
    let rpc = rpc.with_wallet("taproot_key_wallet");
    let _ = rpc.generate_keys(5).await.unwrap();

    let secp = Secp256k1::new();
    let sk_bytes = [5; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let keypair = KeyPair::from_secret_key(&secp, &sk);
    let xonly_pk = XOnlyPublicKey::from_keypair(&keypair).0;
    println!("Internal key (for TaprootBuilder): {}", hex::encode(xonly_pk.serialize()));

    // Build Taproot output with a dummy script leaf (so we can test key spend properly)
    let dummy_script = ScriptBuf::from_bytes(vec![0x51]); // OP_TRUE
    let mut builder = TaprootBuilder::new();
    builder = builder.add_leaf(0, dummy_script.clone()).unwrap();
    let spend_info = builder.finalize(&secp, xonly_pk).unwrap();
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
    // For key spend, we need to sign with the tweaked key
    // Compute the tweaked key using the internal key and merkle root
    let merkle_root = spend_info.merkle_root();
    let tweaked_keypair = keypair.tap_tweak(&secp, merkle_root);
    let schnorr_sig = secp.sign_schnorr_no_aux_rand(&msg, &tweaked_keypair.to_inner());
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

#[tokio::test]
async fn test_taproot_two_leaf_spend() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("taproot_two_leaf_wallet").await;
    let _ = rpc.load_wallet("taproot_two_leaf_wallet").await;
    let rpc = rpc.with_wallet("taproot_two_leaf_wallet");
    let _ = rpc.generate_keys(5).await.unwrap();

    let secp = Secp256k1::new();
    let sk_bytes = [7; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let keypair = KeyPair::from_secret_key(&secp, &sk);
    let xonly_pk = XOnlyPublicKey::from_keypair(&keypair).0;

    // Leaf 1: <xonly_pubkey> OP_CHECKSIG
    let pubkey_push = PushBytesBuf::try_from(&xonly_pk.serialize()).unwrap();
    let script1 = bitcoin::blockdata::script::Builder::new()
        .push_slice(&pubkey_push)
        .push_opcode(bitcoin::opcodes::all::OP_CHECKSIG)
        .into_script();
    let script1_buf = ScriptBuf::from_bytes(script1.to_bytes());

    // Leaf 2: OP_CLTV OP_DROP <xonly_pubkey> OP_CHECKSIG
    let cltv_height = 200;
    let script2 = bitcoin::blockdata::script::Builder::new()
        .push_int(cltv_height)
        .push_opcode(bitcoin::opcodes::all::OP_CLTV)
        .push_opcode(bitcoin::opcodes::all::OP_DROP)
        .push_slice(&pubkey_push)
        .push_opcode(bitcoin::opcodes::all::OP_CHECKSIG)
        .into_script();
    let script2_buf = ScriptBuf::from_bytes(script2.to_bytes());

    // Build Taproot output with both leaves
    let builder = TaprootBuilder::new();
    let builder = builder.add_leaf(1, script1_buf.clone()).unwrap();
    let builder = builder.add_leaf(1, script2_buf.clone()).unwrap();
    let spend_info = builder.finalize(&secp, xonly_pk).unwrap();
    let taproot_output_key = spend_info.output_key();
    let address = Address::p2tr_tweaked(taproot_output_key, Network::Regtest);
    println!("Two-leaf Taproot address: {}", address);

    // Fund the address
    let funding_address = rpc.get_new_address().await.unwrap();
    let _ = rpc.generate_to_address(101, &funding_address).await.unwrap();
    let send_amount = 0.1;
    let txid = rpc.send_to_address(&address.to_string(), send_amount).await.unwrap();
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    println!("Funded two-leaf Taproot address with txid: {}", txid);

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

    // --- Spend via script path 1 (no timelock) ---
    let outpoint = OutPoint::new(bitcoin::Txid::from_str(&txid).unwrap(), vout as u32);
    let to_address = rpc.get_new_address().await.unwrap();
    let value = ((amount - 0.001) * 100_000_000.0) as u64;
    let prev_txout = TxOut {
        value: (amount * 100_000_000.0) as u64,
        script_pubkey: address.script_pubkey(),
    };
    let txin = TxIn { previous_output: outpoint, script_sig: ScriptBuf::new(), sequence: Sequence(0xfffffffd), witness: Witness::new() };
    let txout = TxOut { value, script_pubkey: Address::from_str(&to_address).unwrap().require_network(Network::Regtest).unwrap().script_pubkey() };
    let mut tx = Transaction { version: 2, lock_time: bitcoin::absolute::LockTime::ZERO, input: vec![txin], output: vec![txout.clone()] };

    // Build witness for script path 1
    use bitcoin::sighash::{SighashCache, TapSighashType};
    use bitcoin::secp256k1::Message;
    let control_block1 = spend_info.control_block(&(script1_buf.clone(), bitcoin::taproot::LeafVersion::TapScript)).unwrap();
    let mut cache = SighashCache::new(&mut tx);
    let script_path1 = ScriptPath::new(&script1_buf, LeafVersion::TapScript);
    let sighash1 = cache.taproot_script_spend_signature_hash(0, &bitcoin::sighash::Prevouts::All(&[prev_txout]), script_path1, TapSighashType::Default).unwrap();
    let msg1 = Message::from_slice(sighash1.as_ref()).unwrap();
    let schnorr_sig1 = secp.sign_schnorr_no_aux_rand(&msg1, &keypair);
    tx.input[0].witness.clear();
    tx.input[0].witness.push(schnorr_sig1.as_ref().to_vec());
    tx.input[0].witness.push(script1_buf.to_bytes());
    tx.input[0].witness.push(control_block1.serialize());
    println!("Spending via script path 1 (no timelock)...");
    let tx_hex1 = bitcoin::consensus::encode::serialize_hex(&tx);
    let spend_txid1 = rpc.send_raw_transaction(&tx_hex1).await.unwrap();
    println!("Spend 1 broadcasted: {}", spend_txid1);
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    let spent1 = rpc.call_rpc("gettransaction", serde_json::json!([spend_txid1, serde_json::Value::Null])).await.unwrap();
    assert!(spent1["confirmations"].as_i64().unwrap() > 0, "Spend 1 not confirmed");
    println!("Two-leaf Taproot spend path 1 confirmed!");

    // --- Spend via script path 2 (timelock) ---
    // Fund again for the second spend
    let txid2 = rpc.send_to_address(&address.to_string(), send_amount).await.unwrap();
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
    let raw_tx_details2 = rpc.call_rpc("getrawtransaction", serde_json::json!([txid2, true])).await.unwrap();
    let vout2 = raw_tx_details2["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == address.to_string()
        })
        .expect("Taproot output not found in transaction");
    let output2 = &raw_tx_details2["vout"].as_array().unwrap()[vout2];
    let amount2 = output2["value"].as_f64().unwrap();
    let outpoint2 = OutPoint::new(bitcoin::Txid::from_str(&txid2).unwrap(), vout2 as u32);
    let to_address2 = rpc.get_new_address().await.unwrap();
    let value2 = ((amount2 - 0.001) * 100_000_000.0) as u64;
    let prev_txout2 = TxOut {
        value: (amount2 * 100_000_000.0) as u64,
        script_pubkey: address.script_pubkey(),
    };
    // For CLTV timelocks, sequence must be less than 0xffffffff to enable lock_time
    let txin2 = TxIn { previous_output: outpoint2, script_sig: ScriptBuf::new(), sequence: Sequence(0xfffffffe), witness: Witness::new() };
    let txout2 = TxOut { value: value2, script_pubkey: Address::from_str(&to_address2).unwrap().require_network(Network::Regtest).unwrap().script_pubkey() };
    let mut tx2 = Transaction { version: 2, lock_time: bitcoin::absolute::LockTime::from_height(cltv_height as u32).unwrap(), input: vec![txin2], output: vec![txout2.clone()] };

    // Build witness for script path 2
    let control_block2 = spend_info.control_block(&(script2_buf.clone(), bitcoin::taproot::LeafVersion::TapScript)).unwrap();
    let mut cache2 = SighashCache::new(&mut tx2);
    let script_path2 = ScriptPath::new(&script2_buf, LeafVersion::TapScript);
    let sighash2 = cache2.taproot_script_spend_signature_hash(0, &bitcoin::sighash::Prevouts::All(&[prev_txout2]), script_path2, TapSighashType::Default).unwrap();
    let msg2 = Message::from_slice(sighash2.as_ref()).unwrap();
    let schnorr_sig2 = secp.sign_schnorr_no_aux_rand(&msg2, &keypair);
    tx2.input[0].witness.clear();
    tx2.input[0].witness.push(schnorr_sig2.as_ref().to_vec());
    tx2.input[0].witness.push(script2_buf.to_bytes());
    tx2.input[0].witness.push(control_block2.serialize());
    println!("Spending via script path 2 (timelock)...");
    
    // Check current block height vs CLTV height
    let current_height = rpc.call_rpc("getblockcount", serde_json::json!([])).await.unwrap().as_u64().unwrap();
    println!("Current block height: {}, CLTV height: {}", current_height, cltv_height);
    println!("Transaction lock_time: {:?}", tx2.lock_time);
    println!("Input sequence: {:?}", tx2.input[0].sequence);
    
    // Try to broadcast before timelock (should fail only if current height < CLTV height)
    let res = rpc.send_raw_transaction(&bitcoin::consensus::encode::serialize_hex(&tx2)).await;
    if current_height < cltv_height as u64 {
        assert!(res.is_err(), "Timelock spend should fail before block height");
        println!("Timelock spend correctly rejected before block height");
        
        // Mine up to the timelock height
        let blocks_needed = cltv_height as u64 - current_height;
        let _ = rpc.generate_to_address(blocks_needed as u32, &funding_address).await.unwrap();
        
        // Now try again with updated lock_time
        let new_height = rpc.call_rpc("getblockcount", serde_json::json!([])).await.unwrap().as_u64().unwrap();
        tx2.lock_time = bitcoin::absolute::LockTime::from_height(new_height as u32).unwrap();
        println!("Updated tx2.lock_time to current block height: {:?}", tx2.lock_time);
        let spend_txid2 = rpc.send_raw_transaction(&bitcoin::consensus::encode::serialize_hex(&tx2)).await.unwrap();
        println!("Spend 2 broadcasted: {}", spend_txid2);
        let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
        let spent2 = rpc.call_rpc("gettransaction", serde_json::json!([spend_txid2, serde_json::Value::Null])).await.unwrap();
        assert!(spent2["confirmations"].as_i64().unwrap() > 0, "Spend 2 not confirmed");
        println!("Two-leaf Taproot spend path 2 (timelock) confirmed!");
    } else {
        assert!(res.is_ok(), "Timelock spend should succeed when block height requirement is met");
        println!("Timelock spend succeeded (block height requirement already met)");
        let spend_txid2 = res.unwrap();
        println!("Spend 2 broadcasted: {}", spend_txid2);
        let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
        let spent2 = rpc.call_rpc("gettransaction", serde_json::json!([spend_txid2, serde_json::Value::Null])).await.unwrap();
        assert!(spent2["confirmations"].as_i64().unwrap() > 0, "Spend 2 not confirmed");
        println!("Two-leaf Taproot spend path 2 (timelock) confirmed!");
        return; // Exit early since the spend already succeeded
    }
} 