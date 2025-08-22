# BTC Yield Protocol Configuration Management
# 
# This Makefile provides easy commands for managing the configuration system
# and ensuring synchronization across Python, TypeScript, and Solidity.

.PHONY: help validate generate test clean install

# Default target
help:
	@echo "BTC Yield Protocol Configuration Management"
	@echo "=========================================="
	@echo ""
	@echo "Available commands:"
	@echo "  make validate     - Check if all configs are in sync"
	@echo "  make generate     - Generate Solidity config from JSON"
	@echo "  make test         - Run all configuration tests"
	@echo "  make test-python  - Run Python configuration tests"
	@echo "  make test-ts      - Run TypeScript configuration tests"
	@echo "  make test-solidity - Run Solidity configuration tests"
	@echo "  make sync         - Auto-fix synchronization issues"
	@echo "  make clean        - Clean generated files"
	@echo "  make install      - Install dependencies"
	@echo "  make docs         - Show configuration documentation"

# Validate all configurations are in sync
validate:
	@echo "🔧 Validating configuration synchronization..."
	python3 sync_validation.py

# Generate Solidity configuration from JSON
generate:
	@echo "🔧 Generating Solidity configuration from parameters.json..."
	python3 generate_solidity_config.py

# Auto-fix synchronization issues
sync:
	@echo "🔄 Auto-fixing configuration synchronization..."
	python3 sync_validation.py --auto-fix

# Run all tests
test: test-python test-ts test-solidity
	@echo "✅ All configuration tests completed"

# Test Python configuration
test-python:
	@echo "🐍 Testing Python configuration..."
	python3 example_usage.py

# Test TypeScript configuration  
test-ts:
	@echo "📘 Testing TypeScript configuration..."
	node test_typescript_config.js

# Test Solidity configuration
test-solidity:
	@echo "⚡ Testing Solidity configuration..."
	@cd ../evmchain && forge test --match-contract ProtocolConfigTest -v

# Clean generated files
clean:
	@echo "🧹 Cleaning generated files..."
	@rm -f ../evmchain/src/ProtocolConfig.sol
	@echo "✅ Cleaned generated Solidity file"

# Install dependencies (if needed)
install:
	@echo "📦 Installing dependencies..."
	@# Python dependencies (if requirements.txt exists)
	@if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
	@# Node.js dependencies (if package.json exists)
	@if [ -f package.json ]; then npm install; fi
	@echo "✅ Dependencies installed"

# Show configuration documentation
docs:
	@echo "📚 Configuration Documentation"
	@echo "=============================="
	@echo ""
	@echo "Files:"
	@echo "  parameters.json              - Master configuration (SINGLE SOURCE OF TRUTH)"
	@echo "  python_config.py             - Python configuration module"
	@echo "  typescript_config.ts         - TypeScript configuration module"  
	@echo "  ../evmchain/src/ProtocolConfig.sol - Auto-generated Solidity configuration"
	@echo ""
	@echo "Workflow:"
	@echo "  1. Edit parameters.json"
	@echo "  2. Run 'make generate' to update Solidity"
	@echo "  3. Run 'make validate' to check sync"
	@echo "  4. Run 'make test' to verify everything works"
	@echo ""
	@echo "For full documentation, see README.md"

# Development workflow helper
dev-update: generate validate test
	@echo "🎉 Development update complete!"
	@echo "   - Solidity config regenerated"
	@echo "   - All systems validated"  
	@echo "   - All tests passed"

# Continuous Integration target
ci: validate test
	@echo "✅ CI validation complete"

# Pre-commit hook
pre-commit: validate
	@echo "✅ Pre-commit validation passed"
