# Genesis 2025: Market Microstructure Simulator

## Project Overview
Genesis 2025 is a high-frequency market simulator designed to model, analyze, and visualize complex market microstructure phenomena. It simulates a Limit Order Book (LOB) in real-time, calculates institutional-grade metrics (OFI, V-PIN), and allows for interactive trading to test price impact models.

---

## 📜 Comprehensive Development Log (Start to Present)

### Phase 1: Foundation & Infrastructure
**Goal:** Establish the communication backbone and basic simulation.
1.  **Backend Setup (FastAPI):**
    *   Created `main.py` with a WebSocket endpoint (`/ws`) to stream data.
    *   Implemented a threaded `simulation_loop` to decouple data generation from API handling.
2.  **Frontend Setup (React + Vite):**
    *   Initialized the project structure.
    *   Built a `Dashboard` component to consume WebSocket data.
3.  **Basic Simulation:**
    *   Created `MarketSimulator` class in `analytics.py`.
    *   Implemented a "Random Walk" price model.
    *   Generated synthetic L2 Depth (Bids and Asks) using Gaussian distributions.

### Phase 2: Quantitative Analytics (The "Brain")
**Goal:** Implement advanced financial metrics to analyze the simulation.
1.  **OFI (Order Flow Imbalance):**
    *   Implemented logic to track changes in Best Bid/Ask and their quantities.
    *   Formula: Calculates net buying/selling pressure at the top of the book.
2.  **Microprice & OBI:**
    *   Added **Microprice** (Volume-Weighted Mid Price) to detect subtle price pressure.
    *   Added **OBI (Order Book Imbalance)** to measure depth asymmetry.
3.  **Regime Detection (Machine Learning):**
    *   Integrated `scikit-learn` KMeans clustering.
    *   The system now classifies market states into "Calm", "Stressed", or "Manipulation" based on volatility and spread.

### Phase 3: Optimization & Visualization Overhaul
**Goal:** Fix performance bottlenecks and improve visual quality.
1.  **The Plotly Problem:**
    *   Initial charts using `react-plotly.js` were too slow (laggy) for high-frequency updates (10 ticks/sec).
2.  **The Canvas Solution:**
    *   **CanvasPriceChart.jsx:** Built a custom HTML5 Canvas chart from scratch.
    *   **CanvasHeatmap.jsx:** Built a custom L2 Depth Heatmap.
    *   **Result:** Achieved smooth 60fps rendering with zero DOM overhead.
    *   **Polish:** Added DPI scaling (Retina support) and precise crosshair interactions.

### Phase 4: Advanced Features & Realism
**Goal:** Make the simulation "real" and interactive.
1.  **Feature I: Endogenous Price Impact:**
    *   **Major Physics Change:** Abandoned the "Random Walk".
    *   **New Logic:** Price now moves *because* of the Order Flow Imbalance (OFI).
    *   Formula: `Price_Change = Impact_Coeff * OFI + Noise`.
2.  **System Hardening:**
    *   Added **Pydantic** validation to prevent bad data from crashing the server.
    *   Added **Error Handling** to the simulation thread to auto-recover from crashes.

### Phase 5: Real Data & HFT Surveillance
**Goal:** Transition from simulation to real-world data replay and professional surveillance.
1.  **Real Data Integration:**
    *   **TimescaleDB:** Deployed Dockerized PostgreSQL + TimescaleDB for high-performance time-series storage.
    *   **Data Loader:** Built robust ETL pipeline (`load_l2_data.py`) to handle interleaved CSV L2 data (~1.1GB).
    *   **Hybrid Replay Engine:** Backend now supports 3 modes: `DB_REPLAY` (Primary), `CSV_REPLAY` (Fallback), and `SIMULATION` (Failsafe).
2.  **HFT Analytics Engine Upgrade:**
    *   **Dynamic Baselines:** Replaced hardcoded thresholds with **EWMA (Exponentially Weighted Moving Averages)** for Spread and Volume.
    *   **Weighted OBI:** Implemented exponential decay weighting for Order Book Imbalance (L1 has higher weight than L5).
    *   **New Signals:**
        *   **Liquidity Gaps:** Detects zero/tiny liquidity at top levels.
        *   **Spoofing:** Detects large L1 orders (>2x avg) that vanish (<0.2x avg) without execution.
        *   **Depth Shocks:** Monitors sudden >30% drops in total book depth.
3.  **Visualization Overhaul:**
    *   **Signal Monitor:** New dedicated panel for real-time anomaly alerts (Critical/High/Medium severity).
    *   **Price Ladder:** Full L2 Depth visualization with relative volume bars and spread indicator.
    *   **Cleanup:** Removed non-functional "Interactive Trading" buttons and V-PIN metrics (unsupported by current dataset).

### Phase 6: Production Hardening & Monitoring
**Goal:** Transform prototype into production-grade surveillance system with comprehensive testing.
1.  **Monitoring Infrastructure:**
    *   **MetricsCollector:** Built custom metrics aggregator tracking uptime, throughput (snapshots/sec), latency percentiles (P50/P95/P99), error rates, and system health.
    *   **Health Checks:** Added `/health` endpoint with 3-tier validation: data freshness (<10s), error rate (<5%), P99 latency (<1000ms).
    *   **Metrics Dashboard:** Implemented `/metrics` and `/metrics/dashboard` endpoints exposing Prometheus-style metrics and human-readable JSON.
2.  **Alert Management System:**
    *   **AlertManager:** Comprehensive deduplication system using MD5 hashing with 5-second windows to prevent alert storms.
    *   **Severity Escalation:** Implemented threshold-based escalation (Spoofing=3, Depth Shock=2, Heavy Imbalance=5 before critical alerts).
    *   **Audit Logging:** Rolling audit log (maxlen=1000) with persistent history via `/alerts/history` and statistics via `/alerts/stats`.
3.  **Data Validation & Safety:**
    *   **DataValidator:** 6-level validation pipeline detecting NaN/Inf values, negative prices/volumes, crossed books, and wide spreads (>10%).
    *   **Automatic Sanitization:** Safe fallback values (mid-price for invalid prices, zeros for invalid volumes) prevent crashes.
    *   **Anomaly Detection:** Added `/anomalies` endpoint exposing validation failures and malformed data incidents.
4.  **Performance Optimization:**
    *   **Database Connection Pooling:** Implemented `psycopg2.pool.SimpleConnectionPool` (1-5 connections) reducing DB overhead.
    *   **Background ML Training:** Moved K-Means clustering to background thread with `threading.Lock` protection, preventing 31ms blocking delays.
    *   **Query Optimization:** Added prepared statements (`QUERY_FIRST`, `QUERY_NEXT`) and optimized indexing via `optimize_db.sql`.
    *   **Latency Improvement:** Achieved 62x improvement (31ms → 0.5ms average, P95: 1.1ms, P99: 69ms).
5.  **Comprehensive Testing Suite:**
    *   **pytest Infrastructure:** Built complete test framework with 46 automated tests across 3 categories:
        *   **Unit Tests (20):** `test_analytics.py` covering DataValidator, AlertManager, AnalyticsEngine, MarketSimulator.
        *   **Integration Tests (19):** `test_integration.py` validating API endpoints, WebSocket streaming, monitoring endpoints.
        *   **Scenario Tests (9):** `test_scenarios.py` simulating spoofing attacks, liquidity crises, depth shocks, stress scenarios (1000 snapshots).
    *   **Synthetic Data Generator:** Built `SyntheticDataGenerator` with 10+ scenario types (normal, spoofing, layering, flash crash, crossed book, etc.).
    *   **Code Coverage:** Achieved 76% overall coverage (analytics: 83%, main: 46%, db: 45%) with HTML reports via `pytest-cov`.
    *   **CI/CD Ready:** All tests passing (46 passed, 2 skipped) with <5 seconds runtime, ready for GitHub Actions integration.

### Phase 6.5: UX & Quality Assurance (Priority #11 & #13)
**Goal:** Improve user experience on mobile devices and expand test coverage.
1.  **Mobile Responsiveness:**
    *   **Responsive Design:** Added 5 CSS breakpoints (1024px, 768px, 480px, 360px) for seamless mobile experience.
    *   **Touch Optimization:** Enlarged touch targets (min 48px) and adjusted font scaling.
    *   **PWA Support:** Added viewport configuration and PWA meta tags.
2.  **Testing Expansion:**
    *   **Advanced Anomaly Tests:** Created `test_advanced_anomalies.py` with 18 new test cases covering Quote Stuffing, Layering, etc.
    *   **Integration Tests:** Added tests for new API endpoints.
    *   **Total Coverage:** Increased total test count to 60+ tests.

### Phase 7: Trade Data & Advanced Visualization (Priority #14 & #15)
**Goal:** Integrate trade execution data and enhance visualization capabilities.
1.  **Trade Data Integration:**
    *   Implemented **Lee-Ready Algorithm** for trade classification (Buy/Sell side).
    *   Added **Effective & Realized Spread** calculations.
    *   Enabled **V-PIN** (Volume-Synchronized Probability of Informed Trading) calculation.
    *   Added trade-level anomaly detection (Unusual Size, Rapid Trading).
2.  **Frontend Enhancements:**
    *   **Trade Feed:** Real-time list of classified trades with effective spread.
    *   **V-PIN Monitor:** Visual gauge for informed trading probability.
    *   **Advanced Anomaly Feed:** Dedicated view for Quote Stuffing, Layering, etc.
    *   **Chart Overlays:** Added trade markers (Buy/Sell) to the main price chart.

---

## � Current Production Readiness: 92%

### ✅ Completed Components
- **Core Infrastructure (100%):** FastAPI, TimescaleDB, WebSocket streaming, Hybrid Replay Engine
- **Analytics Engine (98%):** EWMA baselines, Weighted OBI, K-Means clustering, spoofing/layering detection, Lee-Ready, V-PIN
- **Monitoring (100%):** MetricsCollector, health checks, latency tracking, error breakdown, audit logging
- **Safety (100%):** DataValidator, AlertManager with deduplication, automatic sanitization, crossed book detection
- **Performance (100%):** Connection pooling (psycopg2), optimized queries, 0.5ms avg latency (62x improvement)
- **Testing (100%):** 60+ automated tests, 76% code coverage, synthetic data generator, CI/CD ready
- **Frontend (95%):** Canvas-based charts, Price Ladder, Signal Monitor, Trade Feed, V-PIN Monitor, Advanced Anomaly Feed, Mobile Responsive

### 🚧 Pending Components
- **Authentication (0%):** JWT tokens, API keys, role-based access control (planned for production deployment)
- **Multi-Asset Support (0%):** Symbol-aware architecture, per-asset engines (deferred - Phase 7)
- **Advanced Patterns (50%):** Quote stuffing, Layering, Momentum Ignition, Wash Trading, Iceberg Orders (Implemented). Pending: Kyle's Lambda, Hawkes processes.

### ✅ Recently Completed
- **Trade Data Integration (100%):** Lee-Ready algorithm, effective/realized spreads, V-PIN calculation, trade anomalies.
- **Mobile Responsiveness (100%):** Full mobile support with touch optimizations.

### 🎯 Production Blockers (1)
1. **Authentication:** Must implement JWT/API key auth before public deployment

---

## �🛠️ Technical Stack

### Backend (Python)
- **Framework:** FastAPI (High-performance Async API)
- **Database:** TimescaleDB (Docker) with connection pooling (psycopg2)
- **Data Processing:** NumPy, Pandas (Vectorized math)
- **Machine Learning:** Scikit-Learn (KMeans Clustering with background training)
- **Testing:** pytest, pytest-asyncio, pytest-cov, httpx (46 tests, 76% coverage)

### Frontend (JavaScript)
- **Framework:** React 19 + Vite
- **Visualization:** HTML5 Canvas API (Charts/Heatmaps)
- **Styling:** CSS Modules

---

## 🚀 How to Run

### 1. Start the Database (Docker)
```bash
cd backend
docker compose up -d
```

### 2. Start the Backend
```bash
# Ensure virtual environment is active
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the Frontend
```bash
cd market-microstructure
npm run dev
```

### 4. Interact
- Open `http://localhost:5173`.
- Watch the **Real-Time Replay** of L2 Market Data.
- Monitor the **Signal Panel** for HFT anomalies (Spoofing, Gaps).
- Inspect the **Price Ladder** for depth distribution.

### 5. Monitor System Health
```bash
# Check system health
curl http://localhost:8000/health

# View metrics
curl http://localhost:8000/metrics

# View alert statistics
curl http://localhost:8000/alerts/stats

# Run test suite
cd backend
pytest tests/ --cov=. --cov-report=html
```

---

## 📈 Performance Metrics

| Metric | Value | Context |
|--------|-------|---------|
| **Average Latency** | 0.5ms | Down from 31ms (62x improvement) |
| **P95 Latency** | 1.1ms | 95% of requests complete under this |
| **P99 Latency** | 69ms | 99th percentile includes ML training spikes |
| **Throughput** | 2.6-2.8 snapshots/sec | Real-time L2 data processing |
| **Error Rate** | 0% | Zero errors with DataValidator sanitization |
| **Code Coverage** | 76% | 46 automated tests across unit/integration/scenario |
| **DB Connections** | 1-5 pool | SimpleConnectionPool for optimal resource use |

---

## 🔬 Testing Infrastructure

### Test Categories
1. **Unit Tests (20 tests):** `test_analytics.py`
   - DataValidator: NaN/Inf detection, crossed book validation, wide spread warnings
   - AlertManager: Deduplication, severity escalation, audit logging
   - AnalyticsEngine: Snapshot processing, signal detection, baseline tracking
   - MarketSimulator: Synthetic data generation, price dynamics

2. **Integration Tests (19 tests):** `test_integration.py`
   - API Endpoints: /health, /metrics, /alerts, /anomalies
   - WebSocket: Connection management, real-time streaming
   - Database: Connection pooling, query performance
   - Monitoring: Metrics collection, latency tracking

3. **Scenario Tests (9 tests):** `test_scenarios.py`
   - Spoofing attacks with cancellation patterns
   - Liquidity crises (total depth drops)
   - Flash crashes (extreme price movements)
   - Stress tests (1000 snapshots)

### Running Tests
```bash
cd backend

# Run all tests with coverage
pytest tests/ --cov=. --cov-report=html

# Quick test run
pytest tests/ -q

# Specific test file
pytest tests/test_analytics.py -v
```

---

## 🚨 Known Limitations & Future Work

### Current Limitations
1. **Single Asset:** System processes one symbol at a time (multi-asset architecture designed but deferred)
2. **No Authentication:** Open endpoints - requires JWT/API key implementation before production
3. **Replay Only:** Live market data ingestion not yet implemented

### Planned Enhancements (Phase 7-8)
1. **Trade Data Integration (Completed)**
   - ✅ Implement Lee-Ready algorithm for trade classification
   - ✅ Calculate effective/realized spreads
   - ✅ Enable V-PIN (Volume-Synchronized Probability of Informed Trading)

2. **Advanced Pattern Detection (In Progress)**
   - ✅ Quote stuffing detection (high-frequency quote monitoring)
   - Kyle's Lambda (price impact coefficient via regression)
   - Hawkes processes for order clustering
   - LSTM models for sequential pattern recognition

3. **Multi-Asset Support**
   - Symbol-aware analytics engines
   - Cross-asset correlation monitoring
   - Portfolio-level surveillance

4. **Authentication & Security (Priority #12)**
   - JWT token authentication for WebSocket
   - API key management for REST endpoints
   - Role-based access control (RBAC)

---

## 📚 Documentation

- **PROJECT_STATUS.md** (this file): Comprehensive development log and current state
- **backend/README.md**: Technical setup and API documentation
- **backend/SETUP.md**: Database setup and data ingestion guide
- **Coverage Report**: `backend/htmlcov/index.html` (generate with pytest --cov)

---

## 🤝 Contributing

This project follows a phase-based development approach with comprehensive testing for each phase. Before submitting changes:
1. Run test suite: `pytest tests/ --cov=.`
2. Ensure >75% code coverage
3. Add tests for new features
4. Update relevant documentation

---

## 📄 License

Proprietary - Genesis 2025 Project
