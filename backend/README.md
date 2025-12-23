# Genesis Backend - HFT Market Surveillance System

## Overview
Production-grade FastAPI backend for real-time market microstructure analysis and HFT surveillance. Features include:
- Real-time L2 order book replay from TimescaleDB
- Advanced signal detection (spoofing, layering, depth shocks)
- Comprehensive monitoring with health checks and metrics
- Automated alert management with deduplication
- Background ML clustering for regime detection
- 76% test coverage with 46 automated tests

---

## 🏗️ Architecture

### Core Components
- **FastAPI Application** (`main.py`): WebSocket streaming, REST API, metrics collection
- **Analytics Engine** (`analytics.py`): Signal detection, data validation, alert management
- **Database Layer** (`db.py`): Connection pooling, optimized queries
- **Replay Controller** (`replay.py`): Hybrid data replay (DB/CSV/Simulation modes)

### Key Features
1. **Real-Time Processing:** 0.5ms average latency with connection pooling
2. **Smart Alerts:** Deduplication (5s windows), severity escalation, audit logging
3. **Data Safety:** 6-level validation pipeline with automatic sanitization
4. **Background ML:** Non-blocking K-Means clustering with thread-safe predictions
5. **Production Monitoring:** Health checks, latency percentiles, error tracking

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+ (3.11 recommended)
- Docker Desktop (Windows/Linux/Mac)
- Docker Compose v2+

Verify installation:
```bash
docker --version
docker compose version
python --version
```

### 1. Start Database (TimescaleDB)
```bash
cd backend
docker compose up -d
```

**Database Connection Details:**
| Field | Value |
|-------|-------|
| Host | localhost |
| Port | 5433 |
| Database | orderbook |
| User | postgres |
| Password | postgres |

*Port 5433 avoids conflicts with local PostgreSQL installations.*

### 2. Set Up Python Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Linux/Mac)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Initialize Database Schema
Connect to database:
```bash
docker exec -it timescaledb psql -U postgres -d orderbook
```

Run setup commands:
```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create L2 order book table
CREATE TABLE IF NOT EXISTS l2_orderbook (
  bid_price_1 DOUBLE PRECISION, bid_price_2 DOUBLE PRECISION, 
  bid_price_3 DOUBLE PRECISION, bid_price_4 DOUBLE PRECISION,
  bid_price_5 DOUBLE PRECISION, bid_price_6 DOUBLE PRECISION,
  bid_price_7 DOUBLE PRECISION, bid_price_8 DOUBLE PRECISION,
  bid_price_9 DOUBLE PRECISION, bid_price_10 DOUBLE PRECISION,
  bid_volume_1 DOUBLE PRECISION, bid_volume_2 DOUBLE PRECISION,
  bid_volume_3 DOUBLE PRECISION, bid_volume_4 DOUBLE PRECISION,
  bid_volume_5 DOUBLE PRECISION, bid_volume_6 DOUBLE PRECISION,
  bid_volume_7 DOUBLE PRECISION, bid_volume_8 DOUBLE PRECISION,
  bid_volume_9 DOUBLE PRECISION, bid_volume_10 DOUBLE PRECISION,
  ask_price_1 DOUBLE PRECISION, ask_price_2 DOUBLE PRECISION,
  ask_price_3 DOUBLE PRECISION, ask_price_4 DOUBLE PRECISION,
  ask_price_5 DOUBLE PRECISION, ask_price_6 DOUBLE PRECISION,
  ask_price_7 DOUBLE PRECISION, ask_price_8 DOUBLE PRECISION,
  ask_price_9 DOUBLE PRECISION, ask_price_10 DOUBLE PRECISION,
  ask_volume_1 DOUBLE PRECISION, ask_volume_2 DOUBLE PRECISION,
  ask_volume_3 DOUBLE PRECISION, ask_volume_4 DOUBLE PRECISION,
  ask_volume_5 DOUBLE PRECISION, ask_volume_6 DOUBLE PRECISION,
  ask_volume_7 DOUBLE PRECISION, ask_volume_8 DOUBLE PRECISION,
  ask_volume_9 DOUBLE PRECISION, ask_volume_10 DOUBLE PRECISION,
  ts TIMESTAMP NOT NULL
);

-- Convert to hypertable (time-series optimization)
SELECT create_hypertable('l2_orderbook', 'ts', if_not_exists => TRUE);

-- Create optimized index for descending time queries
CREATE INDEX IF NOT EXISTS idx_l2_ts_desc ON l2_orderbook (ts DESC);
```

### 4. Load Data (Optional)
If you have L2 data CSV file:
```bash
# Copy CSV to Docker container
docker cp ../l2_clean.csv timescaledb:/l2_clean.csv

# Run loader script
python loader/load_l2_data.py
```

Or use COPY command directly:
```sql
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

### 5. Start Backend Server
```bash
uvicorn main:app --reload --port 8000
```

Backend runs on: `http://localhost:8000`

---

## 📡 API Endpoints

### REST API

#### Health & Monitoring
```bash
# System health check
GET http://localhost:8000/health
# Returns: {"status": "healthy", "issues": [], "mode": "DB_REPLAY", "uptime": 123.45}

# Metrics (Prometheus-style)
GET http://localhost:8000/metrics
# Returns: avg_latency_ms:0.5 | p95_latency_ms:1.1 | p99_latency_ms:69.82

# Metrics dashboard (JSON)
GET http://localhost:8000/metrics/dashboard
# Returns: {"uptime": 123.45, "total_snapshots": 1000, "avg_latency_ms": 0.5, ...}
```

#### Alert Management
```bash
# Alert history (last 1000)
GET http://localhost:8000/alerts/history
# Returns: [{"timestamp": "2025-12-24T...", "type": "SPOOFING", "severity": "HIGH", ...}]

# Alert statistics
GET http://localhost:8000/alerts/stats
# Returns: {"total_alerts_logged": 86, "total_alerts_deduplicated": 12, ...}

# Anomaly detection logs
GET http://localhost:8000/anomalies
# Returns: [{"timestamp": "...", "issue": "Wide spread detected", ...}]
```

#### System Control
```bash
# Pause replay
POST http://localhost:8000/pause

# Resume replay
POST http://localhost:8000/resume

# Set replay speed (0.1 to 10x)
POST http://localhost:8000/speed
Content-Type: application/json
{"speed": 2.0}
```

### WebSocket API
```javascript
// Connect to real-time data stream
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const snapshot = JSON.parse(event.data);
  console.log('Bid-Ask Spread:', snapshot.spread);
  console.log('OBI:', snapshot.obi);
  console.log('Signals:', snapshot.signals);
};
```

**Snapshot Format:**
```json
{
  "timestamp": 1703419200.123,
  "bid_prices": [100.5, 100.4, 100.3, ...],
  "bid_volumes": [150, 200, 180, ...],
  "ask_prices": [100.6, 100.7, 100.8, ...],
  "ask_volumes": [120, 160, 140, ...],
  "best_bid": 100.5,
  "best_ask": 100.6,
  "spread": 0.1,
  "mid_price": 100.55,
  "obi": 0.25,
  "weighted_obi": 0.18,
  "total_bid_volume": 1500,
  "total_ask_volume": 1200,
  "market_regime": "CALM",
  "signals": ["SPOOFING_DETECTED", "LIQUIDITY_GAP"]
}
```

---

## 🧪 Testing

### Run All Tests
```bash
# Run with coverage report
pytest tests/ --cov=. --cov-report=html

# Quick run (no coverage)
pytest tests/ -q

# Verbose output
pytest tests/ -v
```

### Test Categories
- **Unit Tests (20):** `test_analytics.py` - DataValidator, AlertManager, AnalyticsEngine
- **Integration Tests (19):** `test_integration.py` - API endpoints, WebSocket, database
- **Scenario Tests (9):** `test_scenarios.py` - Spoofing, liquidity crises, stress tests

### Coverage Report
After running tests, open `htmlcov/index.html` in browser for detailed coverage breakdown.

**Current Coverage:** 76% overall
- analytics.py: 83%
- main.py: 46%
- db.py: 45%

---

## 📊 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Average Latency | 0.5ms | Down from 31ms (62x improvement) |
| P95 Latency | 1.1ms | 95% of requests |
| P99 Latency | 69ms | Includes ML training spikes |
| Throughput | 2.6-2.8 snapshots/sec | Real-time processing |
| Error Rate | 0% | With DataValidator sanitization |
| DB Connections | 1-5 pooled | SimpleConnectionPool |

---

## 🛠️ Configuration

### Environment Variables
Create `.env` file in backend directory:
```env
# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=orderbook
DB_USER=postgres
DB_PASSWORD=postgres

# Backend
MODE=DB_REPLAY  # Options: DB_REPLAY, CSV_REPLAY, SIMULATION
REPLAY_SPEED=1.0
DEBUG=false
```

### Replay Modes
1. **DB_REPLAY** (Primary): Streams data from TimescaleDB
2. **CSV_REPLAY** (Fallback): Reads from CSV file if DB unavailable
3. **SIMULATION** (Failsafe): Generates synthetic data

Mode automatically selected at startup based on data availability.

---

## 🔍 Signal Detection

### Implemented Signals
1. **SPOOFING:** Large L1 orders (>2x avg) that vanish (<0.2x avg) without execution
2. **LAYERING:** Multiple levels with imbalanced depth patterns
3. **LIQUIDITY_GAP:** Zero or tiny liquidity at best bid/ask
4. **DEPTH_SHOCK:** Sudden >30% drop in total book depth
5. **HEAVY_IMBALANCE:** Weighted OBI exceeds dynamic threshold
6. **WIDE_SPREAD:** Spread >10% of mid-price (data quality issue)

### Alert Management
- **Deduplication:** 5-second windows using MD5 hashing
- **Escalation:** Configurable thresholds per signal type
- **Audit Log:** Rolling buffer (maxlen=1000) with history API

---

## 🔧 Database Optimization

Run optimization script:
```bash
psql -h localhost -p 5433 -U postgres -d orderbook -f optimize_db.sql
```

**Optimizations include:**
- Descending time index for recent data queries
- Partial index for last 7 days (most frequently accessed)
- Hypertable partitioning for time-based sharding (optional)

---

## 🚨 Troubleshooting

### Database Connection Failed
```bash
# Check if Docker container is running
docker ps | grep timescaledb

# Restart database
docker compose restart

# View logs
docker compose logs timescaledb
```

### High Latency
```bash
# Check metrics
curl http://localhost:8000/metrics/dashboard

# Verify connection pool
# Should see 1-5 connections in use
```

### Tests Failing
```bash
# Ensure database is running for integration tests
docker compose up -d

# Check Python version (3.9+ required)
python --version

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

---

## 📚 Code Structure

```
backend/
├── main.py                 # FastAPI app, WebSocket, REST endpoints
├── analytics.py            # Signal detection, validation, alerts
├── db.py                   # Connection pooling, queries
├── replay.py               # Data replay controller
├── requirements.txt        # Python dependencies
├── pytest.ini              # Test configuration
├── docker-compose.yml      # TimescaleDB setup
├── optimize_db.sql         # Database optimization script
├── loader/
│   ├── load_l2_data.py     # CSV to DB ingestion
│   └── prepare_csv.py      # CSV preprocessing
└── tests/
    ├── conftest.py         # Test fixtures
    ├── test_analytics.py   # Unit tests (20)
    ├── test_integration.py # Integration tests (19)
    ├── test_scenarios.py   # Scenario tests (9)
    └── synthetic_data.py   # Test data generator
```

---

## 🤝 Contributing

### Before Submitting PR
1. Run test suite: `pytest tests/ --cov=.`
2. Ensure >75% code coverage
3. Add tests for new features
4. Update documentation

### Code Style
- Follow PEP 8
- Use type hints
- Add docstrings for public functions

---

## 📄 License
Proprietary - Genesis 2025 Project

---

## 📞 Support
For issues or questions, check:
- **PROJECT_STATUS.md** for development history
- **SETUP.md** for detailed database setup
- **Coverage Report** in `htmlcov/index.html`
