use miniscript::{Descriptor, bitcoin::{Network, PrivateKey, secp256k1, PublicKey}};
use rand::RngCore;
use std::str::FromStr;

fn random_secret_key() -> secp256k1::SecretKey {
    let mut data = [0u8; 32]; //bytearray of length 32
    rand::thread_rng().fill_bytes(&mut data);
    secp256k1::SecretKey::from_slice(&data).unwrap()
}

pub struct MultisigInfo {
    pub address: String,
    pub descriptor: String,
    pub private_keys: Vec<PrivateKey>,
    pub public_keys: Vec<PublicKey>,
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let info = create_multisig()?;
    println!("Classic 2-of-3 P2SH multisig example");
    println!("Descriptor: {}", info.descriptor);
    println!("Regtest Address: {}", info.address);
    Ok(())
}

pub fn create_multisig() -> Result<MultisigInfo, Box<dyn std::error::Error>> {
    let secp = secp256k1::Secp256k1::new();
    let key1 = random_secret_key();
    let key2 = random_secret_key();
    let key3 = random_secret_key();
    let privkey1 = PrivateKey::new(key1, Network::Regtest);
    let privkey2 = PrivateKey::new(key2, Network::Regtest);
    let privkey3 = PrivateKey::new(key3, Network::Regtest);
    let pubkey1 = PublicKey::from_private_key(&secp, &privkey1);
    let pubkey2 = PublicKey::from_private_key(&secp, &privkey2);
    let pubkey3 = PublicKey::from_private_key(&secp, &privkey3);
    let descriptor_str = format!("sh(multi(2,{},{},{}))", pubkey1, pubkey2, pubkey3);
    let descriptor: Descriptor<PublicKey> = Descriptor::from_str(&descriptor_str)?;
    let address = descriptor.address(Network::Regtest)?;
    
    Ok(MultisigInfo {
        address: address.to_string(),
        descriptor: descriptor_str,
        private_keys: vec![privkey1, privkey2, privkey3],
        public_keys: vec![pubkey1, pubkey2, pubkey3],
    })
} 