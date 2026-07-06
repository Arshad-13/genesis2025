# Critical Flaws — Initial Security & Stability Audit

**Audit Date**: 2026-07-04  
**Scope**: Full codebase (backend, frontend, infrastructure)  
**Methodology**: Static analysis via knowledge graph traversal + direct code review  
**Total Issues**: 10 (4 Critical, 4 High, 2 Medium)

---

## Issue #1 — SECRET_KEY is Placeholder or None (JWT Completely Broken)

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Critical** |
| **Category** | Security / Authentication |
| **Files** | `backend/utils/security.py:11`, `backend/.env:14`, `backend/.env.example:8` |
| **CWE** | CWE-798 (Hardcoded Credentials), CWE-259 (Hardcoded Password) |

### Root Cause

`security.py` reads `SECRET_KEY` from environment at module load time:

```python
# backend/utils/security.py:11
SECRET_KEY = os.getenv("SECRET_KEY")
```

The `.env` file (committed to git) contains:
```
SECRET_KEY=your-super-secret-key-change-this-in-production-min-32-chars-long
```

Two failure modes exist:
1. **`SECRET_KEY` is `None`**: If `.env` is not loaded (production deployment, different working directory, Docker without proper env injection), `jwt.encode(data, None, algorithm="HS256")` raises `TypeError: secret must be a string`, crashing **every** auth endpoint (`/auth/login`, `/auth/register`, `/auth/me`).

2. **`SECRET_KEY` is the placeholder**: The JWT is signed with a known string. Anyone who has ever read this repo (including through a public fork, leaked dependency, or CI log) can forge valid JWTs for any user. They can call `/auth/me` as any user_id.

### Impact

- Complete authentication bypass when secret is known
- Application crash when secret is `None`
- All JWTs issued with the placeholder key are cryptographically worthless
- The `.env` file is **committed to git** — the secret is permanently in git history

### Reproduction

```bash
# When SECRET_KEY is None:
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
# Result: 500 Internal Server Error (TypeError: secret must be a string)

# When SECRET_KEY is the placeholder:
# Anyone can forge tokens:
python3 -c "
from jose import jwt
token = jwt.encode({'sub': '1', 'email': 'admin@admin.com'}, 'your-super-secret-key-change-this-in-production-min-32-chars-long', algorithm='HS256')
print(token)
"
# Use this token: curl http://localhost:8000/auth/me -H "Authorization: Bearer $TOKEN"
# Result: 200 OK with user data
```

### Fix

```python
# backend/utils/security.py — replace lines 11-13 with:

import secrets

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Fail fast on insecure configuration
_PLACEHOLDER_PREFIXES = ("your-super-secret", "change-me", "changeme", "replace-me")
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set. "
        "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )
if any(SECRET_KEY.lower().startswith(p) for p in _PLACEHOLDER_PREFIXES):
    raise ValueError(
        "SECRET_KEY is a placeholder value. Generate a real key with: "
        "python -c 'import secrets; print(secrets.token_hex(32))'"
    )
if len(SECRET_KEY) < 32:
    raise ValueError("SECRET_KEY must be at least 32 characters long")
```

**Also required**:
- Remove `.env` from git tracking: `git rm --cached backend/.env` and add to `.gitignore`
- Generate a real key: `python -c "import secrets; print(secrets.token_hex(32))"`
- Set it via environment variable in production (AWS Parameter Store / Secrets Manager)

### Verification

```bash
# After fix, should fail fast on startup:
export SECRET_KEY=""
python backend/main.py  # Should raise ValueError immediately

# With valid key:
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python backend/main.py  # Should start normally
```

---

## Issue #2 — No Authentication on 90% of Endpoints

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Critical** |
| **Category** | Security / Access Control |
| **Files** | `backend/main.py` (all endpoint handlers except `/auth/*`) |
| **CWE** | CWE-306 (Missing Authentication for Critical Function) |

### Root Cause

Only `/auth/me` uses `Depends(oauth2_scheme)` to enforce authentication. Every other endpoint — including replay control, strategy execution, session management, mode switching, and data retrieval — has **no authentication dependency**.

Unauthenticated endpoints listing:
- `POST /mode` — switch LIVE/REPLAY, crash the system
- `POST /strategy/*/start|stop|reset` — control paper trading
- `POST /replay/*/start|pause|resume|stop|speed|goback` — disrupt replay
- `GET /sessions` — enumerate all active sessions
- `DELETE /sessions/{id}` — kill any user's session
- `GET /features`, `/anomalies/*`, `/alerts/*`, `/snapshot/*` — read all data
- `GET /metrics`, `/metrics/dashboard`, `/health` — system internals
- `GET /reports`, `/reports/download/{file}` — download reports
- `GET /engine/*` — control analytics engine
- `POST /db/benchmark` — trigger database benchmarks

### Impact

An unauthenticated attacker can:
1. Enumerate all sessions → learn who is using the platform
2. Delete anyone's session → denial of service
3. Start/stop trading strategies → manipulate simulated PnL
4. Read all anomaly and market data → information disclosure
5. Switch system modes → disrupt operation
6. Download trading reports → steal trading data

### Fix

Apply authentication middleware globally or create an authenticated router prefix:

```python
# Option A: Global dependency (recommended)
from routers.auth import get_current_user

# Add to all protected routers:
protected_router = APIRouter(dependencies=[Depends(get_current_user)])

# Move all endpoints to protected_router:
@protected_router.post("/mode")
async def set_mode(payload: dict, current_user = Depends(get_current_user)):
    ...

# Option B: Middleware approach
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/auth/"):
        return await call_next(request)
    # Validate token for all other paths
    ...
```

Public endpoints that should remain unauthenticated:
- `POST /auth/register`
- `POST /auth/login`
- `GET /health`

### Verification

```bash
# Before fix - succeeds without auth:
curl http://localhost:8000/sessions
# Returns session data

# After fix - should reject:
curl http://localhost:8000/sessions
# Returns 401 Unauthorized

# With valid token:
curl http://localhost:8000/sessions -H "Authorization: Bearer $TOKEN"
# Returns session data
```

---

## Issue #3 — Race Condition on `data_buffer` (Concurrent List Corruption)

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Critical** |
| **Category** | Stability / Concurrency |
| **Files** | `backend/main.py:297,472,738-740,757-763,851-853` |

### Root Cause

`data_buffer` is a bare Python `list` accessed simultaneously by **5 async coroutines** and **synchronous HTTP handlers** with no locking:

| Writer/Reader | Lines | Operation | Context |
|---|---|---|---|
| `session_analytics_worker_async` | 472 | `data_buffer.append(processed)` | Async loop |
| `live_data_dispatcher` | 851-853 | `data_buffer.pop(0)` + `.append()` | Async loop |
| `processed_broadcast_loop` | 757-763 | `data_buffer.pop(0)` + `.append()` | Async loop |
| `broadcast_loop` | 738-740 | `data_buffer.pop(0)` + `.append()` | Async loop |
| HTTP `GET /features` | 1339-1340 | `return data_buffer` | Sync handler |
| HTTP `GET /anomalies` | 1342-1355 | `for snap in data_buffer` | Sync handler |
| HTTP `GET /snapshot/latest` | 1535-1539 | `data_buffer[-1]` | Sync handler |
| All anomaly sub-endpoints | various | Iterate `data_buffer` | Sync handler |

Python `list` operations in `asyncio` are **not thread-safe** and can interleave during `await` points (like `asyncio.sleep(0.01)` in the workers). This causes:

- `.pop(0)` removing the wrong element during concurrent access
- IndexError on `data_buffer[-1]` when list is modified mid-read
- Items silently lost when two workers pop simultaneously
- Memory corruption from overlapping `append` operations

### Impact

- **Silent data loss**: Snapshots vanish between processing and broadcast
- **API returning stale/corrupt data**: Frontend shows inconsistent state
- **`IndexError` crashes** in anomaly endpoints when buffer is popped during iteration
- **Hard to debug**: Non-deterministic, load-dependent, no error logs for data consistency

### Fix

Replace `data_buffer` with an `asyncio.Lock`-protected structure:

```python
# backend/main.py — replace line 297

import asyncio

class SafeDataBuffer:
    """Thread-safe rolling buffer for snapshot data."""
    def __init__(self, max_size: int = 1000):
        self._buffer: list[dict] = []
        self._lock = asyncio.Lock()
        self.max_size = max_size

    async def append(self, item: dict):
        async with self._lock:
            self._buffer.append(item)
            if len(self._buffer) > self.max_size:
                self._buffer.pop(0)

    async def get_all(self) -> list[dict]:
        async with self._lock:
            return list(self._buffer)

    async def get_latest(self) -> dict | None:
        async with self._lock:
            return self._buffer[-1] if self._buffer else None

    async def get_snapshot(self) -> list[dict]:
        async with self._lock:
            return list(self._buffer)

data_buffer = SafeDataBuffer(max_size=1000)
```

Then update all consumers to `await data_buffer.append(processed)`, `await data_buffer.get_all()`, etc.

### Verification

```bash
# Stress test with concurrent reads/writes:
python -c "
import asyncio
# Simulate 100 concurrent readers + 10 writers
# Should complete without IndexError or KeyError
"
```

---

## Issue #4 — Auth Token in localStorage (XSS Theft)

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Critical** |
| **Category** | Security / Client-Side |
| **Files** | `market-microstructure/src/contexts/AuthContext.jsx:13,60,97,126` |

### Root Cause

JWT tokens are stored in `localStorage`, which is accessible to any JavaScript running on the same origin. If an XSS vulnerability exists anywhere in the application (e.g., anomaly messages rendered without escaping, CSV data injected into the DOM), the token is immediately exfiltratable:

```javascript
// AuthContext.jsx:60 — line 60
localStorage.setItem('auth_token', data.access_token);

// AuthContext.jsx:126 — line 126
const getToken = () => localStorage.getItem('auth_token');
```

Additionally, the token is sent manually via headers in each fetch call:
```javascript
// Dashboard.jsx:140 (and many other places)
headers: { "Authorization": `Bearer ${localStorage.getItem('auth_token')}` }
```

### Impact

1. Any XSS → instant token theft → full account takeover
2. Tokens persist across browser sessions (no auto-expiry handling client-side)
3. Code injection via untrusted data rendered in:
   - `Toast` component messages (could contain script)
   - `anomalies[*].message` fields displayed in SignalMonitor
   - CSV report data displayed in Reports page

### Fix

**Backend** — Use httpOnly cookies:
```python
# backend/routers/auth.py — modify login/register responses

from fastapi.responses import JSONResponse

@router.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    ...
    access_token = create_access_token(data={"sub": str(user.id)})
    
    response = JSONResponse(content={
        "user": UserResponse(...).model_dump()
    })
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,         # HTTPS only
        samesite="strict",   # Prevent CSRF
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )
    return response

# Add logout endpoint that clears cookie:
@router.post("/logout")
async def logout():
    response = JSONResponse(content={"status": "logged_out"})
    response.delete_cookie("access_token")
    return response
```

**Frontend** — Remove all token handling:
```javascript
// AuthContext.jsx — remove localStorage token storage
// fetch() calls will automatically include cookies with credentials: 'include'
const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',  // Send/recieve cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
});
```

### Verification

```bash
# 1. Login — check Set-Cookie header
curl -v -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
# Should return: Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict

# 2. Check localStorage is empty after login
# DevTools → Application → Local Storage → No auth_token entry

# 3. Subsequent API calls should not need manual Authorization header
```

---

## Issue #5 — CORS `allow_origins=["*"]` with Credential-Based Auth

| Attribute | Detail |
|-----------|--------|
| **Severity** | **High** |
| **Category** | Security / Cross-Origin |
| **Files** | `backend/main.py:221-227` |
| **CWE** | CWE-942 (Permissive Cross-domain Policy) |

### Root Cause

```python
# backend/main.py:221-227
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Any origin can make requests
    allow_credentials=True,        # Cookies/auth headers allowed
    allow_methods=["*"],           # Any HTTP method
    allow_headers=["*"],           # Any header
)
```

Note: `allow_credentials=True` with `allow_origins=["*"]` is **invalid per the CORS spec** — browsers will reject it. However, the backend accepts the request, and tools like `curl` or malicious server-side scripts can still exploit it.

### Impact

Any malicious website can make authenticated requests to the backend if the user is logged in (cookie-based auth) or if tokens are in a way accessible from cross-origin contexts. Combined with Issue #2 (no auth), any origin can control the entire system.

### Fix

```python
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Verification

```bash
# Test with wrong origin:
curl -X POST http://localhost:8000/mode \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"mode":"LIVE"}'
# Should return CORS error / missing Access-Control-Allow-Origin header
```

---

## Issue #6 — Session Manager Race Condition

| Attribute | Detail |
|-----------|--------|
| **Severity** | **High** |
| **Category** | Stability / Concurrency |
| **Files** | `backend/main.py:840-841`, `backend/session_replay.py:120-143` |

### Root Cause

The `live_data_dispatcher` function iterates over sessions without holding `SessionManager._lock`:

```python
# backend/main.py:840
current_sessions = list(session_manager.sessions.values())  # Takes snapshot

for session in current_sessions:
    if session.is_active():
        session.raw_snapshot_queue.put_nowait(snapshot)
```

Meanwhile, `create_session()` and `delete_session()` in `session_replay.py` hold the lock but modify the **same underlying dict** the dispatcher's list references point to. Converting to `list()` creates a snapshot of keys, but not of the dict structure itself. During iteration, if a session is deleted:

1. The dispatcher holds a reference to a `UserSession` object that has already been `shutdown()`
2. `session.is_active()` returns `False` (safe), but `session.raw_snapshot_queue` no longer accepts items (potentially raising)

More critically, `cleanup_inactive_sessions()` (`session_replay.py:145`) deletes sessions during iteration:
```python
async with self._lock:
    inactive = [sid for sid, session in self.sessions.items() if not session.is_active()]
    for sid in inactive:
        del self.sessions[sid]  # Modifying the dict
```

### Impact

- `AttributeError` from accessing a `shutdown()` session's queue
- Lost snapshots when sessions are deleted mid-dispatch
- `RuntimeError: dictionary changed size during iteration` in rare cases

### Fix

```python
# backend/main.py:840 — in live_data_dispatcher
async def live_data_dispatcher():
    while True:
        try:
            snapshot = raw_snapshot_queue.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.005)
            continue

        # Hold the lock during snapshot dispatch
        async with session_manager._lock:
            for session in session_manager.sessions.values():
                if session.is_active():
                    try:
                        session.raw_snapshot_queue.put_nowait(snapshot)
                    except (queue.Full, AttributeError):
                        pass  # Session was shutdown between check and put
```

### Verification

```bash
# Stress test: create/destroy sessions rapidly while LIVE data flows
# Run 10 concurrent script instances creating and deleting sessions
# Monitor for AttributeError or RuntimeError in logs
```

---

## Issue #7 — Memory Leak from Conflicting Buffer Size Limits

| Attribute | Detail |
|-----------|--------|
| **Severity** | **High** |
| **Category** | Performance / Resource |
| **Files** | `backend/main.py:48,297,300,472,739,762,851-853` |

### Root Cause

Three different buffer size limits coexist, and one path has **no limit at all**:

| Constant | Value | Used By |
|---|---|---|
| `MAX_BUFFER` | 100 (hardcoded) | `broadcast_loop:739` |
| `MAX_BUFFER_SIZE` | 100 (from env) | `processed_broadcast_loop:762` |
| *None* | *Unlimited* | `session_analytics_worker_async:472` |
| Both | Skipped sometimes | `live_data_dispatcher:851-853` (trims but misses if buffer small) |

The `session_analytics_worker_async` function at line 472 unconditionally appends to `data_buffer`:
```python
# backend/main.py:472
data_buffer.append(processed)  # NO SIZE CHECK
```

At 160+ snapshots/second with multiple sessions, this grows unboundedly. Each snapshot dict is ~2-5KB with bids/asks/predictions/strategy data, so after 1 hour: `160 * 3600 * 3KB = ~1.7GB`.

### Impact

- OOM crash under sustained LIVE mode with multiple sessions
- Memory pressure degrading GC performance
- The `data_buffer` race condition (Issue #3) makes this worse — trimming might miss due to race

### Fix

```python
# backend/main.py:472 — in session_analytics_worker_async

# Add trim after append:
await data_buffer.append(processed)
# SafeDataBuffer.append() already handles truncation internally
```

This is automatically fixed by implementing the `SafeDataBuffer` class from Issue #3.

### Verification

```bash
# Run LIVE mode for 30 minutes, monitor memory:
watch -n 5 "ps aux | grep python | grep main.py | awk '{print \$6}'"
# Memory should stabilize, not grow linearly
```

---

## Issue #8 — `int(user_id)` Crash on Malformed JWT Tokens

| Attribute | Detail |
|-----------|--------|
| **Severity** | **High** |
| **Category** | Stability / Error Handling |
| **Files** | `backend/routers/auth.py:107` |
| **CWE** | CWE-754 (Improper Check for Unusual or Exceptional Conditions) |

### Root Cause

```python
# backend/routers/auth.py:106-107
user_id = payload.get("sub")
user = db.query(User).filter(User.id == int(user_id)).first()
```

If a JWT token is crafted with `sub: "not_a_number"`, `int(user_id)` raises `ValueError` → unhandled 500 Internal Server Error. A malicious actor can force 500 errors on `/auth/me` by sending a specially crafted token.

### Impact

- 500 errors logged, potentially triggering monitoring alerts
- No proper 401 response for invalid tokens with non-numeric sub
- Information leakage via Python traceback if debug mode is enabled

### Fix

```python
# backend/routers/auth.py:106-108

user_id = payload.get("sub")
if user_id is None:
    raise HTTPException(status_code=401, detail="Invalid authentication credentials")

try:
    user_id_int = int(user_id)
except (ValueError, TypeError):
    raise HTTPException(status_code=401, detail="Invalid token payload")

user = db.query(User).filter(User.id == user_id_int).first()
```

### Verification

```bash
# Create a token with non-numeric sub:
python3 -c "
from jose import jwt
import os
# (Use actual secret key)
token = jwt.encode({'sub': 'not_a_number', 'exp': 9999999999}, 'your-secret', algorithm='HS256')
print(token)
"

# Call /auth/me with this token:
curl http://localhost:8000/auth/me -H "Authorization: Bearer <token>"
# Should return 401, not 500
```

---

## Issue #9 — Anomaly Key Injection via Unvalidated Dict Keys

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Medium** |
| **Category** | Security / Data Integrity |
| **Files** | `backend/main.py:1353` |
| **CWE** | CWE-20 (Improper Input Validation) |

### Root Cause

```python
# backend/main.py:1348-1354 — get_anomalies()
anomalies.append({
    "timestamp": snap.get("timestamp"),
    "type": a.get("type"),
    "severity": a.get("severity"),
    "message": a.get("message"),
    **{k: v for k, v in a.items() if k not in ["type", "severity", "message"]}
})
```

The `**{k: v for k, v in a.items() ...}` blacklist approach copies **all unexpected keys** from anomaly dicts into the API response. If a crafted snapshot causes an anomaly dict to contain keys like `__proto__`, `constructor`, or internal field names (`debug_info`, `traceback`), they leak into the HTTP response.

### Impact

- Information disclosure from internal state leaking into responses
- Frontend could break if unexpected keys conflict with React prop names
- Potential for prototype pollution in frontend rendering

### Fix

Use a whitelist of allowed extra fields per anomaly type:

```python
# backend/main.py:1353 — replace the spread operator

ALLOWED_EXTRA_KEYS = {
    "LIQUIDITY_GAP": {"gap_count", "affected_levels", "total_gap_volume", "gap_severity_score"},
    "SPOOFING": {"volume_ratio", "price_level", "side", "risk_score"},
    "LAYERING": {"side", "score", "large_order_count"},
    "QUOTE_STUFFING": {"update_rate", "avg_rate"},
    "MOMENTUM_IGNITION": {"price_change_pct", "volume", "direction"},
    "WASH_TRADING": {"avg_volume", "volume_variance", "pattern_count"},
    "ICEBERG_ORDER": {"price", "side", "fill_count", "total_volume", "avg_fill_size"},
    "HEAVY_IMBALANCE": {"side", "severity_score"},
    "SPREAD_SHOCK": {"spread_value", "avg_spread"},
    "DEPTH_SHOCK": {"depth_loss_percent"},
}

anomaly_type = a.get("type", "UNKNOWN")
allowed_keys = ALLOWED_EXTRA_KEYS.get(anomaly_type, set())
safe_extras = {k: v for k, v in a.items() if k in allowed_keys}

anomalies.append({
    "timestamp": snap.get("timestamp"),
    "type": anomaly_type,
    "severity": a.get("severity"),
    "message": a.get("message"),
    **safe_extras
})
```

### Verification

```bash
# Inject a snapshot that produces anomalies with unexpected keys:
curl -X POST http://localhost:8000/features \
  -H "Content-Type: application/json" \
  -d '{"anomalies":[{"type":"SPOOFING","severity":"high","message":"test","__proto__":{"polluted":true},"debug_trace":"secret"}]}'
# Check response — unexpected keys should not appear
```

---

## Issue #10 — Replay Speed Path Parameter Accepts Any Integer

| Attribute | Detail |
|-----------|--------|
| **Severity** | **Medium** |
| **Category** | Quality / Input Validation |
| **Files** | `backend/main.py:1244-1251` |
| **CWE** | CWE-20 (Improper Input Validation) |

### Root Cause

```python
# backend/main.py:1244
@app.post("/replay/{session_id}/speed/{value}")
async def set_speed(session_id: str, value: int):
    session.set_speed(value)
```

FastAPI's path parameter parsing accepts any integer, but `UserSession.set_speed()` (`session_replay.py:76`) does `self.speed = max(1, min(speed, 10))`. Negative values, zero, `True` (coerced to 1), `False` (coerced to 0 → clamped to 1) are all silently accepted with clamping.

### Impact

- API returns 200 for any integer, masking client errors
- `value=999999` silently becomes `10` — no feedback to user
- `value=-1` silently becomes `1` — confusing behavior
- Could mask frontend bugs where a non-integer is accidentally passed

### Fix

```python
from fastapi import Path

@app.post("/replay/{session_id}/speed/{value}")
async def set_speed(
    session_id: str,
    value: int = Path(..., ge=1, le=10, description="Replay speed multiplier")
):
    """Set replay speed (1x-10x)."""
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.set_speed(value)
    return {"status": "success", "speed": session.speed, **session.get_state()}
```

FastAPI will return a 422 Validation Error with a clear message if the value is outside `[1, 10]`.

### Verification

```bash
# Before fix:
curl -X POST http://localhost:8000/replay/test/speed/999
# Returns 200 OK, speed silently clamped to 10

# After fix:
curl -X POST http://localhost:8000/replay/test/speed/999
# Returns 422 {"detail":[{"msg":"ensure this value is less than or equal to 10"}]}
```

---

## Summary

### Action Priority

| # | Issue | Severity | Effort | Fix By |
|---|-------|----------|--------|--------|
| 1 | SECRET_KEY None/placeholder | **Critical** | 30 min | Today |
| 4 | Token in localStorage | **Critical** | 2 hr | This week |
| 2 | No auth on 90% endpoints | **Critical** | 1 hr | This week |
| 5 | CORS wildcard | **High** | 5 min | Today |
| 3 | data_buffer race | **Critical** | 1 hr | This week |
| 6 | Session manager race | **High** | 15 min | Today |
| 7 | Memory leak (buffer) | **High** | 15 min | Today |
| 8 | int(user_id) crash | **High** | 5 min | Today |
| 9 | Anomaly key injection | **Medium** | 15 min | Next sprint |
| 10 | Speed validation | **Medium** | 5 min | Next sprint |

### Test Coverage Gaps Noticed

- No tests for concurrent session access (race conditions)
- No auth integration tests (missing token on protected routes)
- No input fuzzing tests for anomaly endpoints
- No memory leak detection tests
- No security SAST/SCA tools configured (no bandit, no safety, no npm audit in CI)

---

*Generated by OpenCode AI Agent with Graphify knowledge graph analysis.*  
*Next audit recommended after fixes are deployed.*
