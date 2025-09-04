# Database Query Examples

This document provides example commands to interact with the PostgreSQL database running in the Docker container.

## Connection

```bash
# Connect to the database
docker-compose exec postgres psql -U btc_yield_user -d btc_yield
```

## User Queries

### List all users
```sql
SELECT id, evm_address, role, created_at FROM users ORDER BY created_at;
```

### Find users by role
```sql
-- All borrowers
SELECT * FROM users WHERE role = 'borrower';

-- All lenders
SELECT * FROM users WHERE role = 'lender';
```

### Find user by EVM address
```sql
SELECT * FROM users WHERE evm_address = '0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7';
```

## Loan Queries

### List all loans
```sql
SELECT 
    id, 
    evm_contract_id, 
    status, 
    amount, 
    created_at 
FROM loans 
ORDER BY created_at;
```

### Find loans by status
```sql
-- All requested loans
SELECT * FROM loans WHERE status = 'requested';

-- All active loans
SELECT * FROM loans WHERE status = 'active';

-- All offered loans
SELECT * FROM loans WHERE status = 'offered';
```

### Find loans by borrower
```sql
SELECT 
    l.*,
    u.evm_address as borrower_address
FROM loans l
JOIN users u ON l.borrower_id = u.id
WHERE u.evm_address = '0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7';
```

### Find loans by lender
```sql
SELECT 
    l.*,
    u.evm_address as lender_address
FROM loans l
JOIN users u ON l.lender_id = u.id
WHERE u.evm_address = '0x...';
```

### Loan details with user info
```sql
SELECT 
    l.id,
    l.evm_contract_id,
    l.status,
    l.amount,
    l.bond_amount,
    l.duration_blocks,
    l.created_at,
    borrower.evm_address as borrower_address,
    lender.evm_address as lender_address
FROM loans l
LEFT JOIN users borrower ON l.borrower_id = borrower.id
LEFT JOIN users lender ON l.lender_id = lender.id
ORDER BY l.created_at DESC;
```

## System Queries

### Check database health
```sql
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables;
```

### Count records
```sql
-- Total users
SELECT COUNT(*) as total_users FROM users;

-- Total loans
SELECT COUNT(*) as total_loans FROM loans;

-- Loans by status
SELECT status, COUNT(*) as count FROM loans GROUP BY status;
```

## Quick Commands

```bash
# One-liner queries
docker-compose exec postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM users;"
docker-compose exec postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM loans;"
docker-compose exec postgres psql -U btc_yield_user -d btc_yield -c "SELECT status, COUNT(*) FROM loans GROUP BY status;"
```

## Schema Information

```sql
-- List all tables
\dt

-- Describe loans table
\d loans

-- Describe users table
\d users
```
