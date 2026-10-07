# Database Partitioning Plan

## Overview
As Coral Gardens scales to support high volumes of concurrent sales and multiple business locations (tenants), the `sales_entries` and `stock_movements` tables will eventually outgrow standard indexing. Postgres allows table partitioning to split these massive tables into smaller, highly-performant chunks.

This plan details a **time-based partitioning (by month)** strategy.

## When to Implement
Do **NOT** implement partitioning immediately. It adds operational overhead and is generally not beneficial until a single table exceeds ~50 million rows or index sizes exceed available RAM (causing significant cache misses). 

**Trigger thresholds:**
- `stock_movements` > 20M rows
- Sequential scan degradation on `created_at` filters despite indexes.
- Archiving old data becomes necessary (partitioning allows dropping old partitions instantly).

## Implementation Steps

### 1. Rename Existing Tables
We must rename the existing tables so we can create new partitioned tables with the original names.
```sql
ALTER TABLE stock_movements RENAME TO stock_movements_old;
ALTER TABLE sales_entries RENAME TO sales_entries_old;
```

### 2. Create Partitioned Parent Tables
We redefine the tables with `PARTITION BY RANGE` on the date column. 
*Note: Partitioned tables cannot have global UNIQUE/PRIMARY KEY constraints that do not include the partition key.*

```sql
CREATE TABLE stock_movements (
    id UUID DEFAULT uuid_generate_v4(),
    department_id UUID,
    item_id UUID NOT NULL,
    movement_type TEXT NOT NULL,
    quantity_changed NUMERIC NOT NULL,
    user_id UUID,
    reference_id UUID,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (created_at, id) -- Partition key must be part of PK
) PARTITION BY RANGE (created_at);
```

### 3. Create Current & Future Partitions
Create tables for specific date ranges (e.g., month by month).
```sql
CREATE TABLE stock_movements_y2026m10 PARTITION OF stock_movements
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE stock_movements_y2026m11 PARTITION OF stock_movements
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
```
*Note: We highly recommend using `pg_partman` (available in Supabase) to automatically generate new monthly partitions going forward.*

### 4. Migrate Old Data
Move data from the `_old` tables into the new partitioned structure.
```sql
INSERT INTO stock_movements 
SELECT * FROM stock_movements_old;
```
*Once confirmed, `stock_movements_old` can be dropped.*

## Maintenance
If using native Postgres without `pg_partman`, a scheduled job (e.g. `pg_cron`) must run a week before the end of the month to execute the DDL creating the next month's partition. Failure to do so will result in inserts failing for out-of-range dates.
