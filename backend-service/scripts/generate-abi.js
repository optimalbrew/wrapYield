#!/usr/bin/env node

/**
 * Script to generate ABI from compiled Solidity contract
 * This ensures the ABI is always up-to-date with the source code
 */

const fs = require('fs');
const path = require('path');

const CONTRACT_JSON_PATH = '../contracts/BtcCollateralLoan.json';
const OUTPUT_PATH = '../src/contracts/generated-abi.json';

function generateABI() {
  try {
    // Read the compiled contract JSON
    const contractPath = path.resolve(__dirname, CONTRACT_JSON_PATH);
    const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    
    // Extract only the events from the ABI
    const events = contractData.abi.filter(item => item.type === 'event');
    
    // Create the output object
    const output = {
      events: events,
      contractAddress: process.env.BTC_COLLATERAL_LOAN_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605',
      generatedAt: new Date().toISOString(),
      sourceContract: 'BtcCollateralLoan.sol'
    };
    
    // Ensure output directory exists
    const outputDir = path.dirname(path.resolve(__dirname, OUTPUT_PATH));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the generated ABI
    const outputPath = path.resolve(__dirname, OUTPUT_PATH);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`✅ Generated ABI with ${events.length} events`);
    console.log(`📁 Output: ${outputPath}`);
    
    // List the events
    console.log('\n📋 Events found:');
    events.forEach(event => {
      console.log(`  - ${event.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error generating ABI:', error.message);
    process.exit(1);
  }
}

generateABI();
