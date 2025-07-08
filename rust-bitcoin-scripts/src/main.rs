mod classic_multisig;
mod timelock_cltv;
mod timelock_csv;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    classic_multisig::run()?;
    timelock_cltv::run()?;
    timelock_csv::run()?;
    Ok(())
}
