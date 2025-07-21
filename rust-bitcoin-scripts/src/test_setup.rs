use serde_json::{json, Value};
use base64::Engine;
use miniscript::bitcoin::{PublicKey, PrivateKey, Network, secp256k1};
use std::collections::HashMap;

pub struct BitcoinRPC {
    pub url: String,
    pub client: reqwest::Client,
    pub auth: String,
}

impl BitcoinRPC {
    pub fn new() -> Self {
        let url = "http://localhost:18443".to_string();
        let client = reqwest::Client::new();
        let auth = base64::engine::general_purpose::STANDARD.encode("bitcoin:localtest");
        Self { url, client, auth }
    }

    pub fn with_wallet(&self, wallet: &str) -> Self {
        let url = format!("{}/wallet/{}", self.url.trim_end_matches('/'), wallet);
        Self {
            url,
            client: self.client.clone(),
            auth: self.auth.clone(),
        }
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
        let result = self.call_rpc("createwallet", json!([name, false, false, "", false, true, true])).await;
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
    
    pub async fn generate_keys(&self, count: u32) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut addresses = Vec::new();
        for _ in 0..count {
            let addr = self.call_rpc("getnewaddress", json!([])).await?;
            addresses.push(addr.as_str().unwrap().to_string());
        }
        Ok(addresses)
    }
    pub async fn load_wallet(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let _ = self.call_rpc("loadwallet", json!([name])).await?;
        Ok(())
    }
}
