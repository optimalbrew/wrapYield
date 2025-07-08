use bitcoin_scripts::test_setup::BitcoinRPC;
use miniscript::bitcoin::{PrivateKey, Network, PublicKey, secp256k1};
use miniscript::Descriptor;
use serde_json::json;
use std::collections::HashMap;
use std::str::FromStr;
use hex;
use bitcoin::{Transaction, TxIn, TxOut, ScriptBuf, OutPoint, Sequence, Witness, Amount, absolute::LockTime, Address};
use bitcoin::secp256k1::{Secp256k1, Message};
use bitcoin::consensus::encode::serialize;
use bitcoin::sighash::{SighashCache, EcdsaSighashType};

#[tokio::test]
async fn test_fund_and_spend_cltv_timelock() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("testwallet").await;
    let _ = rpc.load_wallet("testwallet").await;
    let _ = rpc.generate_keys(5).await.unwrap();

    // Generate keys for 2-of-3 and backup
    let secp = secp256k1::Secp256k1::new();
    let key1 = secp256k1::SecretKey::from_slice(&[5; 32]).unwrap();
    let key2 = secp256k1::SecretKey::from_slice(&[6; 32]).unwrap();
    let key3 = secp256k1::SecretKey::from_slice(&[7; 32]).unwrap();
    let backup_key = secp256k1::SecretKey::from_slice(&[8; 32]).unwrap();
    let privkey1 = PrivateKey::new(key1, Network::Regtest);
    let privkey2 = PrivateKey::new(key2, Network::Regtest);
    let privkey3 = PrivateKey::new(key3, Network::Regtest);
    let backup_privkey = PrivateKey::new(backup_key, Network::Regtest);
    let pubkey1 = PublicKey::from_private_key(&secp, &privkey1);
    let pubkey2 = PublicKey::from_private_key(&secp, &privkey2);
    let pubkey3 = PublicKey::from_private_key(&secp, &privkey3);
    let backup_pubkey = PublicKey::from_private_key(&secp, &backup_privkey);
    let cltv_height = 10u32;
    let descriptor_str = format!(
        "wsh(or_d(pk({}),and_v(v:multi(2,{},{},{}),after({}))))",
        backup_pubkey, pubkey1, pubkey2, pubkey3, cltv_height
    );
    let descriptor: Descriptor<PublicKey> = Descriptor::from_str(&descriptor_str).unwrap();
    let address = descriptor.address(Network::Regtest).unwrap();
    println!("CLTV Timelock Descriptor: {}", descriptor_str);
    println!("CLTV Timelock Address: {}", address);

    // Fund the address
    let funding_address = rpc.get_new_address().await.unwrap();
    let _ = rpc.generate_to_address(101, &funding_address).await.unwrap();
    let send_amount = 0.1;
    let txid = rpc.send_to_address(&address.to_string(), send_amount).await.unwrap();
    // Mine enough blocks to pass the timelock
    let _ = rpc.generate_to_address(cltv_height + 1, &funding_address).await.unwrap();
    let raw_tx_details = rpc.call_rpc("getrawtransaction", json!([txid, true])).await.unwrap();
    let vout = raw_tx_details["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == address.to_string()
        })
        .expect("CLTV output not found in transaction");
    let output = &raw_tx_details["vout"].as_array().unwrap()[vout];
    let amount = output["value"].as_f64().unwrap();
    let redeem_script = descriptor.explicit_script().unwrap();
    let destination_address = rpc.get_new_address().await.unwrap();

    // --- Path 1: Single-sig (pk(backup_pubkey)) ---
    let input_index = 0;
    let mut tx = Transaction {
        version: 2,
        lock_time: LockTime::ZERO,
        input: vec![TxIn {
            previous_output: OutPoint::new(bitcoin::Txid::from_str(&txid).unwrap(), vout as u32),
            script_sig: ScriptBuf::new(),
            sequence: Sequence(0xfffffffd),
            witness: Witness::default(),
        }],
        output: vec![TxOut {
            value: Amount::from_btc(amount - 0.001).unwrap().to_sat(),
            script_pubkey: Address::from_str(&destination_address).unwrap().assume_checked().script_pubkey(),
        }],
    };
    let mut cache = SighashCache::new(&tx);
    let sighash = cache.segwit_signature_hash(
        input_index,
        &redeem_script,
        Amount::from_btc(amount).unwrap().to_sat(),
        EcdsaSighashType::All,
    ).unwrap();
    let msg = Message::from_slice(&sighash[..]).unwrap();
    let sig_backup = secp.sign_ecdsa(&msg, &backup_privkey.inner);
    let mut witness = Witness::new();
    let mut sig_backup_der = sig_backup.serialize_der().to_vec();
    sig_backup_der.push(EcdsaSighashType::All as u8);
    witness.push(sig_backup_der);
    witness.push(redeem_script.as_bytes().to_vec());
    tx.input[input_index].witness = witness;
    println!("Single-sig path: raw tx hex = {}", hex::encode(serialize(&tx)));
    let res = rpc.send_raw_transaction(&hex::encode(serialize(&tx))).await;
    if let Err(e) = res {
        panic!("Single-sig path failed: {:?}", e);
    }
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();

    // --- Fund a new UTXO for Path 2 ---
    let send_amount2 = 0.1;
    let txid2 = rpc.send_to_address(&address.to_string(), send_amount2).await.unwrap();
    println!("Sent {} BTC to CLTV timelock address (for 2-of-3+timelock path): {}", send_amount2, txid2);
    // Mine enough blocks to pass the timelock
    let _ = rpc.generate_to_address(cltv_height + 1, &funding_address).await.unwrap();
    let raw_tx_details2 = rpc.call_rpc("getrawtransaction", json!([txid2, true])).await.unwrap();
    let vout2 = raw_tx_details2["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == address.to_string()
        })
        .expect("CLTV output not found in transaction");
    let output2 = &raw_tx_details2["vout"].as_array().unwrap()[vout2];
    let amount2 = output2["value"].as_f64().unwrap();

    // --- Path 2: 2-of-3 Multisig + Timelock ---
    let mut tx2 = Transaction {
        version: 2,
        lock_time: LockTime::from_height(cltv_height).unwrap(),
        input: vec![TxIn {
            previous_output: OutPoint::new(bitcoin::Txid::from_str(&txid2).unwrap(), vout2 as u32),
            script_sig: ScriptBuf::new(),
            sequence: Sequence(0xfffffffd),
            witness: Witness::default(),
        }],
        output: vec![TxOut {
            value: Amount::from_btc(amount2 - 0.001).unwrap().to_sat(),
            script_pubkey: Address::from_str(&destination_address).unwrap().assume_checked().script_pubkey(),
        }],
    };
    let mut cache2 = SighashCache::new(&tx2);
    let sighash2 = cache2.segwit_signature_hash(
        input_index,
        &redeem_script,
        Amount::from_btc(amount2).unwrap().to_sat(),
        EcdsaSighashType::All,
    ).unwrap();
    let msg2 = Message::from_slice(&sighash2[..]).unwrap();
    let sig_b = secp.sign_ecdsa(&msg2, &privkey2.inner);
    let sig_c = secp.sign_ecdsa(&msg2, &privkey3.inner);
    let mut witness2 = Witness::new();
    witness2.push(vec![]); // Dummy for OP_CHECKMULTISIG
    let mut sig_b_der = sig_b.serialize_der().to_vec();
    sig_b_der.push(EcdsaSighashType::All as u8);
    let mut sig_c_der = sig_c.serialize_der().to_vec();
    sig_c_der.push(EcdsaSighashType::All as u8);
    witness2.push(sig_b_der);
    witness2.push(sig_c_der);
    witness2.push(vec![]); // Missing third signature
    witness2.push(redeem_script.as_bytes().to_vec());
    tx2.input[input_index].witness = witness2;
    println!("2-of-3+timelock path: raw tx hex = {}", hex::encode(serialize(&tx2)));
    let res2 = rpc.send_raw_transaction(&hex::encode(serialize(&tx2))).await;
    if let Err(e) = res2 {
        panic!("2-of-3+timelock path failed: {:?}", e);
    }
    let _ = rpc.generate_to_address(1, &funding_address).await.unwrap();
} 