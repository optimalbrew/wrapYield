use miniscript::{Descriptor, bitcoin::{Network, PrivateKey, secp256k1, PublicKey}};
use rand::RngCore;
use std::str::FromStr;

fn random_secret_key() -> secp256k1::SecretKey {
    let mut data = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut data);
    secp256k1::SecretKey::from_slice(&data).unwrap()
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    println!("Relative Timelock Example: 2-of-3 after 10 blocks, or backup key anytime");
    let secp = secp256k1::Secp256k1::new();
    let key1 = random_secret_key();
    let key2 = random_secret_key();
    let key3 = random_secret_key();
    let backup_key = PublicKey::from_private_key(&secp, &PrivateKey::new(random_secret_key(), Network::Regtest));
    let privkey1 = PrivateKey::new(key1, Network::Regtest);
    let privkey2 = PrivateKey::new(key2, Network::Regtest);
    let privkey3 = PrivateKey::new(key3, Network::Regtest);
    let pubkey1 = PublicKey::from_private_key(&secp, &privkey1);
    let pubkey2 = PublicKey::from_private_key(&secp, &privkey2);
    let pubkey3 = PublicKey::from_private_key(&secp, &privkey3);
    let csv_descriptor_str = format!("wsh(or_d(pk({}),and_v(v:multi(2,{},{},{}),older(10))))", backup_key, pubkey1, pubkey2, pubkey3);
    println!("CSV Descriptor: {}", csv_descriptor_str);
    let csv_descriptor: Descriptor<PublicKey> = Descriptor::from_str(&csv_descriptor_str)?;
    println!("Parsed CSV descriptor: {:?}", csv_descriptor);
    let csv_script = csv_descriptor.script_pubkey();
    println!("CSV Script: {:?}", csv_script);
    let csv_address = csv_descriptor.address(Network::Regtest)?;
    println!("CSV Regtest Address: {}", csv_address);
    Ok(())
} 