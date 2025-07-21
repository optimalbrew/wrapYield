use bitcoin_scripts::test_setup::{BitcoinRPC};
use bitcoin_scripts::classic_multisig::{create_multisig, create_redeem_script};
use miniscript::bitcoin::Network;
use hex;
use serde_json::json;
use std::collections::HashMap;

#[tokio::test]
async fn test_fund_and_spend_classic_multisig() {
    let rpc = BitcoinRPC::new();
    let _ = rpc.create_wallet("testwallet").await;
    let _ = rpc.load_wallet("testwallet").await;
    // Generate some keys in the wallet to ensure it has addresses
    let _ = rpc.generate_keys(5).await.unwrap();
    let multisig_info = create_multisig().unwrap();
    let funding_address = rpc.get_new_address().await.unwrap();
    let _ = rpc.generate_to_address(101, &funding_address).await.unwrap();
    let send_amount = 0.1;
    let txid = rpc.send_to_address(&multisig_info.address, send_amount).await.unwrap();
    let _ = rpc.generate_to_address(6, &funding_address).await.unwrap();
    let raw_tx_details = rpc.call_rpc("getrawtransaction", json!([txid, true])).await.unwrap();
    let vout = raw_tx_details["vout"].as_array().unwrap()
        .iter()
        .position(|output| {
            output["scriptPubKey"]["address"].as_str().unwrap() == multisig_info.address
        })
        .expect("Multisig output not found in transaction");
    let output = &raw_tx_details["vout"].as_array().unwrap()[vout];
    let amount = output["value"].as_f64().unwrap();
    let script_pub_key = output["scriptPubKey"]["hex"].as_str().unwrap();
    let destination_address = rpc.get_new_address().await.unwrap();
    let inputs = vec![json!({
        "txid": txid,
        "vout": vout
    })];
    let mut outputs = HashMap::new();
    outputs.insert(destination_address.clone(), amount - 0.001);
    let raw_tx = rpc.create_raw_transaction(inputs, outputs).await.unwrap();
    let redeem_script = create_redeem_script(&multisig_info.public_keys);
    let redeem_script_hex = hex::encode(redeem_script.as_bytes());
    let privkeys_wif: Vec<String> = multisig_info.private_keys.iter()
        .take(2)
        .map(|pk| pk.to_wif())
        .collect();
    let prevtxs = vec![json!({
        "txid": txid,
        "vout": vout,
        "scriptPubKey": script_pub_key,
        "redeemScript": redeem_script_hex
    })];
    let params = json!([
        raw_tx,
        privkeys_wif,
        prevtxs
    ]);
    let signed_result = rpc.call_rpc("signrawtransactionwithkey", params).await.unwrap();
    if signed_result["complete"].as_bool().unwrap() {
        let signed_hex = signed_result["hex"].as_str().unwrap();
        let _ = rpc.send_raw_transaction(signed_hex).await.unwrap();
        let _ = rpc.generate_to_address(6, &funding_address).await.unwrap();
    } else {
        panic!("Failed to sign transaction: {:?}", signed_result["errors"]);
    }
} 