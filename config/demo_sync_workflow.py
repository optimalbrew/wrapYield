#!/usr/bin/env python3
"""
Configuration Synchronization Demo

This script demonstrates the complete workflow for updating configuration parameters
and maintaining synchronization across all three systems (Python, TypeScript, Solidity).

This is for demonstration purposes only - it temporarily modifies parameters.json
and then restores it to show the synchronization process.
"""

import json
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
import time

def backup_config():
    """Create a backup of the original configuration"""
    config_file = Path("parameters.json")
    backup_file = Path("parameters.json.backup")
    shutil.copy2(config_file, backup_file)
    print("📋 Created backup of parameters.json")

def restore_config():
    """Restore the original configuration"""
    config_file = Path("parameters.json")
    backup_file = Path("parameters.json.backup")
    if backup_file.exists():
        shutil.copy2(backup_file, config_file)
        backup_file.unlink()
        print("🔄 Restored original parameters.json")

def modify_config():
    """Temporarily modify some parameters for demonstration"""
    with open("parameters.json", 'r') as f:
        config = json.load(f)
    
    # Modify some parameters
    old_processing_fee = config['fees']['processingFee']['value']
    old_loan_duration = config['timelocks']['loanDuration']['blocks']
    
    config['fees']['processingFee']['value'] = "0.002"  # Changed from 0.001
    config['timelocks']['loanDuration']['blocks'] = 600000  # Changed from 540000
    config['lastUpdated'] = datetime.now().strftime("%Y-%m-%d")
    
    with open("parameters.json", 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✏️  Modified parameters.json:")
    print(f"   Processing fee: {old_processing_fee} → 0.002")
    print(f"   Loan duration: {old_loan_duration} → 600000")
    
    return old_processing_fee, old_loan_duration

def run_command(cmd, description):
    """Run a command and show its output"""
    print(f"\n🔧 {description}")
    print(f"$ {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            # Show abbreviated output for readability
            lines = result.stdout.strip().split('\n')
            if len(lines) > 20:
                print('\n'.join(lines[:10]))
                print(f"... ({len(lines) - 20} lines omitted) ...")
                print('\n'.join(lines[-10:]))
            else:
                print(result.stdout)
            return True
        else:
            print(f"❌ Command failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error running command: {e}")
        return False

def main():
    print("🎯 BTC Yield Protocol Configuration Synchronization Demo")
    print("=" * 65)
    print("This demo shows the complete workflow for updating configuration parameters")
    print("while maintaining synchronization across Python, TypeScript, and Solidity.")
    print("")
    
    try:
        # Step 1: Backup original configuration
        backup_config()
        
        # Step 2: Show initial state
        print("\n📊 Step 1: Check initial synchronization state")
        run_command("python3 sync_validation.py", "Validate initial state")
        
        # Step 3: Modify configuration
        print("\n✏️  Step 2: Modify parameters.json")
        old_processing_fee, old_loan_duration = modify_config()
        
        # Step 4: Show that systems are now out of sync
        print("\n⚠️  Step 3: Check synchronization after JSON modification")
        result = run_command("python3 sync_validation.py", "Validate after JSON changes")
        if result:
            print("ℹ️  As expected, Solidity is now out of sync because it uses hardcoded constants!")
        
        # Step 5: Regenerate Solidity configuration
        print("\n🔧 Step 4: Regenerate Solidity configuration from JSON")
        run_command("python3 generate_solidity_config.py", "Regenerate Solidity config")
        
        # Step 6: Validate that everything is now in sync
        print("\n✅ Step 5: Validate synchronization after regeneration")
        run_command("python3 sync_validation.py", "Final validation check")
        
        # Step 7: Show that tests still pass with new values
        print("\n🧪 Step 6: Run quick test to verify new parameters work")
        run_command("python3 -c \"from python_config import Config; c=Config(); print(f'New processing fee: {c.processing_fee.get_decimal_value()} ETH')\"", 
                   "Test new Python config")
        
        print("\n🎉 Demo completed successfully!")
        print("\nKey takeaways:")
        print("1. ✅ Python & TypeScript automatically pick up JSON changes")
        print("2. ⚠️  Solidity requires regeneration because it uses constants")
        print("3. 🔧 The generator script keeps everything in sync")
        print("4. 🔍 The validation script catches synchronization issues")
        print("5. 🛠️  The Makefile automates the entire workflow")
        
    except KeyboardInterrupt:
        print("\n⏸️  Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
    finally:
        # Always restore original configuration
        print("\n🔄 Restoring original configuration...")
        restore_config()
        
        # Regenerate Solidity with original values
        print("🔧 Regenerating Solidity with original values...")
        run_command("python3 generate_solidity_config.py", "Restore original Solidity config")
        
        print("✅ Demo cleanup complete - original configuration restored")

if __name__ == "__main__":
    main()
