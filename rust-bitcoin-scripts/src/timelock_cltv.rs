use miniscript::{Descriptor, bitcoin::{Network, PrivateKey, secp256k1, PublicKey}};
use rand::RngCore;
use std::str::FromStr;

fn random_secret_key() -> secp256k1::SecretKey {
    let mut data = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut data);
    secp256k1::SecretKey::from_slice(&data).unwrap()
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    println!("Timelock Example: 2-of-3 after block 500, or backup key anytime");
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
    let timelock_descriptor_str = format!("wsh(or_d(pk({}),and_v(v:multi(2,{},{},{}),after(500))))", backup_key, pubkey1, pubkey2, pubkey3);
    println!("Timelock Descriptor: {}", timelock_descriptor_str);
    let timelock_descriptor: Descriptor<PublicKey> = Descriptor::from_str(&timelock_descriptor_str)?;
    println!("Parsed timelock descriptor: {:?}", timelock_descriptor);
    let timelock_script = timelock_descriptor.script_pubkey();
    println!("Timelock Script: {:?}", timelock_script);
    let timelock_address = timelock_descriptor.address(Network::Regtest)?;
    println!("Timelock Regtest Address: {}", timelock_address);
    Ok(())
}

/// Generate a simple CLTV descriptor and address for a single key and block height
pub fn simple_cltv_descriptor(block_height: u32) -> (Descriptor<PublicKey>, PrivateKey, PublicKey, String) {
    let secp = secp256k1::Secp256k1::new();
    let key = {
        let mut data = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut data);
        secp256k1::SecretKey::from_slice(&data).unwrap()
    };
    let privkey = PrivateKey::new(key, Network::Regtest);
    let pubkey = PublicKey::from_private_key(&secp, &privkey);
    let descriptor_str = format!("wsh(and_v(pk({}),after({})))", pubkey, block_height);
    let descriptor: Descriptor<PublicKey> = Descriptor::from_str(&descriptor_str).unwrap();
    let address = descriptor.address(Network::Regtest).unwrap().to_string();
    println!("Simple CLTV Descriptor: {}", descriptor_str);
    println!("Simple CLTV Address: {}", address);
    (descriptor, privkey, pubkey, address)
} 