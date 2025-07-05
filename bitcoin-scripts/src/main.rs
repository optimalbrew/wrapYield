mod classic_multisig;
mod timelock_cltv;
mod timelock_csv;
mod taproot_tree;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    classic_multisig::run()?;
    timelock_cltv::run()?;
    timelock_csv::run()?;
    taproot_tree::run()?;
    Ok(())
}
