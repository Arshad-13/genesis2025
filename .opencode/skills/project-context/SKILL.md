# Project Context Skill — Genesis 2025

You are working on **Genesis 2025**, a production-grade HFT market surveillance platform for cryptocurrency markets.

## Architecture (Memorize This)

```
Binance WS → Market Ingestor (gRPC:6000) → live_grpc_loop
    → Session Queues → SnapshotProcessor → [C++ Engine (50051) | Python Engine]
    → Processed Queue → ConnectionManager (WS) → React Frontend (:5173)
    → PostgreSQL + TimescaleDB (5433)
```

## Key Files

| File | Purpose | Lines |
|---|---|---|
| `backend/main.py` | FastAPI app, session workers, data flow, endpoints | 1861 |
| `backend/analytics_core.py` | Python engine: 40+ features, 7 anomaly detectors, regime classification | 1519 |
| `backend/snapshot_processor.py` | C++/Python failover orchestrator | 101 |
| `backend/session_replay.py` | SessionManager + UserSession lifecycle | 168 |
| `backend/strategy_service.py` | Paper trading engine (entry/exit logic) | 157 |
| `backend/session_strategy.py` | Per-session strategy instances | 40 |
| `backend/inference_service.py` | DeepLOB model inference with per-session buffers | 224 |
| `backend/db.py` | asyncpg connection pool with retry logic | 199 |
| `backend/utils/security.py` | JWT auth (bcrypt + jose) | 64 |
| `backend/routers/auth.py` | Auth endpoints (login/register/me) | 121 |
| `backend/csv_service.py` | CSV report generation | - |
| `market_ingestor/main.py` | gRPC server, Binance WebSocket client | 150 |
| `market_ingestor/binance_depth.py` | Binance depth stream handler | - |
| `cpp_engine/src/analytics_engine.cpp` | C++ engine: OFI, OBI, microprice, regime, anomalies | 312 |
| `cpp_engine/src/server.cpp` | C++ gRPC server | - |
| `model_building/src/model.py` | DeepLOB CNN architecture | 106 |
| `model_building/src/train.py` | Training with Focal Loss | - |
| `model_building/src/data_loader.py` | DataHandler, LOBDataset | - |
| `market-microstructure/src/pages/Dashboard.jsx` | Main monitoring dashboard | 407 |
| `market-microstructure/src/contexts/AuthContext.jsx` | Auth state management | 150 |

## Key Abstractions

- **AnalyticsEngine** (`analytics_core.py:525`): God node — 69 graph edges. Calculates OFI, OBI, microprice, VPIN, spread, regime. Contains AlertManager, TradeClassifier, DataValidator, MarketSimulator. Detects 7 anomaly types.
- **SnapshotProcessor** (`snapshot_processor.py:12`): Tries C++ → falls back to Python after 5 failures.
- **StrategyEngine** (`strategy_service.py:7`): Paper trading. Entry on prediction confidence > 0.15. Exit on opposite signal.
- **ModelInference** (`inference_service.py:20`): DeepLOB CNN. Maintains per-session deque(100) rolling buffer. Batch inference across sessions.
- **SessionManager/UserSession** (`session_replay.py`): Multi-user isolation. Each session has own queues, async worker, broadcast loop. Async lock-protected.
- **ConnectionManager** (`main.py:375`): Per-session WebSocket mapping. Broadcasts snapshots, trade events.
- **AlertManager** (`analytics_core.py:326`): MD5 hash dedup, severity escalation, audit log.
- **AdaptiveProcessor** (`main.py:314`): Dynamic load shedding when processing > 100ms avg.

## Data Flow (LIVE Mode)

1. Binance WebSocket → `BinanceDepthClient` → SmartQueue (unlimited)
2. gRPC `StreamSnapshots` → `live_grpc_loop` → `raw_snapshot_queue`
3. `live_data_dispatcher` fans out to all active `UserSession.raw_snapshot_queue`
4. `session_analytics_worker_async` pulls → `SnapshotProcessor.process()` (C++/Python)
5. Model prediction via `inference_engine.predict()` (100-snapshot rolling window)
6. Strategy evaluation via `strategy.process_signal()`
7. Result pushed to `session.processed_snapshot_queue`
8. `session_broadcast_loop` sends via WebSocket to frontend

## Data Flow (REPLAY Mode)

1. `session_replay_loop` queries `l2_orderbook` hypertable in batches of 500
2. Each row → `db_row_to_snapshot()` → `session.raw_snapshot_queue`
3. Rest same as LIVE from step 4

## Database

- **PostgreSQL 14 + TimescaleDB 2.7**
- Hypertable: `l2_orderbook(ts, symbol)` — 8:1 compression, 7-day compression policy, 90-day retention
- Pool: asyncpg, min=2, max=10, exponential backoff retry
- `session_reports` table stores report metadata with S3 URLs

## 40+ Microstructure Features

OFI, OBI (multi-level weighted), Microprice, Divergence, VPIN, Effective/Realized Spread, Regime (Calm/Stressed/Execution Hot/Manipulation Suspected), Spread Z-score, Volatility, Directional Probability

## 7 Anomaly Types

Quote Stuffing, Layering, Spoofing, Momentum Ignition, Wash Trading, Iceberg Orders, Liquidity Gaps

## Known Critical Issues

See `.agents/issues/001_critical_flaws_initial_audit.md` — 10 issues including:
1. SECRET_KEY placeholder (auth broken)
2. No auth on 90% of endpoints
3. data_buffer race condition
4. localStorage token (XSS)
5. CORS wildcard

## When Making Changes

- **Backend**: Check `data_buffer` concurrent access. Use `asyncio.Lock`. Test with multiple sessions.
- **Frontend**: Never store tokens in localStorage. Use httpOnly cookies. Validate all anomaly messages before rendering.
- **Database**: Always use connection pool (never raw connections). Check `get_connection()` → `return_connection()` pairing.
- **C++ Engine**: Validate input before processing. Return default values on bad data (never crash). Keep in sync with Python engine's feature set.
- **Config**: Never commit `.env`. Use `.env.example` with placeholders only.

## Project Graph

Query the knowledge graph at any time:
- `graphify query "question"` — for codebase questions
- `graphify path "A" "B"` — for relationships
- `graphify explain "concept"` — for focused concepts
- `graphify-out/GRAPH_REPORT.md` — full architecture report
- `graphify-out/graph.html` — interactive visualization
