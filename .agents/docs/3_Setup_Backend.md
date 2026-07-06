# 🚀 Setup

## 1️⃣ Install Docker (ONLY requirement)

Download and install Docker Desktop:
👉 https://www.docker.com/products/docker-desktop/

After installation, restart your system. Verify installation:

```
docker --version
docker compose version
```

If both commands work, continue.

## 2️⃣ Start TimescaleDB (No DB install needed)
From the project root directory, run:

```
docker compose up -d
```
This will:

- Pull TimescaleDB automatically
- Create the database
- Expose it on port 5433

Verify container is running:
```
docker ps
```
You should see something like:
`timescaledb   timescale/timescaledb:latest-pg14`

## 3️⃣ Enter the Database (psql)
```
docker exec -it timescaledb psql -U postgres -d orderbook
```

You should see:
`orderbook=#`

## 4️⃣ Enable TimescaleDB Extension (One Time)
```
CREATE EXTENSION IF NOT EXISTS timescaledb;
```
Verify:
```
SELECT extname FROM pg_extension;
```
You must see:
`timescaledb`

## 5️⃣ Create the L2 Order Book Table
```
CREATE TABLE l2_orderbook (
    ts TIMESTAMPTZ NOT NULL,

    bid_price_1 DOUBLE PRECISION,
    bid_price_2 DOUBLE PRECISION,
    bid_price_3 DOUBLE PRECISION,
    bid_price_4 DOUBLE PRECISION,
    bid_price_5 DOUBLE PRECISION,
    bid_price_6 DOUBLE PRECISION,
    bid_price_7 DOUBLE PRECISION,
    bid_price_8 DOUBLE PRECISION,
    bid_price_9 DOUBLE PRECISION,
    bid_price_10 DOUBLE PRECISION,

    bid_volume_1 DOUBLE PRECISION,
    bid_volume_2 DOUBLE PRECISION,
    bid_volume_3 DOUBLE PRECISION,
    bid_volume_4 DOUBLE PRECISION,
    bid_volume_5 DOUBLE PRECISION,
    bid_volume_6 DOUBLE PRECISION,
    bid_volume_7 DOUBLE PRECISION,
    bid_volume_8 DOUBLE PRECISION,
    bid_volume_9 DOUBLE PRECISION,
    bid_volume_10 DOUBLE PRECISION,

    ask_price_1 DOUBLE PRECISION,
    ask_price_2 DOUBLE PRECISION,
    ask_price_3 DOUBLE PRECISION,
    ask_price_4 DOUBLE PRECISION,
    ask_price_5 DOUBLE PRECISION,
    ask_price_6 DOUBLE PRECISION,
    ask_price_7 DOUBLE PRECISION,
    ask_price_8 DOUBLE PRECISION,
    ask_price_9 DOUBLE PRECISION,
    ask_price_10 DOUBLE PRECISION,

    ask_volume_1 DOUBLE PRECISION,
    ask_volume_2 DOUBLE PRECISION,
    ask_volume_3 DOUBLE PRECISION,
    ask_volume_4 DOUBLE PRECISION,
    ask_volume_5 DOUBLE PRECISION,
    ask_volume_6 DOUBLE PRECISION,
    ask_volume_7 DOUBLE PRECISION,
    ask_volume_8 DOUBLE PRECISION,
    ask_volume_9 DOUBLE PRECISION,
    ask_volume_10 DOUBLE PRECISION
);
```

## 6️⃣ Convert Table to Timescale Hypertable
```
SELECT create_hypertable('l2_orderbook', 'ts');
```
Verify:
```SELECT hypertable_name
FROM timescaledb_information.hypertables;
```

Expected output:
`l2_orderbook`

## 7️⃣ Copy Dataset into the Container
From host machine terminal (not inside psql):
```
docker cp backend/dataset/l2_clean.csv timescaledb:/l2_clean.csv
```
(Windows users can use absolute paths if needed.)

## 8️⃣ Import Dataset (COPY)
Inside psql:
```
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
```
Expected output:
`COPY 3730870`

## 9️⃣ Verify Import
```
SELECT COUNT(*) FROM l2_orderbook;
```

Expected:
`3730870`

## 🔟 Backend Connection String
Use this in the backend:
`postgresql://postgres:postgres@localhost:5433/orderbook`

No local PostgreSQL installation is required.
