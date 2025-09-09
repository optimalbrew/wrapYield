# DB is a postgres container

To run SQL commands directly

```
docker exec -it btc-yield-postgres psql -U btc_yield_user -d btc_yield
```

then direct interaction `\dt` 

postgres is case sensitive about SQL keywords. So use `SELECT` not `select`

```
SELECT * FROM borrower_signatures;
```

# Check table structures
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d borrower_signatures"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d loans"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d signatures"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d users"

# Check data in each table
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM borrower_signatures;"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM loans;"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM signatures;"
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT COUNT(*) FROM users;"

# Check the structure of borrower_signatures table
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d borrower_signatures"

# Check the actual data in borrower_signatures
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT * FROM borrower_signatures;"

# Check the structure of users table
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "\d users"

# Check the actual data in users
docker exec btc-yield-postgres psql -U btc_yield_user -d btc_yield -c "SELECT * FROM users;"