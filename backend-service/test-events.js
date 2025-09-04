const { ethers } = require('ethers');

const BTC_COLLATERAL_LOAN_ABI = [
  "event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress)",
  "event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 amount, uint256 bondAmount)"
];

async function testEvents() {
  try {
    const provider = new ethers.JsonRpcProvider('http://host.docker.internal:8545');
    const contractAddress = '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605';
    const contract = new ethers.Contract(contractAddress, BTC_COLLATERAL_LOAN_ABI, provider);
    
    console.log('Testing event queries...');
    
    // Query LoanRequested events from block 0 to current
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    const loanRequestedFilter = contract.filters.LoanRequested();
    const loanRequestedEvents = await contract.queryFilter(loanRequestedFilter, 0, currentBlock);
    console.log('LoanRequested events found:', loanRequestedEvents.length);
    
    for (const event of loanRequestedEvents) {
      console.log('LoanRequested event:', {
        loanId: event.args.loanId.toString(),
        borrower: event.args.borrower,
        amount: event.args.amount.toString(),
        btcAddress: event.args.btcAddress,
        blockNumber: event.blockNumber
      });
    }
    
    const loanOfferedFilter = contract.filters.LoanOffered();
    const loanOfferedEvents = await contract.queryFilter(loanOfferedFilter, 0, currentBlock);
    console.log('LoanOffered events found:', loanOfferedEvents.length);
    
    for (const event of loanOfferedEvents) {
      console.log('LoanOffered event:', {
        loanId: event.args.loanId.toString(),
        lender: event.args.lender,
        amount: event.args.amount.toString(),
        bondAmount: event.args.bondAmount.toString(),
        blockNumber: event.blockNumber
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEvents();
