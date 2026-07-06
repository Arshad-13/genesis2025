# Genesis 2025: Market Microstructure Analysis & Trading Platform

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![Deployed](https://img.shields.io/badge/deployed-AWS-orange)](https://trading-hub.live)
[![Python](https://img.shields.io/badge/python-3.11-blue)]()
[![React](https://img.shields.io/badge/react-18-blue)]()
[![C++](https://img.shields.io/badge/c++-17-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

![Homepage Preview](./assets/Homepage.png)

A professional-grade high-frequency trading (HFT) market surveillance platform for cryptocurrency markets, featuring real-time order book analysis, AI-driven price prediction, automated paper trading, and advanced market manipulation detection.

---

## 🌐 Live Demo

**The platform is now fully deployed and live at: [trading-hub.live](https://trading-hub.live)** 🚀

> Hosted on **AWS** with high-availability architecture including ECS, RDS, S3, and CloudWatch monitoring.  
See our complete cloud architecture below: [Cloud Deployment](#%EF%B8%8F-cloud-deployment)

> To get a quick overview of the system in action, watch the short demo video:  
 [Project Demo](#-project-demo)
>
> For a deeper, technically detailed proof of work and implementation details, refer to the documentation:  
[Complete Proof of Work](docs/Complete_ProofOfWork.md)

---

## 🚀 Key Features

### 📊 Real-Time Market Data Processing
- **160+ snapshots/second** from Binance WebSocket (BTC/USDT, ETH/USDT, SOL/USDT)
- **Sub-10ms end-to-end latency** (data ingestion → analytics → UI)
- **Level 2 order book** reconstruction with 20 price levels
- **LIVE/REPLAY modes** with seamless switching

### ⚡ Dual Analytics Engine
- **C++ gRPC Engine**: 0.5ms average latency (4.4x faster)
- **Python Engine**: Full-featured fallback with automatic failover
- **40+ microstructure features**: OFI, OBI, VPIN, Microprice, Spread metrics
- **Automatic health monitoring** with transparent engine switching

### 🔍 Advanced Anomaly Detection
- **Spoofing Detection**: Large non-bona fide orders with risk scoring (0-100%)
- **Layering Detection**: Multiple fake liquidity levels
- **Liquidity Gaps**: Price levels with insufficient volume (severity-weighted)
- **Market Regime Classification**: Calm, Stressed, Execution Hot, Manipulation Suspected
- **Heavy Imbalance & Spread Shock** detection


### 🤖 Deep Learning Price Prediction
- **DeepLOB CNN Model**: 63.4% accuracy (vs 33% random baseline)
- **Triple Barrier Labeling**: UP/NEUTRAL/DOWN predictions
- **GPU-Accelerated Inference**: 3.2ms per prediction (RTX 4060)
- **5-Fold Cross-Validation**: Robust generalization
- **Real-time predictions** with 100-snapshot rolling window

<img src="./assets/deeplob.png" width="500" alt="DeepLOB Architecture">
### 💰 Automated Multi-Strategy Portfolio & Risk Management
- **Portfolio Engine**: Concurrently runs 4 strategies: `MomentumBreakout` (OFI/momentum), `MeanReversion` (spread Z-score/VPIN), `SpoofingCounter` (order book wall fading), and `MarketMaking` (spread modeling).
- **Risk Controls**: Configurable Stop-Loss (SL), Take-Profit (TP), position timeouts, and portfolio-wide cumulative drawdown circuit breakers.
- **Detailed Tracking**: Live positions, realized/unrealized PnL breakdown per strategy, and active allocation charts.

### 🔍 Advanced Surveillance, Alerts & Spoof Radar
- **Spoof Radar**: Interactive depth profiles pointing out massive non-bona fide orders with real-time risk scores (0-100%).
- **Custom Alert Engine**: Define dynamic threshold rules (e.g., `vpin > 0.6` or `spoofing_risk > 0.8`) persisted to Postgres/Timescale and broadcasted over WebSockets.
- **Rule Evaluator**: Automatically flags events and renders anomaly timestamps on playback scrubber controls.

### 🧪 Microstructure Lab & Saliency Analysis
- **Autograd Saliency**: Live backpropagation of DeepLOB predictions to output the top 5 driving order book features/levels.
- **Correlation Heat Grid**: Live rolling 100-tick correlation matrix of microstructure indicators.
- **SVG Scatter Visualizer**: Live scatter plots showing relationships (e.g., OFI vs. Mid Price Divergence).

### 📈 Professional Dashboards
- **New Page Layouts**: Integrated 3 new pages: **Strategy Arena** (quantitative A/B tuning), **Surveillance Dashboard** (spoof wall radar + alerts rules), and **Microstructure Lab** (saliency + correlation grids).
- **Interactive Scrubber**: Timeline range input with anomaly event ticks.
- **Reports Export**: Dynamic equity line curves, session PnL histograms, and print-ready PDF export template.
- **Demo Login Autofill**: Seamless testing with a dashed autofill card on the login screen.

### 💾 Time-Series Database & Automated Setup
- **PostgreSQL + TimescaleDB**: 1.3M+ snapshots stored with an 8:1 compression ratio.
- **Automated Init Scripts**: `init_database.sh` (Linux/macOS) and `init_database.ps1` (Windows) copy the 1.16 GB dataset, construct hypertable partitions, bulk import, and build indices.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GENESIS 2025 PLATFORM                     │
└─────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │  Binance API     │  BTC/USDT Perpetual Futures
  │  WebSocket       │  @depth20@100ms
  └────────┬─────────┘
           │
           ▼
  ┌────────────────────────────────────────────────┐
  │     Market Ingestor (Python + gRPC)            │
  │  • WebSocket client                            │
  │  • Order book reconstruction                   │
  │  • Dynamic symbol switching                    │
  └────────┬───────────────────────────────────────┘
           │ gRPC Stream
           ▼
  ┌──────────────────────────────────────────────────────────┐
  │              FastAPI Backend (Python)                    │
  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
  │  │ Session Mgmt │  │ Analytics    │  │ Strategy Engine│  │
  │  │ • Multi-user │  │ • C++/Python │  │ • Paper trading│  │
  │  │ • LIVE/REPLAY│  │ • 40+ metrics│  │ • PnL tracking │  │
  │  └──────────────┘  └──────────────┘  └────────────────┘  │
  │  ┌──────────────┐  ┌─────────────────────────────────┐   │
  │  │ ML Inference │  │ Monitoring & Metrics            │   │
  │  │ • DeepLOB    │  │ • Health checks, latency stats  │   │
  │  │ • GPU accel  │  │ • Alert deduplication           │   │
  │  └──────────────┘  └─────────────────────────────────┘   │
  └────────┬──────────────────────┬────────────────┬─────────┘
           │ gRPC                 │ WebSocket      │ SQL
           ▼                      ▼                ▼
  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐
  │  C++ Engine    │  │  React Frontend  │  │  PostgreSQL +  │
  │  • Sub-ms      │  │  • Canvas charts │  │  TimescaleDB   │
  │  • 40+ features│  │  • Live WS       │  │  • 1.3M snaps  │
  └────────────────┘  └──────────────────┘  └────────────────┘
```

<img src="./assets/Architecture.jpg" width="600" alt="Architecture">
---

## 📦 Tech Stack

### Backend
- **Language**: Python 3.11
- **Framework**: FastAPI (async API server)
- **Database**: PostgreSQL 14 + TimescaleDB 2.7
- **Message Queue**: gRPC for C++ interop
- **WebSockets**: Real-time client communication
- **ML Framework**: PyTorch 2.0 (GPU-accelerated)

### C++ Engine
- **Standard**: C++17
- **Framework**: gRPC + Protocol Buffers
- **Build System**: CMake 3.20+
- **Performance**: 0.5ms average latency

### Frontend
- **Framework**: React 18 + Vite 4
- **UI Library**: Tailwind CSS 3
- **Icons**: Lucide React
- **Charts**: Custom Canvas API rendering

### DevOps
- **Containerization**: Docker + Docker Compose
- **Testing**: pytest (95+ tests, 87% coverage)
- **Monitoring**: Prometheus-style metrics

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose**
- **Node.js 18+** & **npm**

### 1️⃣ Clone Repository & Verify Checkpoints
```bash
git clone https://github.com/yourusername/genesis2025.git
cd genesis2025
```
Make sure `model_building/checkpoints/best_deeplob_fold5.pth` and `scaler_params.json` are placed in the `model_building/checkpoints/` folder.

### 2️⃣ Spin Up the Backend Stack (Docker)
```bash
cd backend
docker compose up -d --build
# Starts: TimescaleDB, C++ Analytics Engine, Live Ingestor, and FastAPI Backend
```

### 3️⃣ Initialize the Database
Run the database initialization script from the project root:
- **On Linux / macOS:**
  ```bash
  cd ../
  chmod +x init_database.sh
  ./init_database.sh
  ```
- **On Windows (PowerShell):**
  ```powershell
  cd ../
  powershell -ExecutionPolicy Bypass -File ./init_database.ps1
  ```

### 4️⃣ Start Frontend
```bash
cd market-microstructure
npm install
npm run dev
# Dashboard opens at http://localhost:5173
```

### 5️⃣ Access Dashboard
Open **http://localhost:5173** in your browser:
- Click the **"CLICK TO AUTOFILL DEMO ACCOUNT"** card at the bottom of the login screen and click **"Sign In"**.
- Use the sidebar navigation to explore the new **Strategy Arena**, **Surveillance Dashboard**, and **Microstructure Lab**.

---

## 🎯 Usage Guide

### Dashboard Modes

#### 🔴 LIVE Mode
- Connects to Binance WebSocket
- Real-time order book streaming
- Symbol switching (BTC, ETH, SOL)
- Live anomaly detection

#### ▶️ REPLAY Mode
- Historical data playback from database
- Adjustable playback speed (1x, 2x, 5x, 10x)
- Pause/Resume controls
- Scrubbing through timeline

### Paper Trading Controls

```bash
# Start strategy (via UI or API)
curl -X POST http://localhost:8000/strategy/start

# Stop strategy
curl -X POST http://localhost:8000/strategy/stop

# Reset PnL
curl -X POST http://localhost:8000/strategy/reset
```

**Strategy Logic**:
- **Entry**: Model confidence > 23% (LONG on UP, SHORT on DOWN)
- **Exit**: Confidence < 22% or opposite signal
- **Position Size**: 1.0 BTC (fixed)
- **No Leverage**: Simple spot paper trading

### Analytics Engine Switching

```bash
# Check current engine
curl http://localhost:8000/engine/status

# Switch to C++ (high performance)
curl -X POST http://localhost:8000/engine/switch/cpp

# Switch to Python (fallback)
curl -X POST http://localhost:8000/engine/switch/python

# Run benchmark
curl -X POST http://localhost:8000/engine/benchmark
```

---

## 📊 Performance Metrics

### System Performance
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Data Ingestion | <5ms | 1.2ms | ✅ |
| C++ Analytics | <1ms | 0.7ms | ✅ |
| Model Inference | <5ms | 3.2ms | ✅ |
| End-to-End Latency | <10ms | 6.9ms | ✅ |
| Throughput | 100+/s | 162/s | ✅ |

### Model Performance
- **Accuracy**: 63.4% (test set)
- **Precision (UP)**: 62%
- **Recall (UP)**: 73%
- **F1-Score**: 67%

### Trading Simulation (24h replay)
- **Total Trades**: 94
- **Win Rate**: 59.6%
- **Total PnL**: +$287.40
- **Max Drawdown**: -$62.30
- **Sharpe Ratio**: 1.82

> ⚠️ **Disclaimer**: Paper trading results. Real trading involves slippage, fees, and market impact.

---

## 🧪 Testing

### Run Full Test Suite
```bash
cd backend
pytest tests/ -v

# Expected output:
# ======================== 95 passed, 2 skipped in 12.34s ========================
# Coverage: 87%
```

### Test Categories
- ✅ Database connection pooling
- ✅ WebSocket streaming
- ✅ Analytics calculations (OFI, OBI, Spread)
- ✅ Anomaly detection (spoofing, gaps, layering)
- ✅ Engine switching (C++/Python)
- ✅ Strategy execution logic

### Performance Testing
```bash
# Load test (10 concurrent clients, 60s)
python load_test.py --clients 10 --duration 60

# Stress test (100 clients)
python load_test.py --clients 100 --duration 30
```

---

## 📁 Project Structure

```
genesis2025/
├── backend/                     # Python FastAPI backend
│   ├── main.py                  # Application entry point
│   ├── analytics_core.py        # Feature calculations
│   ├── inference_service.py     # ML model inference
│   ├── strategy_service.py      # Paper trading engine
│   ├── session_replay.py        # Session management
│   ├── grpc_client/             # C++ engine client
│   ├── tests/                   # Test suite (95 tests)
│   └── docker-compose.yml       # Services orchestration
├── cpp_engine/                  # C++ analytics engine
│   ├── proto/analytics.proto    # gRPC service definition
│   ├── src/server.cpp           # gRPC server
│   ├── src/analytics_engine.cpp # Core algorithms
│   └── CMakeLists.txt           # Build configuration
├── market_ingestor/             # Binance WebSocket client
│   └── main.py                  # Order book ingestion
├── market-microstructure/       # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Main monitoring page
│   │   │   └── ModelTest.jsx    # Strategy control page
│   │   └── components/
│   │       ├── CanvasPriceChart.jsx
│   │       ├── OrderBook.jsx
│   │       ├── SignalMonitor.jsx
│   │       ├── LiquidityGapMonitor.jsx
│   │       ├── SpoofingDetector.jsx
│   │       └── RiskDashboard.jsx
│   └── vite.config.js
├── model_building/              # ML model training
│   ├── src/
│   │   ├── train.py             # Training script
│   │   ├── model.py             # DeepLOB architecture
│   │   └── evaluate.py          # Validation
│   └── checkpoints/
│       ├── best_deeplob_fold5.pth
│       └── scaler_params.json
└── docs/                        # Documentation
    ├── Complete_POW.md          # Full project documentation
    ├── 2_Features_shipped.md    # Shipped features
    ├── 4_Cpp_Engine_Microservice_Setup.md
    ├── 5_Cpp_Engine_Integration.md
    └── 6_Market_Ingestor_Microservice.md
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend Configuration
USE_CPP_ENGINE=true              # Enable C++ analytics engine
CPP_ENGINE_HOST=localhost        # C++ engine host
CPP_ENGINE_PORT=50051            # C++ engine port

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/genesis

# Model Inference
MODEL_PATH=model_building/checkpoints/best_deeplob_fold5.pth
DEVICE=cuda                      # 'cuda' or 'cpu'

# Market Data
BINANCE_WS_URL=wss://fstream.binance.com/ws
DEFAULT_SYMBOL=BTCUSDT


AWS_ACCESS_KEY_ID=***********
AWS_SECRET_ACCESS_KEY=***************
AWS_REGION=eu-north-1
S3_BUCKET_NAME=tradinghub-report
```

### Docker Compose Services

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    ports:
      - "5432:5432"
  
  cpp-analytics:
    build: ../cpp_engine
    ports:
      - "50051:50051"
  
  backend:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - cpp-analytics
```

---

## 🛠️ Troubleshooting

### LIVE Mode Not Working

**Issue**: Dashboard shows old timestamps instead of live data.

**Solution**:
```bash
# 1. Stop Docker container on port 6000
docker ps | grep 6000
docker stop <container_id>

# 2. Run market_ingestor locally
cd market_ingestor
python main.py

# 3. Restart backend
cd backend
python main.py
```

### C++ Engine Not Connected

**Issue**: Backend falls back to Python engine.

**Solution**:
```bash
# Check C++ engine status
docker logs cpp-analytics

# Rebuild if needed
docker-compose build cpp-analytics
docker-compose up -d cpp-analytics

# Test connection
grpcurl -plaintext localhost:50051 list
```

### Database Connection Failed

**Solution**:
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Restart database
docker-compose restart postgres

# Verify connection
psql -h localhost -U genesis -d genesis
```
## ☁️ Cloud Deployment

**🎉 The platform is now fully deployed and operational on AWS!**

Access the live application at: **[trading-hub.live](https://trading-hub.live)**

### Production Infrastructure

The platform is architected for high availability and automated scaling using AWS infrastructure:

- **Orchestration**: Dockerized microservices deployed via **Amazon ECS**
- **Data Persistence**: **RDS (PostgreSQL + TimescaleDB)** for time-series data and **S3** for long-term report storage
- **Monitoring & Alerts**: **CloudWatch** for logs with automated email notifications via **Amazon SES**
- **CI/CD Integration**: Seamless deployment pipeline from **GitHub** to **EC2/ECR**
- **Load Balancing**: Application Load Balancer for traffic distribution
- **Security**: VPC isolation, security groups, and SSL/TLS encryption

<img src="./assets/Deployment.jpg" width="600" alt="AWS Deployment Architecture">



## 🎓 Key Concepts

### Market Microstructure Features

1. **Order Flow Imbalance (OFI)**
   - Measures aggressive buying/selling pressure
   - Range: [-1, 1]
   - High OFI → Upward price pressure

2. **Order Book Imbalance (OBI)**
   - Volume-weighted bid/ask imbalance
   - Multi-level calculation (top 10 levels)
   - Predictive of short-term price moves

3. **Microprice**
   - Volume-weighted fair price
   - `(Ask₁ × Bid_Vol + Bid₁ × Ask_Vol) / Total_Vol`
   - More accurate than simple mid-price

4. **VPIN (Volume-Synchronized Probability of Informed Trading)**
   - Detects informed trading activity
   - Requires trade data (not just L2 book)

### Anomaly Types

- **Spoofing**: Large fake orders to manipulate price
- **Layering**: Multiple orders creating false liquidity
- **Liquidity Gaps**: Price levels with thin volume
- **Heavy Imbalance**: Extreme bid/ask volume skew
- **Spread Shock**: Sudden bid-ask spread widening

### Market Regimes

1. **Calm**: Low volatility, tight spreads
2. **Stressed**: High volatility, order book imbalance
3. **Execution Hot**: Large orders, aggressive trading
4. **Manipulation Suspected**: Multiple anomalies detected

---

## � API Reference

### Core Endpoints

#### Strategy Control
```bash
# Start strategy for specific session
POST /strategy/{session_id}/start

# Stop strategy
POST /strategy/{session_id}/stop

# Reset PnL and trade history
POST /strategy/{session_id}/reset
```

#### Report Generation & Download
```bash
# Get all trading reports
GET /reports
Response: {
  "reports": [
    {
      "filename": "session_abc123_2026-01-12.json",
      "size_kb": 45.2,
      "timestamp": "2026-01-12T10:30:00Z",
      "s3_url": "https://s3.amazonaws.com/..."
    }
  ]
}

# Download specific report
GET /reports/download/{filename}
Response: JSON or CSV file download
```

#### Session Management
```bash
# List all active sessions
GET /sessions
Response: [{"session_id": "...", "mode": "LIVE", "active": true}]

# Delete session
DELETE /sessions/{session_id}
```

#### Replay Control
```bash
# Start replay mode
POST /replay/{session_id}/start

# Pause playback
POST /replay/{session_id}/pause

# Resume playback
POST /replay/{session_id}/resume

# Adjust speed (1-10x)
POST /replay/{session_id}/speed/{value}

# Jump back in time (seconds)
POST /replay/{session_id}/goback/{seconds}

# Get replay state
GET /replay/{session_id}/state
```

#### Mode Switching
```bash
# Switch between LIVE/REPLAY
POST /mode
Body: {"mode": "LIVE", "symbol": "BTCUSDT"}
```

#### Analytics & Features
```bash
# Get current calculated features
GET /features
Response: {
  "ofi": 0.23,
  "obi": -0.15,
  "microprice": 42350.45,
  "spread": 0.10,
  ...
}

# Get detected anomalies
GET /anomalies
Response: {
  "anomalies": [
    {
      "type": "SPOOFING",
      "severity": "HIGH",
      "risk_score": 85.3,
      "timestamp": "2026-01-12T10:30:00Z"
    }
  ]
}
```

#### WebSocket Connection
```javascript
// Connect to real-time data stream
const ws = new WebSocket('ws://localhost:8000/ws/{session_id}');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  // Message types:
  // - 'snapshot': Real-time market data
  // - 'trade_event': Trade execution
  // - 'history': Historical data batch
};
```

### WebSocket Message Format

#### Snapshot Message
```json
{
  "type": "snapshot",
  "timestamp": "2026-01-12T10:30:00.123Z",
  "mid_price": 42350.50,
  "bids": [[42350.00, 1.5], [42349.50, 2.1], ...],
  "asks": [[42351.00, 1.2], [42351.50, 1.8], ...],
  "prediction": {
    "up": 0.45,
    "neutral": 0.30,
    "down": 0.25
  },
  "strategy": {
    "pnl": {
      "realized": 125.50,
      "unrealized": 23.40,
      "total": 148.90,
      "position": 1.0,
      "is_active": true
    },
    "trade_event": {
      "id": 42,
      "timestamp": "2026-01-12T10:30:00Z",
      "side": "BUY",
      "price": 42350.00,
      "size": 1.0,
      "type": "ENTRY",
      "confidence": 0.67,
      "pnl": 0.0
    }
  },
  "anomalies": [
    {
      "type": "SPOOFING",
      "severity": "HIGH",
      "risk_score": 85.3,
      "side": "ASK",
      "message": "Large non-bona fide order detected"
    }
  ]
}
```

#### Trade Event Message
```json
{
  "type": "trade_event",
  "data": {
    "id": 42,
    "timestamp": "2026-01-12T10:30:00Z",
    "side": "SELL",
    "price": 42450.00,
    "size": 1.0,
    "type": "EXIT",
    "pnl": 100.00
  }
}
```

---

## 💾 Database Schema & Setup

### TimescaleDB Configuration

```sql
-- Primary hypertable for order book snapshots
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

-- Convert to hypertable (automatic partitioning)
SELECT create_hypertable('l2_orderbook', 'ts');

-- Enable compression (8:1 ratio achieved)
ALTER TABLE l2_orderbook SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'ts DESC'
);

-- Compression policy (compress data older than 7 days)
SELECT add_compression_policy('l2_orderbook', INTERVAL '7 days');

-- Data retention policy (drop data older than 90 days)
SELECT add_retention_policy('l2_orderbook', INTERVAL '90 days');

-- Indexes for fast queries
CREATE INDEX idx_symbol_ts ON l2_orderbook (symbol, ts DESC);
CREATE INDEX idx_ts ON l2_orderbook (ts DESC);
```

### Session Reports Table

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

CREATE INDEX idx_session_created ON session_reports (session_id, created_at DESC);
```

### Database Initialization

```bash
# Run migrations
cd backend
python -c "from utils.database import Base, engine; Base.metadata.create_all(bind=engine)"

# Load sample data (optional)
python loader/load_l2_data.py --csv ../l2_clean.csv --limit 10000

# Verify TimescaleDB setup
psql -h localhost -U genesis -d genesis -c "SELECT * FROM timescaledb_information.hypertables;"
```

### Optimization Queries

```sql
-- Query performance for 1-hour window
SELECT ts, mid_price, spread 
FROM l2_orderbook 
WHERE symbol = 'BTCUSDT' 
  AND ts >= NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;
-- Typical execution: ~42ms for 576,000 rows

-- Aggregate statistics
SELECT 
    symbol,
    AVG(spread) as avg_spread,
    MAX(ofi) as max_ofi,
    COUNT(*) as snapshot_count
FROM l2_orderbook
WHERE ts >= NOW() - INTERVAL '24 hours'
GROUP BY symbol;
```

---

## 🤖 Model Retraining Guide

### Data Preparation

```bash
cd model_building

# 1. Extract features from raw order book data
python src/prepare_data.py \
  --input ../backend/data/l2_orderbook_export.csv \
  --output data/training_data.csv \
  --window 100 \
  --horizon 10

# 2. Split into train/val/test sets (60/20/20)
python src/split_data.py \
  --input data/training_data.csv \
  --train-ratio 0.6 \
  --val-ratio 0.2
```

### Training Configuration

Edit `src/config.py`:
```python
CONFIG = {
    'batch_size': 64,
    'epochs': 50,
    'learning_rate': 0.001,
    'weight_decay': 1e-5,
    'num_folds': 5,
    'early_stopping_patience': 10,
    'device': 'cuda',  # or 'cpu'
    'model_type': 'deeplob',  # DeepLOB CNN architecture
}
```

### Training Process

```bash
# Train with 5-fold cross-validation
python src/train.py \
  --config src/config.py \
  --data data/training_data.csv \
  --output checkpoints/ \
  --num-folds 5 \
  --device cuda

# Output:
# ✓ Fold 1: Val Accuracy 62.3%, Loss 0.89
# ✓ Fold 2: Val Accuracy 63.1%, Loss 0.87
# ✓ Fold 3: Val Accuracy 61.8%, Loss 0.91
# ✓ Fold 4: Val Accuracy 64.2%, Loss 0.85
# ✓ Fold 5: Val Accuracy 63.4%, Loss 0.88
# ✓ Best model: Fold 5 (63.4%) → best_deeplob_fold5.pth
```

### Model Evaluation

```bash
# Evaluate on test set
python src/evaluate.py \
  --model checkpoints/best_deeplob_fold5.pth \
  --data data/test_data.csv \
  --device cuda

# Generate confusion matrix and metrics
python src/metrics.py \
  --predictions results/predictions.csv \
  --output results/confusion_matrix.png
```

### Model Deployment

```bash
# 1. Copy trained model to backend
cp checkpoints/best_deeplob_fold5.pth ../backend/models/
cp checkpoints/scaler_params.json ../backend/models/

# 2. Update inference service
# Edit backend/inference_service.py:
MODEL_PATH = "models/best_deeplob_fold5.pth"

# 3. Restart backend to load new model
cd ../backend
docker-compose restart backend
```

### Training Tips

1. **GPU Acceleration**: Training on RTX 4060 takes ~2 hours for 5 folds
2. **Data Requirements**: Minimum 100k snapshots for stable training
3. **Hyperparameter Tuning**: Use Optuna for automated search
4. **Ensemble Models**: Average predictions from top 3 folds for better accuracy

---

## 📑 Report Generation & Export

### Automatic Report Creation

Reports are automatically generated when:
- A trading session ends (user stops strategy)
- A session is reset
- Replay mode completes

### Report Contents

Each report includes:
- **Session Metadata**: ID, duration, timestamp
- **PnL Summary**: Realized, unrealized, total
- **Trade Log**: All entry/exit trades with timestamps
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio
- **Strategy Parameters**: Confidence thresholds, position sizing

### Accessing Reports via UI

1. Navigate to **Dashboard** → **Reports** tab
2. View list of all generated reports with metadata
3. Click **Download** button to get JSON or CSV format
4. Reports are stored in **AWS S3** with 90-day retention

### API Usage

```bash
# Get all reports
curl http://localhost:8000/reports

# Response:
{
  "reports": [
    {
      "filename": "session_model-test-abc123_2026-01-12_143052.json",
      "session_id": "model-test-abc123",
      "size_kb": 45.2,
      "timestamp": "2026-01-12T14:30:52Z",
      "s3_url": "https://tradinghub-report.s3.amazonaws.com/...",
      "metadata": {
        "total_pnl": 287.40,
        "win_rate": 59.6,
        "trade_count": 94,
        "duration_seconds": 3600
      }
    }
  ],
  "total_reports": 1
}

# Download specific report
curl -O http://localhost:8000/reports/download/session_model-test-abc123_2026-01-12_143052.json
```

### Report Format (JSON)

```json
{
  "session_id": "model-test-abc123",
  "start_time": "2026-01-12T10:00:00Z",
  "end_time": "2026-01-12T14:30:52Z",
  "duration_seconds": 16252,
  "pnl": {
    "realized": 287.40,
    "unrealized": 0.0,
    "total": 287.40,
    "final_position": 0.0
  },
  "statistics": {
    "total_trades": 94,
    "winning_trades": 56,
    "losing_trades": 38,
    "win_rate": 0.596,
    "profit_factor": 1.82,
    "sharpe_ratio": 1.82,
    "max_drawdown": 62.30
  },
  "trades": [
    {
      "id": 1,
      "timestamp": "2026-01-12T10:05:23Z",
      "side": "BUY",
      "price": 42350.00,
      "size": 1.0,
      "type": "ENTRY",
      "confidence": 0.67,
      "pnl": 0.0
    },
    {
      "id": 2,
      "timestamp": "2026-01-12T10:08:15Z",
      "side": "SELL",
      "price": 42450.00,
      "size": 1.0,
      "type": "EXIT",
      "pnl": 100.00
    }
  ]
}
```

### CSV Export

Reports are also available in CSV format for Excel/spreadsheet analysis:

```csv
id,timestamp,side,price,size,type,confidence,pnl
1,2026-01-12T10:05:23Z,BUY,42350.00,1.0,ENTRY,0.67,0.00
2,2026-01-12T10:08:15Z,SELL,42450.00,1.0,EXIT,,100.00
```

### S3 Storage Configuration

Reports are automatically uploaded to AWS S3:

```bash
# Environment variables (backend/.env)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=eu-north-1
S3_BUCKET_NAME=tradinghub-report
```

---

## �🚧 Future Roadmap

### Short-Term (1-3 months)
- [ ] Ensemble model (top 3 folds)
- [ ] Attention mechanism for price levels
- [ ] Multi-horizon predictions (1min, 5min, 15min)
- [ ] Dynamic position sizing
- [ ] Stop-loss and take-profit levels

### Medium-Term (3-6 months)
- [ ] Multi-asset support (ETH, SOL, etc.)
- [ ] Transformer-based architecture
- [ ] Reinforcement Learning optimization
- [ ] Alert system (SMS/Email/Telegram)
- [ ] Advanced backtesting framework

### Long-Term (6-12 months)
- [ ] Live trading integration (Binance API)
- [ ] Order execution engine
- [ ] Real-time risk controls
- [ ] Multi-region deployment
- [ ] Apache Kafka for distributed processing

---

## 📺 Project Demo
[![Watch the Video](https://img.shields.io/badge/Video-Watch%20Demo-red?style=for-the-badge&logo=youtube)](https://drive.google.com/file/d/1w-Y3YWwkHVpC5oJTMzkrEGAKoqAre6f8/view?usp=sharing)

---

## 🙏 Acknowledgments

- **Binance API**: Real-time market data
- **DeepLOB**: CNN architecture for LOB modeling
- **TimescaleDB**: High-performance time-series storage
- **FastAPI**: Modern async Python framework
- **React**: Powerful UI framework

---

## 📧 Contact & Support

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: See `/docs` directory

---

**Built with ❤️ for the HFT community**

**Status**: ✅ Production-Ready & Live on AWS | **Version**: 2.0 | **URL**: [trading-hub.live](https://trading-hub.live) | **Last Updated**: January 2026
