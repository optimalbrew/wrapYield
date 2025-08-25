-- Database initialization script for BTC Yield Protocol
-- This script sets up extensions and basic configuration

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create indexes for better performance (these will be created by migrations)
-- This file is just for Docker initialization
