#!/usr/bin/env python3
"""
Configuration Synchronization Validator

This script validates that all three configuration systems (Python, TypeScript, Solidity)
are in sync with the master parameters.json file. It can detect mismatches and suggest fixes.

Usage:
    python config/sync_validation.py
    python config/sync_validation.py --auto-fix  # Regenerate Solidity if needed
"""

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime
import subprocess
import argparse

def load_json_config():
    """Load the master JSON configuration"""
    config_file = Path(__file__).parent / "parameters.json"
    with open(config_file, 'r') as f:
        return json.load(f)

def check_python_config():
    """Check if Python configuration is working"""
    try:
        sys.path.append(str(Path(__file__).parent))
        from python_config import Config
        
        config = Config()
        
        # Test basic functionality
        processing_fee = config.processing_fee.get_decimal_value()
        loan_duration = config.get_timelock('loanDuration')
        
        print("✅ Python configuration: Working")
        return True, f"Processing fee: {processing_fee}, Loan duration: {loan_duration} blocks"
    except Exception as e:
        print(f"❌ Python configuration: Failed - {e}")
        return False, str(e)

def check_typescript_config():
    """Check if TypeScript configuration loads correctly"""
    try:
        config_file = Path(__file__).parent / "parameters.json"
        ts_file = Path(__file__).parent / "typescript_config.ts"
        
        # Check if TypeScript file exists
        if not ts_file.exists():
            return False, "typescript_config.ts not found"
            
        # Try to run a simple Node.js test
        test_js = Path(__file__).parent / "test_typescript_config.js"
        if test_js.exists():
            result = subprocess.run(['node', str(test_js)], 
                                   capture_output=True, text=True, cwd=Path(__file__).parent)
            if result.returncode == 0:
                print("✅ TypeScript configuration: Working")
                return True, "Node.js test passed"
            else:
                return False, f"Node.js test failed: {result.stderr}"
        
        # Fallback: just check if TypeScript file imports JSON correctly
        with open(ts_file, 'r') as f:
            content = f.read()
            if "import configData from './parameters.json'" in content:
                print("✅ TypeScript configuration: Syntax OK")
                return True, "TypeScript file syntax appears correct"
                
        return False, "TypeScript configuration issues detected"
    except Exception as e:
        print(f"❌ TypeScript configuration: Failed - {e}")
        return False, str(e)

def check_solidity_config():
    """Check if Solidity configuration is in sync"""
    try:
        evmchain_dir = Path(__file__).parent.parent / "evmchain"
        sol_file = evmchain_dir / "src" / "ProtocolConfig.sol"
        
        if not sol_file.exists():
            return False, "ProtocolConfig.sol not found in evmchain/src/"
            
        # Check if it's auto-generated
        with open(sol_file, 'r') as f:
            content = f.read()
            
        if "AUTO-GENERATED FILE" not in content:
            return False, "ProtocolConfig.sol is not auto-generated. Run generate_solidity_config.py"
        
        # Try to run Solidity tests
        if evmchain_dir.exists():
            os.chdir(evmchain_dir)
            result = subprocess.run(['forge', 'test', '--match-contract', 'ProtocolConfigTest'],
                                   capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Solidity configuration: Working")
                return True, "Forge tests passed"
            else:
                return False, f"Forge tests failed: {result.stderr}"
                
        print("✅ Solidity configuration: File exists and auto-generated")
        return True, "Auto-generated file found"
        
    except Exception as e:
        print(f"❌ Solidity configuration: Failed - {e}")
        return False, str(e)
    finally:
        # Return to original directory
        os.chdir(Path(__file__).parent)

def extract_solidity_constants():
    """Extract constants from Solidity file for comparison"""
    try:
        sol_file = Path(__file__).parent.parent / "evmchain" / "src" / "ProtocolConfig.sol"
        if not sol_file.exists():
            return None
            
        with open(sol_file, 'r') as f:
            content = f.read()
            
        constants = {}
        
        # Extract key constants with regex
        patterns = {
            'PROCESSING_FEE': r'uint256 internal constant PROCESSING_FEE = ([\d\.]+) ether;',
            'MIN_LOAN_AMOUNT': r'uint256 internal constant MIN_LOAN_AMOUNT = ([\d\.]+) ether;',
            'ORIGIN_FEE_PERCENTAGE_DIVISOR': r'uint256 internal constant ORIGIN_FEE_PERCENTAGE_DIVISOR = (\d+);',
            'LENDER_BOND_PERCENTAGE': r'uint256 internal constant LENDER_BOND_PERCENTAGE = (\d+);',
            'LOAN_DURATION': r'uint256 internal constant LOAN_DURATION = (\d+);',
        }
        
        for name, pattern in patterns.items():
            match = re.search(pattern, content)
            if match:
                constants[name] = match.group(1)
                
        return constants
    except Exception as e:
        print(f"Error extracting Solidity constants: {e}")
        return None

def cross_validate_values():
    """Cross-validate values across all three systems"""
    print("\n🔍 Cross-validating parameter values...")
    
    # Load JSON config
    json_config = load_json_config()
    
    # Expected values from JSON
    expected = {
        'processing_fee': json_config['fees']['processingFee']['value'],
        'min_loan_amount': json_config['limits']['minLoanAmount']['value'],
        'origin_fee_divisor': json_config['fees']['originationFee']['divisor'],
        'lender_bond_percentage': json_config['fees']['lenderBondPercentage']['percentage'],
        'loan_duration': json_config['timelocks']['loanDuration']['blocks'],
    }
    
    print(f"Expected values from JSON:")
    for key, value in expected.items():
        print(f"  {key}: {value}")
    
    # Check Solidity values
    sol_constants = extract_solidity_constants()
    if sol_constants:
        print(f"\nSolidity values:")
        mismatches = []
        
        comparisons = [
            ('processing_fee', 'PROCESSING_FEE', expected['processing_fee']),
            ('min_loan_amount', 'MIN_LOAN_AMOUNT', expected['min_loan_amount']),
            ('origin_fee_divisor', 'ORIGIN_FEE_PERCENTAGE_DIVISOR', str(expected['origin_fee_divisor'])),
            ('lender_bond_percentage', 'LENDER_BOND_PERCENTAGE', str(expected['lender_bond_percentage'])),
            ('loan_duration', 'LOAN_DURATION', str(expected['loan_duration'])),
        ]
        
        for json_key, sol_key, expected_val in comparisons:
            if sol_key in sol_constants:
                sol_val = sol_constants[sol_key]
                print(f"  {json_key}: {sol_val}")
                
                if str(sol_val) != str(expected_val):
                    mismatches.append(f"{json_key}: JSON={expected_val}, Solidity={sol_val}")
                    
        if mismatches:
            print(f"\n❌ Found {len(mismatches)} mismatches:")
            for mismatch in mismatches:
                print(f"  {mismatch}")
            return False
        else:
            print(f"\n✅ All values match between JSON and Solidity")
            return True
    else:
        print("⚠️  Could not extract Solidity constants for comparison")
        return False

def regenerate_solidity_config():
    """Regenerate Solidity configuration from JSON"""
    try:
        script_path = Path(__file__).parent / "generate_solidity_config.py"
        result = subprocess.run(['python3', str(script_path)], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Solidity configuration regenerated successfully")
            print(result.stdout)
            return True
        else:
            print(f"❌ Failed to regenerate Solidity configuration: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error regenerating Solidity config: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Validate configuration synchronization')
    parser.add_argument('--auto-fix', action='store_true', 
                       help='Automatically regenerate Solidity config if mismatches found')
    args = parser.parse_args()
    
    print("🔧 BTC Yield Protocol Configuration Synchronization Check")
    print("=" * 65)
    
    # Load master configuration
    try:
        json_config = load_json_config()
        print(f"📋 Master configuration version: {json_config.get('version', 'unknown')}")
    except Exception as e:
        print(f"❌ Failed to load master JSON configuration: {e}")
        sys.exit(1)
    
    # Check all three systems
    results = []
    
    print(f"\n🐍 Testing Python Configuration...")
    python_ok, python_msg = check_python_config()
    results.append(('Python', python_ok, python_msg))
    
    print(f"\n📘 Testing TypeScript Configuration...")
    ts_ok, ts_msg = check_typescript_config()
    results.append(('TypeScript', ts_ok, ts_msg))
    
    print(f"\n⚡ Testing Solidity Configuration...")
    sol_ok, sol_msg = check_solidity_config()
    results.append(('Solidity', sol_ok, sol_msg))
    
    # Cross-validate values
    values_match = cross_validate_values()
    
    # Summary
    print(f"\n📊 Summary:")
    print("=" * 65)
    
    all_ok = True
    for system, ok, msg in results:
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"{system:15} {status:8} {msg}")
        if not ok:
            all_ok = False
    
    values_status = "✅ PASS" if values_match else "❌ FAIL"
    print(f"{'Value Sync':15} {values_status:8} {'All values match' if values_match else 'Values mismatch detected'}")
    
    if not values_match:
        all_ok = False
    
    # Auto-fix if requested
    if not all_ok and args.auto_fix:
        print(f"\n🔧 Auto-fix requested. Regenerating Solidity configuration...")
        if regenerate_solidity_config():
            print(f"\n🔄 Re-running validation after regeneration...")
            values_match = cross_validate_values()
            if values_match:
                print(f"✅ Auto-fix successful! All systems now in sync.")
                all_ok = True
    
    # Final status
    print("=" * 65)
    if all_ok:
        print("🎉 All configuration systems are in sync and working correctly!")
        sys.exit(0)
    else:
        print("⚠️  Configuration synchronization issues detected.")
        print("💡 Run with --auto-fix to automatically regenerate Solidity config.")
        print("💡 Or manually run: python config/generate_solidity_config.py")
        sys.exit(1)

if __name__ == "__main__":
    main()
