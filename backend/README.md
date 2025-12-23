📦 Docker & Database Setup (TimescaleDB)
Prerequisites

Docker Desktop (Windows/Linux/Mac)

Docker Compose v2+

Verify:

docker --version
docker compose version

🐘 TimescaleDB Setup

We use TimescaleDB (PostgreSQL + time-series extensions)
for storing high-frequency L2 order book data.

Start database
docker compose up -d

Database details
Field	Value
Host	localhost
Port	5433
Database	orderbook
User	postgres
Password	postgres

Port 5433 is used to avoid conflicts with local PostgreSQL.

🧱 Schema Initialization

Connect to DB:

docker exec -it timescaledb psql -U postgres -d orderbook


Enable TimescaleDB:

CREATE EXTENSION IF NOT EXISTS timescaledb;


Create L2 order book table:

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



Convert to hypertable:

SELECT create_hypertable('l2_orderbook', 'ts');


Create index:

CREATE INDEX idx_l2_ts_desc ON l2_orderbook (ts DESC);

📥 Data Ingestion (CSV → DB)

Large datasets are ingested using PostgreSQL COPY
for performance and memory safety.

COPY l2_orderbook (...) 
FROM '/l2_clean.csv'
WITH (FORMAT csv, HEADER true);

🚀 Backend (FastAPI)

Start API server:

uvicorn main:app --reload --port 8000


WebSocket endpoint:

ws://localhost:8000/ws

📊 Frontend (React)
npm install
npm run dev


Dashboard connects automatically to WebSocket feed.