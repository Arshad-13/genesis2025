# Backend Python Skill — FastAPI / Analytics / gRPC

You are working on a **FastAPI** backend for a high-frequency trading platform. Follow these conventions and rules.

## Tech Stack
- **Python 3.11**, **FastAPI** (async), **gRPC** (protobuf), **asyncpg** (PostgreSQL)
- **PyTorch 2.0** for ML inference, **NumPy/Pandas** for data processing
- **SlowAPI** for rate limiting, **bcrypt + python-jose** for auth

## Code Conventions
- Async everywhere: use `async def` for I/O-bound endpoints, `asyncio.create_task()` for background workers
- Database: always use `asyncpg` pool via `get_connection()` / `return_connection()`, never raw connections
- Error handling: catch exceptions at worker boundaries, use `metrics.record_error()` for visibility
- Logging: use the `logger` instance from `logging.getLogger(__name__)`, not `print()`
- Configuration: read from `os.getenv()` with sensible defaults. Never hardcode secrets
- Type hints: use `dict[str, Any]`, `list[dict]`, `Optional[str]` consistently

## When Adding Endpoints
1. Add authentication via `Depends(get_current_user)` unless it's a public endpoint
2. Use Pydantic models for request bodies (in `backend/schemas/`)
3. Return JSON-serializable dicts
4. Add error responses with proper HTTP status codes
5. Include rate limiting considerations

## When Modifying Analytics
1. Check both C++ and Python engines produce same feature set
2. The Python `AnalyticsEngine.process_snapshot()` is the reference implementation
3. Anomalies must include: `type`, `severity`, `message` at minimum
4. Trade data integration requires Lee-Ready classification first
5. Test with synthetic data from `backend/tests/synthetic_data.py`

## When Working with Sessions
1. `SessionManager._lock` must be held when iterating sessions
2. Each `UserSession` owns its queues — never share queues between sessions
3. `session._running` flag controls worker lifecycle
4. Clean up resources on session delete: model buffers, strategy instances, connections

## Performance Rules
1. Avoid `await` in hot paths where possible
2. Use `queue.get_nowait()` with `asyncio.sleep(0.01)` instead of blocking gets
3. Batch model inference when multiple sessions need predictions
4. Use the `AdaptiveProcessor` for load shedding under high throughput
5. sqlalchemy ORM for auth, asyncpg direct for time-series data

## Security Rules
1. Never commit `.env` or secrets
2. Validate all user input at the API boundary
3. JWT `sub` field must be validated before casting to int
4. Use `secrets.token_hex(32)` for generating keys
5. Path parameter types must be validated with constraints (ge, le, etc.)

## File Map
| File | When to Edit |
|---|---|
| `main.py` | Endpoints, WebSocket, lifecycle, data flow |
| `analytics_core.py` | Feature calculation, anomaly detection, regime classification |
| `snapshot_processor.py` | Engine failover logic |
| `session_replay.py` | Session lifecycle management |
| `inference_service.py` | Model loading, prediction, buffer management |
| `strategy_service.py` | Trade entry/exit logic, PnL tracking |
| `session_strategy.py` | Per-session strategy instances |
| `db.py` | Connection pool, acquisition/release metrics |
| `csv_service.py` | CSV report generation |
| `routers/auth.py` | Authentication endpoints |
| `utils/security.py` | Password hashing, JWT creation |
| `utils/data.py` | Data sanitization |
| `analytics/analytics_client.py` | C++ engine gRPC client |
