-- Database Optimization Script for L2 Order Book
-- Run this in PostgreSQL/TimescaleDB to improve query performance

-- 1. Add index on timestamp column (primary query column)
CREATE INDEX IF NOT EXISTS idx_l2_orderbook_ts ON l2_orderbook (ts DESC);

-- 2. Add partial index for recent data (last 7 days) - faster for real-time queries
CREATE INDEX IF NOT EXISTS idx_l2_orderbook_recent 
ON l2_orderbook (ts DESC) 
WHERE ts > NOW() - INTERVAL '7 days';

-- 3. Analyze table statistics for query planner
ANALYZE l2_orderbook;

-- 4. Verify indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'l2_orderbook';

-- 5. Check table size and index size
SELECT 
    pg_size_pretty(pg_total_relation_size('l2_orderbook')) AS total_size,
    pg_size_pretty(pg_relation_size('l2_orderbook')) AS table_size,
    pg_size_pretty(pg_total_relation_size('l2_orderbook') - pg_relation_size('l2_orderbook')) AS indexes_size;

-- Optional: If data is very large, consider partitioning by time
-- This is commented out as it requires table recreation
/*
-- Create partitioned table (TimescaleDB hypertable)
SELECT create_hypertable('l2_orderbook', 'ts', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Set compression policy (compress data older than 7 days)
ALTER TABLE l2_orderbook SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = ''
);

SELECT add_compression_policy('l2_orderbook', INTERVAL '7 days');
*/
