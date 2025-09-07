-- Migration: 001_increase_varchar_columns_to_66_chars.sql
-- Date: 2025-09-07
-- Description: Increase varchar column sizes from 64 to 66 characters to accommodate hex values with 0x prefix
-- Reason: Smart contract events return hex values with 0x prefix (e.g., 0x114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927)
--         which are 66 characters total, but database columns were limited to 64 characters
-- Impact: Allows storing complete hex values without truncation

-- Update borrower_btc_pubkey from 64 to 66 chars
ALTER TABLE loans ALTER COLUMN borrower_btc_pubkey TYPE VARCHAR(66);

-- Update btc_pubkey from 64 to 66 chars  
ALTER TABLE loans ALTER COLUMN btc_pubkey TYPE VARCHAR(66);

-- Update btc_txid from 64 to 66 chars
ALTER TABLE loans ALTER COLUMN btc_txid TYPE VARCHAR(66);

-- Update lender_btc_pubkey from 64 to 66 chars
ALTER TABLE loans ALTER COLUMN lender_btc_pubkey TYPE VARCHAR(66);

-- Update preimage_hash_borrower from 64 to 66 chars
ALTER TABLE loans ALTER COLUMN preimage_hash_borrower TYPE VARCHAR(66);

-- Verify the changes
SELECT column_name, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND data_type = 'character varying' 
AND column_name IN ('borrower_btc_pubkey', 'btc_pubkey', 'btc_txid', 'lender_btc_pubkey', 'preimage_hash_borrower')
ORDER BY column_name;
