const { ethers } = require('ethers');

const BTC_COLLATERAL_LOAN_ABI = [
  "event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress, string btcPubkey, bytes32 preimageHashBorrower, bytes32 txid_p2tr0, uint32 vout_p2tr0)"
];

async function testContract() {
  try {
    const provider = new ethers.JsonRpcProvider('http://host.docker.internal:8545');
    const contractAddress = '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605';
    const contract = new ethers.Contract(contractAddress, BTC_COLLATERAL_LOAN_ABI, provider);
    
    console.log('Testing contract connection...');
    
    // Test basic connection
    const code = await provider.getCode(contractAddress);
    console.log('Contract code length:', code.length);
    
    // Test event filtering
    const filter = contract.filters.LoanRequested();
    console.log('Filter created:', filter);
    
    // Query events from block 0 to current
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    const events = await contract.queryFilter(filter, 0, currentBlock);
    console.log('Events found:', events.length);
    
    for (const event of events) {
      console.log('Event:', event);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testContract();
