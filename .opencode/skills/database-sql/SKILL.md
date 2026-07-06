# Database Skill — PostgreSQL + TimescaleDB

You are working with a **PostgreSQL 14 + TimescaleDB 2.7** time-series database for high-frequency market data.

## Schema

### Primary Hypertable: `l2_orderbook`
```sql
CREATE TABLE l2_orderbook (
    ts TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    mid_price DOUBLE PRECISION,
    spread DOUBLE PRECISION,
    bids JSONB,
    asks JSONB,
    ofi DOUBLE PRECISION,
    obi DOUBLE PRECISION,
    microprice DOUBLE PRECISION,
    vpin DOUBLE PRECISION,
    PRIMARY KEY (ts, symbol)
);
```

### Session Reports: `session_reports`
```sql
CREATE TABLE session_reports (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    s3_url TEXT,
    total_pnl DOUBLE PRECISION,
    win_rate DOUBLE PRECISION,
    trade_count INTEGER,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## TimescaleDB Configuration
- **Hypertable**: `SELECT create_hypertable('l2_orderbook', 'ts');`
- **Compression**: 8:1 ratio, segment by `symbol`, order by `ts DESC`
- **Compression policy**: Compress data older than 7 days
- **Retention policy**: Drop data older than 90 days
- **Indexes**: `idx_symbol_ts (symbol, ts DESC)`, `idx_ts (ts DESC)`

## Connection Pool (asyncpg)
Configured in `backend/db.py`:
- **Pool**: min=2, max=10 connections
- **Acquisition timeout**: 30s, command timeout: 60s
- **Retry**: 3 attempts with exponential backoff (1s → 2s → 4s)
- **Connection refresh**: After 50,000 queries
- **Prepared statement cache**: 300s lifetime, 15KB max size
- **Metrics**: Track acquisitions, releases, failures, timing

## When Querying
1. Always use the connection pool via `get_connection()` / `return_connection()`
2. Never use raw SQLAlchemy sessions for time-series data
3. Use parameterized queries (never string interpolation) to prevent SQL injection
4. Batch reads: use `LIMIT` and cursor-based pagination (`ts > $1 ORDER BY ts LIMIT $2`)
5. For REPLAY mode: `REPLAY_BATCH_SIZE` (default 500) rows per query
6. Connection acquisition time logged if > 100ms

## When Modifying Schema
1. Add migrations as SQL files, not auto-generated
2. Test on a copy before production
3. Consider TimescaleDB compression impact on new columns
4. Update `db_row_to_snapshot()` in `analytics_core.py` if column format changes
5. Index new columns if they're used in WHERE clauses

## Query Performance Targets
- 1-hour window query: <42ms for 576,000 rows (achieved)
- Insert rate: 160+ snapshots/second sustained
- Replay fetch: <100ms for 500-row batches

## Optimization Notes
- Use `jsonb` for bids/asks arrays (flexible, indexed)
- TimescaleDB chunks partition by time automatically
- `timescaledb.compress_segmentby = 'symbol'` for per-symbol compression efficiency
- `timescaledb.compress_orderby = 'ts DESC'` because we query most recent data

## Connection Pool Features
- Double-check locking for singleton pool creation
- Exponential backoff on connection failure
- Pool statistics endpoint at `GET /db/pool`
- Pool health check at `GET /db/health`
- Timeout protection on pool close (2s hard limit)
