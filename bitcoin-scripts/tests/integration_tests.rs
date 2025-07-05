use serde_json::{json, Value};
use base64::Engine;
use bitcoin_scripts::classic_multisig::create_multisig;
use miniscript::bitcoin::PublicKey;
use std::collections::HashMap;

#[cfg(test)]
pub struct BitcoinRPC {
    pub url: String,
    pub client: reqwest::Client,
    pub auth: String,
}

#[cfg(test)]
impl BitcoinRPC {
    pub fn new() -> Self {
        let url = "http://localhost:18443".to_string();
        let client = reqwest::Client::new();
        let auth = base64::engine::general_purpose::STANDARD.encode("bitcoin:localtest");
        Self { url, client, auth }
    }
    pub async fn call_rpc(&self, method: &str, params: serde_json::Value) -> Result<Value, Box<dyn std::error::Error>> {
        let req = json!({
            "jsonrpc": "1.0",
            "id": "rust",
            "method": method,
            "params": params,
        });
        let resp = self.client.post(&self.url)
            .header("Authorization", format!("Basic {}", self.auth))
            .json(&req)
            .send()
            .await?;
        let resp_json: Value = resp.json().await?;
        if resp_json["error"].is_null() {
            Ok(resp_json["result"].clone())
        } else {
            Err(format!("RPC error: {:?}", resp_json["error"]).into())
        }
    }
    pub async fn get_new_address(&self) -> Result<String, Box<dyn std::error::Error>> {
        let addr = self.call_rpc("getnewaddress", json!([])).await?;
        Ok(addr.as_str().unwrap().to_string())
    }
    pub async fn send_to_address(&self, address: &str, amount: f64) -> Result<String, Box<dyn std::error::Error>> {
        let txid = self.call_rpc("sendtoaddress", json!([address, amount])).await?;
        Ok(txid.as_str().unwrap().to_string())
    }
    pub async fn generate_to_address(&self, blocks: u32, address: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let hashes = self.call_rpc("generatetoaddress", json!([blocks, address])).await?;
        Ok(hashes.as_array().unwrap().iter().map(|h| h.as_str().unwrap().to_string()).collect())
    }
    pub async fn get_balance(&self) -> Result<f64, Box<dyn std::error::Error>> {
        let balance = self.call_rpc("getbalance", json!([])).await?;
        Ok(balance.as_f64().unwrap())
    }
    pub async fn create_raw_transaction(&self, inputs: Vec<Value>, outputs: HashMap<String, f64>) -> Result<String, Box<dyn std::error::Error>> {
        let tx = self.call_rpc("createrawtransaction", json!([inputs, outputs])).await?;
        Ok(tx.as_str().unwrap().to_string())
    }
    pub async fn send_raw_transaction(&self, hex: &str) -> Result<String, Box<dyn std::error::Error>> {
        let txid = self.call_rpc("sendrawtransaction", json!([hex])).await?;
        Ok(txid.as_str().unwrap().to_string())
    }
    pub async fn create_wallet(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let result = self.call_rpc("createwallet", json!([name])).await;
        match result {
            Ok(_) => Ok(()),
            Err(e) => {
                if e.to_string().contains("Database already exists") {
                    Ok(())
                } else {
                    Err(e)
                }
            }
        }
    }
    pub async fn load_wallet(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let _ = self.call_rpc("loadwallet", json!([name])).await?;
        Ok(())
    }
}

#[cfg(test)]
fn create_redeem_script(public_keys: &[PublicKey]) -> bitcoin::ScriptBuf {
    let mut builder = bitcoin::script::Builder::new();
    builder = builder.push_int(2);
    for pubkey in public_keys {
        builder = builder.push_slice(pubkey.inner.serialize());
    }
    builder = builder.push_int(3);
    builder = builder.push_opcode(bitcoin::opcodes::all::OP_CHECKMULTISIG);
    builder.into_script()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rpc_connection() {
        let rpc = BitcoinRPC::new();
        
        // Try to create wallet, ignore if it already exists
        let _ = rpc.create_wallet("testwallet").await;
        
        // Try to load the wallet
        let _ = rpc.load_wallet("testwallet").await;
        
        let balance = rpc.get_balance().await;
        assert!(balance.is_ok(), "Failed to connect to Bitcoin RPC");
        println!("Current balance: {}", balance.unwrap());
    }

    #[tokio::test]
    async fn test_fund_and_spend_classic_multisig() {
        let rpc = BitcoinRPC::new();
        
        // Try to create wallet, ignore if it already exists
        let _ = rpc.create_wallet("testwallet").await;
        
        // Try to load the wallet
        let _ = rpc.load_wallet("testwallet").await;
        
        // Create a multisig address
        let multisig_info = create_multisig().unwrap();
        println!("Created multisig address: {}", multisig_info.address);
        println!("Descriptor: {}", multisig_info.descriptor);
        
        // Get a funding address
        let funding_address = rpc.get_new_address().await.unwrap();
        println!("Funding address: {}", funding_address);
        
        // Generate some coins to the funding address
        let block_hashes = rpc.generate_to_address(101, &funding_address).await.unwrap();
        println!("Generated {} blocks", block_hashes.len());
        
        // Send funds to the multisig address
        let send_amount = 0.1;
        let txid = rpc.send_to_address(&multisig_info.address, send_amount).await.unwrap();
        println!("Sent {} BTC to multisig address: {}", send_amount, txid);
        
        // Generate a few more blocks to confirm the transaction
        let _ = rpc.generate_to_address(6, &funding_address).await.unwrap();
        
        // Get the raw transaction details
        let raw_tx_details = rpc.call_rpc("getrawtransaction", json!([txid, true])).await.unwrap();
        println!("Raw transaction details: {}", raw_tx_details);
        
        // Find the output that goes to our multisig address
        let vout = raw_tx_details["vout"].as_array().unwrap()
            .iter()
            .position(|output| {
                output["scriptPubKey"]["address"].as_str().unwrap() == multisig_info.address
            })
            .expect("Multisig output not found in transaction");
        
        let output = &raw_tx_details["vout"].as_array().unwrap()[vout];
        let amount = output["value"].as_f64().unwrap();
        let script_pub_key = output["scriptPubKey"]["hex"].as_str().unwrap();
        
        println!("Found multisig output: vout={}, amount={}, scriptPubKey={}", vout, amount, script_pub_key);
        
        // Create a new address to send funds to
        let destination_address = rpc.get_new_address().await.unwrap();
        println!("Destination address: {}", destination_address);
        
        // Create raw transaction
        let inputs = vec![json!({
            "txid": txid,
            "vout": vout
        })];
        
        let mut outputs = HashMap::new();
        outputs.insert(destination_address.clone(), amount - 0.001); // Leave some for fee
        
        let raw_tx = rpc.create_raw_transaction(inputs, outputs).await.unwrap();
        println!("Created raw transaction: {}", raw_tx);
        
        // Create redeem script
        let redeem_script = create_redeem_script(&multisig_info.public_keys);
        let redeem_script_hex = hex::encode(redeem_script.as_bytes());
        println!("Redeem script: {}", redeem_script_hex);
        
        // Sign with two private keys (2-of-3)
        let privkeys_wif: Vec<String> = multisig_info.private_keys.iter()
            .take(2) // Only use first 2 keys
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
        println!("Signing result: {}", signed_result);
        
        if signed_result["complete"].as_bool().unwrap() {
            let signed_hex = signed_result["hex"].as_str().unwrap();
            println!("Signed transaction: {}", signed_hex);
            
            // Broadcast the signed transaction
            let broadcast_txid = rpc.send_raw_transaction(signed_hex).await.unwrap();
            println!("Broadcasted transaction: {}", broadcast_txid);
            
            // Generate a few more blocks to confirm the spend
            let _ = rpc.generate_to_address(6, &funding_address).await.unwrap();
            
            println!("Test completed successfully!");
        } else {
            panic!("Failed to sign transaction: {:?}", signed_result["errors"]);
        }
    }
} 