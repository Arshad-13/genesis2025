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

## 3️⃣ Initialize and Populate the Database

We have provided automated database setup scripts in the project root to configure the TimescaleDB schemas, convert tables to hypertables, and bulk load the 1.16 GB `l2_clean.csv` dataset.

### On Windows (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File ./init_database.ps1
```

---

## 💡 Alternative Manual Setup Method

If you prefer to perform the setup steps manually, run the following commands:

### 1. Copy the dataset into the container
```bash
docker cp l2_clean.csv timescaledb:/l2_clean.csv
```

### 2. Enter the Database container
```bash
docker exec -it timescaledb psql -U postgres -d trading_hub
```

### 3. Create schema & convert to hypertable
Inside the `psql` shell:
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE l2_orderbook (
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
```

### 4. Bulk import the CSV dataset
```sql
COPY l2_orderbook FROM '/l2_clean.csv' WITH (FORMAT csv, HEADER true);
```

### 5. Verify the row counts
```sql
SELECT COUNT(*) FROM l2_orderbook;
-- Expected output: 3730870
```

## 🔟 Backend Connection String
Use this in the backend:
`postgresql://postgres:postgres@localhost:5433/orderbook`

No local PostgreSQL installation is required.
