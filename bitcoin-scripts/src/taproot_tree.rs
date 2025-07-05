use miniscript::bitcoin::{Network, secp256k1};
use miniscript::bitcoin::secp256k1::XOnlyPublicKey;
use miniscript::Descriptor;
use rand::RngCore;
use std::str::FromStr;

fn random_secret_key() -> secp256k1::SecretKey {
    let mut data = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut data);
    secp256k1::SecretKey::from_slice(&data).unwrap()
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    println!("Taproot Example: MuSig2 (simulated) key path, script tree with timelock and multisig");
    let secp = secp256k1::Secp256k1::new();
    let xsk1 = random_secret_key();
    let xsk2 = random_secret_key();
    let xsk3 = random_secret_key();
    let xsk_backup = random_secret_key();
    let xpk1 = XOnlyPublicKey::from_slice(&secp256k1::PublicKey::from_secret_key(&secp, &xsk1).x_only_public_key().0.serialize()).unwrap();
    let xpk2 = XOnlyPublicKey::from_slice(&secp256k1::PublicKey::from_secret_key(&secp, &xsk2).x_only_public_key().0.serialize()).unwrap();
    let xpk3 = XOnlyPublicKey::from_slice(&secp256k1::PublicKey::from_secret_key(&secp, &xsk3).x_only_public_key().0.serialize()).unwrap();
    let xpk_backup = XOnlyPublicKey::from_slice(&secp256k1::PublicKey::from_secret_key(&secp, &xsk_backup).x_only_public_key().0.serialize()).unwrap();
    let musig_agg_sk = secp256k1::SecretKey::from_slice(&{
        let mut sum = [0u8; 32];
        for k in [&xsk1, &xsk2, &xsk3] {
            for (i, b) in k.secret_bytes().iter().enumerate() {
                sum[i] = sum[i].wrapping_add(*b);
            }
        }
        sum
    }).unwrap();
    let musig_agg_xpk = XOnlyPublicKey::from_slice(&secp256k1::PublicKey::from_secret_key(&secp, &musig_agg_sk).x_only_public_key().0.serialize()).unwrap();
    let taproot_descriptor_str = format!(
        "tr({},or_i(and_v(v:multi_a(2,{},{},{}),after(500)),pk({})))",
        musig_agg_xpk, xpk1, xpk2, xpk3, xpk_backup
    );
    println!("Taproot Descriptor: {}", taproot_descriptor_str);
    let taproot_descriptor: Descriptor<XOnlyPublicKey> = Descriptor::from_str(&taproot_descriptor_str)?;
    println!("Parsed Taproot descriptor: {:?}", taproot_descriptor);
    let taproot_script = taproot_descriptor.script_pubkey();
    println!("Taproot Script: {:?}", taproot_script);
    let taproot_address = taproot_descriptor.address(Network::Regtest)?;
    println!("Taproot Regtest Address: {}", taproot_address);
    Ok(())
} 