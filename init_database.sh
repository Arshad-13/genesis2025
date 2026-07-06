#!/bin/bash
set -e

echo "=== Genesis 2025 Database Initializer ==="

# 1. Copy CSV file to container
echo "1. Copying l2_clean.csv to timescaledb container..."
if [ -f "l2_clean.csv" ]; then
  docker cp l2_clean.csv timescaledb:/l2_clean.csv
elif [ -f "backend/dataset/l2_clean.csv" ]; then
  docker cp backend/dataset/l2_clean.csv timescaledb:/l2_clean.csv
else
  echo "⚠️ Warning: l2_clean.csv not found in root or backend/dataset. Skipping import."
  exit 1
fi

# 2. Run SQL scripts inside container
echo "2. Initializing schema, hypertable, and importing data..."
docker exec -i timescaledb psql -U postgres -d trading_hub <<EOF
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS l2_orderbook (
    ts TIMESTAMPTZ NOT NULL,
    bid_price_1 DOUBLE PRECISION, bid_price_2 DOUBLE PRECISION, bid_price_3 DOUBLE PRECISION, bid_price_4 DOUBLE PRECISION, bid_price_5 DOUBLE PRECISION,
    bid_price_6 DOUBLE PRECISION, bid_price_7 DOUBLE PRECISION, bid_price_8 DOUBLE PRECISION, bid_price_9 DOUBLE PRECISION, bid_price_10 DOUBLE PRECISION,
    bid_volume_1 DOUBLE PRECISION, bid_volume_2 DOUBLE PRECISION, bid_volume_3 DOUBLE PRECISION, bid_volume_4 DOUBLE PRECISION, bid_volume_5 DOUBLE PRECISION,
    bid_volume_6 DOUBLE PRECISION, bid_volume_7 DOUBLE PRECISION, bid_volume_8 DOUBLE PRECISION, bid_volume_9 DOUBLE PRECISION, bid_volume_10 DOUBLE PRECISION,
    ask_price_1 DOUBLE PRECISION, ask_price_2 DOUBLE PRECISION, ask_price_3 DOUBLE PRECISION, ask_price_4 DOUBLE PRECISION, ask_price_5 DOUBLE PRECISION,
    ask_price_6 DOUBLE PRECISION, ask_price_7 DOUBLE PRECISION, ask_price_8 DOUBLE PRECISION, ask_price_9 DOUBLE PRECISION, ask_price_10 DOUBLE PRECISION,
    ask_volume_1 DOUBLE PRECISION, ask_volume_2 DOUBLE PRECISION, ask_volume_3 DOUBLE PRECISION, ask_volume_4 DOUBLE PRECISION, ask_volume_5 DOUBLE PRECISION,
    ask_volume_6 DOUBLE PRECISION, ask_volume_7 DOUBLE PRECISION, ask_volume_8 DOUBLE PRECISION, ask_volume_9 DOUBLE PRECISION, ask_volume_10 DOUBLE PRECISION
);

SELECT create_hypertable('l2_orderbook', 'ts', if_not_exists => TRUE);

TRUNCATE TABLE l2_orderbook;

COPY l2_orderbook (
    bid_price_1, bid_price_2, bid_price_3, bid_price_4, bid_price_5,
    bid_price_6, bid_price_7, bid_price_8, bid_price_9, bid_price_10,
    bid_volume_1, bid_volume_2, bid_volume_3, bid_volume_4, bid_volume_5,
    bid_volume_6, bid_volume_7, bid_volume_8, bid_volume_9, bid_volume_10,
    ask_price_1, ask_price_2, ask_price_3, ask_price_4, ask_price_5,
    ask_price_6, ask_price_7, ask_price_8, ask_price_9, ask_price_10,
    ask_volume_1, ask_volume_2, ask_volume_3, ask_volume_4, ask_volume_5,
    ask_volume_6, ask_volume_7, ask_volume_8, ask_volume_9, ask_volume_10,
    ts
)
FROM '/l2_clean.csv'
WITH (FORMAT csv, HEADER true);

CREATE INDEX IF NOT EXISTS idx_l2_orderbook_ts ON l2_orderbook (ts DESC);
EOF

echo "✅ Database initialized and optimized successfully!"
