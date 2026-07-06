# Troubleshooting: REPLAY & LIVE Mode Data Flow Issues

## Problem Summary
- **REPLAY mode**: No data processing, empty `/features` endpoint
- **LIVE mode**: No data from market ingestor reaching frontend
- **Root Cause**: Missing database configuration and data

## Git Files to Push (For Repository Maintainers)

### Essential Files for Fix:
```bash
# Add critical files
git add docs/TROUBLESHOOTING_DATA_FLOW.md
git add backend/simple_load_data.py
git add backend/test_db.py
git add backend/test_websocket.py
git add backend/test_backend_db.py
git add backend/loader/load_l2_data.py

# Commit and push
git commit -m "Fix REPLAY/LIVE mode data flow issues

- Add database setup script (simple_load_data.py)
- Add WebSocket testing script (test_websocket.py)
- Add database connectivity tests (test_db.py, test_backend_db.py)
- Update data loader with correct DB config (load_l2_data.py)
- Add comprehensive troubleshooting guide (TROUBLESHOOTING_DATA_FLOW.md)"

git push origin main
```

### ⚠️ DO NOT PUSH:
```bash
# Never commit sensitive files
backend/.env  # Contains database passwords
```

## Quick Setup for New Developers

After pulling the latest changes:

1. **Create environment file**:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

2. **Load sample data**:
```bash
cd backend
python simple_load_data.py
```

3. **Verify setup**:
```bash
python test_db.py
python test_websocket.py
```

## Quick Diagnosis Commands

```bash
# Check if services are running
curl http://localhost:8000/health
curl http://localhost:8000/features
curl http://localhost:8000/db/health
curl http://localhost:8000/sessions

# Check database connection
curl http://localhost:8000/db/health
```

## Issue 1: Database Configuration Missing

### Problem
Backend server returns:
```json
{"status":"degraded","issues":["Pool not initialized"]}
```

### Solution
1. **Update `.env` file** in `backend/` directory:
```bash
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=trading_hub
DB_USER=postgres
DB_PASSWORD=your_password
```

2. **Restart backend server** to pick up new config:
```bash
cd backend
# Stop current server (Ctrl+C)
# Restart with venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Issue 2: Missing Database Table & Data

### Problem
Database exists but `l2_orderbook` table is empty or missing.

### Solution
1. **Load sample data** (first time setup):
```bash
cd backend
python simple_load_data.py
```

2. **Verify data loaded**:
```bash
python test_db.py
```

Expected output:
```
✅ Database connection successful!
✅ l2_orderbook table exists
📊 l2_orderbook has 1000 rows
```

## Issue 3: No Active Sessions

### Problem
Data processing only starts when WebSocket connections exist.

### Solution
1. **Create WebSocket connection** (triggers data processing):
```bash
cd backend
python test_websocket.py
```

2. **Start REPLAY mode**:
```bash
# Get session ID from /sessions endpoint
curl http://localhost:8000/sessions

# Start replay for session
curl -X POST http://localhost:8000/replay/{session_id}/start
```

## Issue 4: LIVE Mode Not Receiving Data

### Prerequisites
- Market ingestor running on port 6000
- C++ engine running on port 50051

### Check Services
```bash
# Check if services are listening
netstat -an | grep :6000  # Market ingestor
netstat -an | grep :50051 # C++ engine
netstat -an | grep :8000  # Backend API
```

### Start Services (if not running)
```bash
# Start market ingestor
cd market_ingestor
python main.py

# Start C++ engine
cd cpp_engine
./run_container.sh

# Start backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Docker Setup (Alternative)

If using Docker, ensure all services are running:

```bash
cd backend
docker-compose up -d
```

Check container status:
```bash
docker-compose ps
```

## Verification Steps

1. **Check all endpoints return data**:
```bash
curl http://localhost:8000/health        # Should show "healthy"
curl http://localhost:8000/db/health     # Should show "active"
curl http://localhost:8000/features      # Should return data array
curl http://localhost:8000/sessions      # Should show active sessions
```

2. **Test WebSocket connection**:
```bash
cd backend
python test_websocket.py
```

3. **Verify data flow**:
```bash
# Start session and replay
curl -X POST http://localhost:8000/replay/{session_id}/start

# Check data is flowing
curl http://localhost:8000/features
curl http://localhost:8000/metrics
```

## Common Issues

### "Pool not initialized"
- **Cause**: Backend server using old environment variables
- **Fix**: Restart backend server completely

### "No data processed"
- **Cause**: No active WebSocket sessions
- **Fix**: Connect to frontend dashboard or run `test_websocket.py`

### "Database connection failed"
- **Cause**: Wrong database credentials or port
- **Fix**: Check `.env` file and database service

### Empty `/features` endpoint
- **Cause**: No replay session started
- **Fix**: Create WebSocket connection and start replay

## Environment Variables Reference

Required in `backend/.env`:
```bash
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=trading_hub
DB_USER=postgres
DB_PASSWORD=your_password

# Services
CPP_ENGINE_HOST=localhost
CPP_ENGINE_PORT=50051

# Security
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/trading_hub
```

## Success Indicators

When everything works correctly:
- ✅ `/health` returns `"status":"healthy"`
- ✅ `/db/health` returns `"status":"active"`
- ✅ `/features` returns array with market data
- ✅ `/sessions` shows active sessions in "PLAYING" state
- ✅ Frontend dashboard displays real-time data