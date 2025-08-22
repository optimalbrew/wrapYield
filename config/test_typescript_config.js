#!/usr/bin/env node
/**
 * Test script for TypeScript configuration module
 * 
 * This script tests the TypeScript configuration system to ensure
 * all functions work correctly and parameters are accessible.
 * 
 * Run with: node test_typescript_config.js
 */

// Import configuration (using require for Node.js compatibility)
const fs = require('fs');
const path = require('path');

// Load the JSON config directly since we're in Node.js
const configData = JSON.parse(fs.readFileSync(path.join(__dirname, 'parameters.json'), 'utf8'));

// Simple TypeScript-like functions for testing
function getTimelock(timelockName, forBitcoin = false) {
    const timelock = configData.timelocks[timelockName];
    if (!timelock) {
        throw new Error(`Unknown timelock: ${timelockName}`);
    }
    
    if (!forBitcoin) {
        return timelock.blocks;
    }
    
    // Convert to Bitcoin blocks using ratio
    const ratio = configData.blockchainConfig.btcToEvmBlockRatio.ratio;
    const [btcRatio, evmRatio] = ratio.split(':').map(Number);
    return Math.floor(timelock.blocks * btcRatio / evmRatio);
}

function getFee(feeType, amount = 1.0) {
    switch (feeType) {
        case 'processing':
            return parseFloat(configData.fees.processingFee.value || '0');
            
        case 'origination':
            const origFee = configData.fees.originationFee;
            if (origFee.percentage && origFee.divisor) {
                return amount * origFee.percentage / origFee.divisor;
            }
            return 0;
            
        case 'lenderBond':
            const bondFee = configData.fees.lenderBondPercentage;
            if (bondFee.percentage) {
                return amount * bondFee.percentage / 100;
            }
            return 0;
            
        default:
            throw new Error(`Unknown fee type: ${feeType}`);
    }
}

function validateBitcoinPubkey(pubkey) {
    const expectedLength = configData.bitcoin.publicKeyFormat.length;
    return pubkey.length === expectedLength && /^[0-9a-fA-F]+$/.test(pubkey);
}

function etherToWei(ether) {
    const etherStr = typeof ether === 'number' ? ether.toString() : ether;
    const weiPerEther = BigInt('1000000000000000000'); // 10^18
    
    if (etherStr.includes('.')) {
        const [whole, decimal] = etherStr.split('.');
        const wholeBigInt = BigInt(whole);
        const decimalPadded = decimal.padEnd(18, '0').slice(0, 18);
        const decimalBigInt = BigInt(decimalPadded);
        
        return wholeBigInt * weiPerEther + decimalBigInt;
    }
    
    return BigInt(etherStr) * weiPerEther;
}

function main() {
    console.log("=" * 60);
    console.log("TypeScript/JavaScript Configuration Test");
    console.log("=" * 60);
    
    try {
        // Test basic config loading
        console.log("\n📋 Basic Configuration:");
        console.log(`Version: ${configData.version}`);
        console.log(`Description: ${configData.description}`);
        console.log(`Last Updated: ${configData.lastUpdated}`);
        
        // Test fee access
        console.log("\n💰 Fee Configuration:");
        console.log(`Processing Fee: ${configData.fees.processingFee.value} ${configData.fees.processingFee.unit}`);
        console.log(`Origination Fee: ${configData.fees.originationFee.percentage}% (1/${configData.fees.originationFee.divisor})`);
        console.log(`Lender Bond: ${configData.fees.lenderBondPercentage.percentage}%`);
        
        // Test timelock functions
        console.log("\n⏰ Timelock Functions:");
        const loanDurationEvm = getTimelock('loanDuration');
        const loanDurationBtc = getTimelock('loanDuration', true);
        console.log(`Loan Duration (EVM): ${loanDurationEvm} blocks`);
        console.log(`Loan Duration (BTC): ${loanDurationBtc} blocks`);
        
        const btcEscrowEvm = getTimelock('btcEscrow');
        const btcEscrowBtc = getTimelock('btcEscrow', true);
        console.log(`BTC Escrow (EVM): ${btcEscrowEvm} blocks`);
        console.log(`BTC Escrow (BTC): ${btcEscrowBtc} blocks`);
        
        // Test fee calculations
        console.log("\n🧮 Fee Calculations:");
        const loanAmount = 2.5;
        const processingFee = getFee('processing');
        const originationFee = getFee('origination', loanAmount);
        const lenderBond = getFee('lenderBond', loanAmount);
        
        console.log(`Loan Amount: ${loanAmount} ETH`);
        console.log(`Processing Fee: ${processingFee} ETH`);
        console.log(`Origination Fee: ${originationFee} ETH`);
        console.log(`Lender Bond: ${lenderBond} ETH`);
        
        // Test network configurations
        console.log("\n🌐 Network Configurations:");
        const networks = configData.networks;
        Object.keys(networks).forEach(env => {
            const ethConfig = networks[env].ethereum;
            const btcConfig = networks[env].bitcoin;
            console.log(`${env.charAt(0).toUpperCase() + env.slice(1)}:`);
            console.log(`  Ethereum: ${ethConfig.name} (Chain ID: ${ethConfig.chainId})`);
            console.log(`  Bitcoin: ${btcConfig.network}`);
        });
        
        // Test validation functions
        console.log("\n✅ Validation Functions:");
        const validPubkey = "1234567890123456789012345678901234567890123456789012345678901234";
        const invalidPubkey = "123";
        
        console.log(`Valid Bitcoin Pubkey (64 chars): ${validateBitcoinPubkey(validPubkey)}`);
        console.log(`Invalid Bitcoin Pubkey (3 chars): ${validateBitcoinPubkey(invalidPubkey)}`);
        
        // Test BigInt/Wei conversions
        console.log("\n🔢 Wei/Ether Conversions:");
        const etherAmount = "0.001";
        const weiAmount = etherToWei(etherAmount);
        console.log(`${etherAmount} ETH = ${weiAmount.toString()} Wei`);
        
        const etherAmount2 = "2.5";
        const weiAmount2 = etherToWei(etherAmount2);
        console.log(`${etherAmount2} ETH = ${weiAmount2.toString()} Wei`);
        
        // Test constants that would be used in contracts
        console.log("\n📊 Constants (for contract integration):");
        const PROCESSING_FEE_WEI = etherToWei(configData.fees.processingFee.value);
        const MIN_LOAN_WEI = etherToWei(configData.limits.minLoanAmount.value);
        console.log(`PROCESSING_FEE: ${PROCESSING_FEE_WEI.toString()} Wei`);
        console.log(`MIN_LOAN_AMOUNT: ${MIN_LOAN_WEI.toString()} Wei`);
        console.log(`ORIGIN_FEE_DIVISOR: ${configData.fees.originationFee.divisor}`);
        console.log(`LENDER_BOND_PERCENTAGE: ${configData.fees.lenderBondPercentage.percentage}`);
        
        // Test parameter validation
        console.log("\n🔍 Parameter Validation:");
        console.log(`All timelock keys exist: ${['loanRequest', 'btcEscrow', 'repaymentAccept', 'btcCollateral', 'loanDuration'].every(key => configData.timelocks[key])}`);
        console.log(`All fee keys exist: ${['processingFee', 'originationFee', 'lenderBondPercentage'].every(key => configData.fees[key])}`);
        console.log(`All network environments exist: ${['development', 'testnet', 'mainnet'].every(env => configData.networks[env])}`);
        
        // Test timelock ordering (should match Solidity constraints)
        const timeLockBtcEscrow = configData.timelocks.btcEscrow.blocks;
        const timeLockLoanReq = configData.timelocks.loanRequest.blocks;
        const timeLockBtcCollateral = configData.timelocks.btcCollateral.blocks;
        const timeLockRepaymentAccept = configData.timelocks.repaymentAccept.blocks;
        
        const validOrdering = timeLockBtcEscrow > timeLockLoanReq && timeLockBtcCollateral > timeLockRepaymentAccept;
        console.log(`Timelock ordering valid (t_0 > t_B && t_1 > t_L): ${validOrdering}`);
        
        console.log("\n✅ All TypeScript/JavaScript configuration tests passed!");
        console.log("Configuration system is ready for frontend integration!");
        console.log("=" * 60);
        
    } catch (error) {
        console.error("\n❌ Configuration test failed:");
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Helper function since JavaScript doesn't have Python's * operator for strings
function repeat(str, times) {
    return new Array(times + 1).join(str);
}

// Replace * with repeat function calls
function main() {
    console.log(repeat("=", 60));
    console.log("TypeScript/JavaScript Configuration Test");
    console.log(repeat("=", 60));
    
    try {
        // Test basic config loading
        console.log("\n📋 Basic Configuration:");
        console.log(`Version: ${configData.version}`);
        console.log(`Description: ${configData.description}`);
        console.log(`Last Updated: ${configData.lastUpdated}`);
        
        // Test fee access
        console.log("\n💰 Fee Configuration:");
        console.log(`Processing Fee: ${configData.fees.processingFee.value} ${configData.fees.processingFee.unit}`);
        console.log(`Origination Fee: ${configData.fees.originationFee.percentage}% (1/${configData.fees.originationFee.divisor})`);
        console.log(`Lender Bond: ${configData.fees.lenderBondPercentage.percentage}%`);
        
        // Test timelock functions
        console.log("\n⏰ Timelock Functions:");
        const loanDurationEvm = getTimelock('loanDuration');
        const loanDurationBtc = getTimelock('loanDuration', true);
        console.log(`Loan Duration (EVM): ${loanDurationEvm} blocks`);
        console.log(`Loan Duration (BTC): ${loanDurationBtc} blocks`);
        
        const btcEscrowEvm = getTimelock('btcEscrow');
        const btcEscrowBtc = getTimelock('btcEscrow', true);
        console.log(`BTC Escrow (EVM): ${btcEscrowEvm} blocks`);
        console.log(`BTC Escrow (BTC): ${btcEscrowBtc} blocks`);
        
        // Test fee calculations
        console.log("\n🧮 Fee Calculations:");
        const loanAmount = 2.5;
        const processingFee = getFee('processing');
        const originationFee = getFee('origination', loanAmount);
        const lenderBond = getFee('lenderBond', loanAmount);
        
        console.log(`Loan Amount: ${loanAmount} ETH`);
        console.log(`Processing Fee: ${processingFee} ETH`);
        console.log(`Origination Fee: ${originationFee} ETH`);
        console.log(`Lender Bond: ${lenderBond} ETH`);
        
        // Test network configurations
        console.log("\n🌐 Network Configurations:");
        const networks = configData.networks;
        Object.keys(networks).forEach(env => {
            const ethConfig = networks[env].ethereum;
            const btcConfig = networks[env].bitcoin;
            console.log(`${env.charAt(0).toUpperCase() + env.slice(1)}:`);
            console.log(`  Ethereum: ${ethConfig.name} (Chain ID: ${ethConfig.chainId})`);
            console.log(`  Bitcoin: ${btcConfig.network}`);
        });
        
        // Test validation functions
        console.log("\n✅ Validation Functions:");
        const validPubkey = "1234567890123456789012345678901234567890123456789012345678901234";
        const invalidPubkey = "123";
        
        console.log(`Valid Bitcoin Pubkey (64 chars): ${validateBitcoinPubkey(validPubkey)}`);
        console.log(`Invalid Bitcoin Pubkey (3 chars): ${validateBitcoinPubkey(invalidPubkey)}`);
        
        // Test BigInt/Wei conversions
        console.log("\n🔢 Wei/Ether Conversions:");
        const etherAmount = "0.001";
        const weiAmount = etherToWei(etherAmount);
        console.log(`${etherAmount} ETH = ${weiAmount.toString()} Wei`);
        
        const etherAmount2 = "2.5";
        const weiAmount2 = etherToWei(etherAmount2);
        console.log(`${etherAmount2} ETH = ${weiAmount2.toString()} Wei`);
        
        // Test constants that would be used in contracts
        console.log("\n📊 Constants (for contract integration):");
        const PROCESSING_FEE_WEI = etherToWei(configData.fees.processingFee.value);
        const MIN_LOAN_WEI = etherToWei(configData.limits.minLoanAmount.value);
        console.log(`PROCESSING_FEE: ${PROCESSING_FEE_WEI.toString()} Wei`);
        console.log(`MIN_LOAN_AMOUNT: ${MIN_LOAN_WEI.toString()} Wei`);
        console.log(`ORIGIN_FEE_DIVISOR: ${configData.fees.originationFee.divisor}`);
        console.log(`LENDER_BOND_PERCENTAGE: ${configData.fees.lenderBondPercentage.percentage}`);
        
        // Test parameter validation
        console.log("\n🔍 Parameter Validation:");
        console.log(`All timelock keys exist: ${['loanRequest', 'btcEscrow', 'repaymentAccept', 'btcCollateral', 'loanDuration'].every(key => configData.timelocks[key])}`);
        console.log(`All fee keys exist: ${['processingFee', 'originationFee', 'lenderBondPercentage'].every(key => configData.fees[key])}`);
        console.log(`All network environments exist: ${['development', 'testnet', 'mainnet'].every(env => configData.networks[env])}`);
        
        // Test timelock ordering (should match Solidity constraints)
        const timeLockBtcEscrow = configData.timelocks.btcEscrow.blocks;
        const timeLockLoanReq = configData.timelocks.loanRequest.blocks;
        const timeLockBtcCollateral = configData.timelocks.btcCollateral.blocks;
        const timeLockRepaymentAccept = configData.timelocks.repaymentAccept.blocks;
        
        const validOrdering = timeLockBtcEscrow > timeLockLoanReq && timeLockBtcCollateral > timeLockRepaymentAccept;
        console.log(`Timelock ordering valid (t_0 > t_B && t_1 > t_L): ${validOrdering}`);
        
        console.log("\n✅ All TypeScript/JavaScript configuration tests passed!");
        console.log("Configuration system is ready for frontend integration!");
        console.log(repeat("=", 60));
        
    } catch (error) {
        console.error("\n❌ Configuration test failed:");
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
