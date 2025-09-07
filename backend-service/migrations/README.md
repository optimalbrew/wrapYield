# Database Migrations

This directory contains SQL migration scripts for the BTC Yield Protocol database.

## Migration Files

- `001_increase_varchar_columns_to_66_chars.sql` - Increases varchar column sizes from 64 to 66 characters to accommodate hex values with `0x` prefix

## How to Apply Migrations

### Using Docker (Recommended)
```bash
# Apply a specific migration
docker exec -i btc-yield-postgres psql -U btc_yield_user -d btc_yield < migrations/001_increase_varchar_columns_to_66_chars.sql

# Apply all migrations (if you have a migration runner)
docker exec -i btc-yield-postgres psql -U btc_yield_user -d btc_yield < migrations/run_all_migrations.sql
```

### Direct Database Connection
```bash
psql -U btc_yield_user -d btc_yield -f migrations/001_increase_varchar_columns_to_66_chars.sql
```

## Migration Naming Convention

Use the format: `{sequence_number}_{descriptive_name}.sql`

Examples:
- `001_increase_varchar_columns_to_66_chars.sql`
- `002_add_new_table.sql`
- `003_add_indexes.sql`

## Best Practices

1. **Always backup** the database before applying migrations
2. **Test migrations** on development/staging before production
3. **Document changes** in the migration file comments
4. **Use transactions** for complex migrations
5. **Version control** all migration files
6. **Never modify** existing migration files after they've been applied to production
