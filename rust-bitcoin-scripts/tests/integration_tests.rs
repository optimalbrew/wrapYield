use serde_json::{json, Value};
use base64::Engine;
use bitcoin_scripts::classic_multisig::create_multisig;

use miniscript::bitcoin::{PublicKey, PrivateKey, Network, secp256k1};
use bitcoin::key::XOnlyPublicKey;
use miniscript::Descriptor;
use std::collections::HashMap;
use std::str::FromStr;
use hex;

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
        let result = self.call_rpc("createwallet", json!([name, true, true, "", false, true, true])).await;
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
        
        // Get current block height
        let block_count = rpc.call_rpc("getblockcount", json!([])).await.unwrap();
        let current_height = block_count.as_u64().unwrap();
        println!("Current block height: {}", current_height);
        
        // Get balance
        let balance = rpc.get_balance().await.unwrap();
        println!("Current balance: {}", balance);
        
        // Get a new address
        let address = rpc.get_new_address().await.unwrap();
        println!("New address: {}", address);
        
        // Send funds to the address
        let send_amount = 0.1;
        let txid = rpc.send_to_address(&address, send_amount).await.unwrap();
        println!("Sent {} BTC to address: {}", send_amount, txid);
        
        // Generate some coins to the address
        let block_hashes = rpc.generate_to_address(101, &address).await.unwrap();
        println!("Generated {} blocks", block_hashes.len());
        
        println!("RPC connection test completed successfully!");
    }
} 