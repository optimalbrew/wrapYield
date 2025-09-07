const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load ABI
const ABI_PATH = path.join(__dirname, '../contracts/BtcCollateralLoan.json');
const BTC_COLLATERAL_LOAN_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8')).abi;

// Contract configuration
const CONTRACT_ADDRESS = '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605';
const RPC_URL = 'http://host.docker.internal:8545';

// Import database service (Drizzle ORM)
const databaseService = require('../dist/services/databaseService').default;
const { loans } = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

async function syncExistingLoans() {
  try {
    console.log('🔄 Starting sync of existing loans...');
    
    // Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BTC_COLLATERAL_LOAN_ABI, provider);
    
    // Get total number of loans
    const totalLoans = await contract.getTotalLoans();
    console.log(`📊 Total loans on contract: ${totalLoans}`);
    
    // Query each loan
    for (let i = 1; i <= Number(totalLoans); i++) {
      try {
        console.log(`\n🔍 Querying loan ${i}...`);
        const loanData = await contract.getLoan(i);
        
        console.log(`📋 Loan ${i} details:`);
        console.log(`   Borrower: ${loanData.borrowerAddr}`);
        console.log(`   Amount: ${loanData.amount.toString()}`);
        console.log(`   Status: ${loanData.status}`);
        console.log(`   Borrower BTC Pubkey: ${loanData.borrowerBtcPubkey}`);
        console.log(`   Preimage Hash Borrower: ${loanData.preimageHashBorrower}`);
        console.log(`   TXID P2TR0: ${loanData.txid_p2tr0}`);
        console.log(`   VOUT P2TR0: ${loanData.vout_p2tr0}`);
        console.log(`   Preimage Hash Lender: ${loanData.preimageHashLender}`);
        console.log(`   Offer Block Height: ${loanData.offerBlockheight}`);
        console.log(`   Activation Block Height: ${loanData.activationBlockheight}`);
        console.log(`   Repayment Block Height: ${loanData.repaymentBlockheight}`);
        
        // Update database with complete loan data using Drizzle ORM
        try {
          const db = databaseService.getDatabase();
          if (db) {
            const updateResult = await db.update(loans)
              .set({
                borrowerBtcPubkey: loanData.borrowerBtcPubkey,
                preimageHashBorrower: loanData.preimageHashBorrower,
                btcTxid: loanData.txid_p2tr0,
                btcVout: Number(loanData.vout_p2tr0),
                preimageHashLender: loanData.preimageHashLender,
                offerBlockHeight: loanData.offerBlockheight ? Number(loanData.offerBlockheight) : null,
                activationBlockHeight: loanData.activationBlockheight ? Number(loanData.activationBlockheight) : null,
                repaymentBlockHeight: loanData.repaymentBlockheight ? Number(loanData.repaymentBlockheight) : null,
                updatedAt: new Date()
              })
              .where(eq(loans.evmContractId, i.toString()));
            
            console.log(`   ✅ Updated database for loan ${i}`);
          } else {
            console.error(`   ❌ Database connection not available for loan ${i}`);
          }
        } catch (dbError) {
          console.error(`   ❌ Database update failed for loan ${i}:`, dbError.message);
        }
        
      } catch (error) {
        console.error(`❌ Error querying loan ${i}:`, error.message);
      }
    }
    
    console.log('\n✅ Sync completed!');
    
  } catch (error) {
    console.error('❌ Error during sync:', error);
  }
}

// Run the sync
syncExistingLoans();
