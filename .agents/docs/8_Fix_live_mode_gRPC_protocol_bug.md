# Fix: LIVE Mode gRPC "Method not found!" Error

## Problem Summary
When switching to LIVE mode, backend shows error:
```
ERROR - Error communicating with market_ingestor: <AioRpcError of RPC that terminated with:
status = StatusCode.UNIMPLEMENTED
details = "Method not found!"
```

**Root Cause**: Market ingestor service running outdated version without `ChangeSymbol` gRPC method.

## Quick Fix Steps

### 1. Stop Old Market Ingestor Process
```bash
# Find process using port 6000
netstat -ano | findstr :6000
# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### 2. Regenerate gRPC Stubs
```bash
cd market_ingestor
# Clean old stubs
rm -rf rpc_stubs/*.py

# Regenerate from protobuf
python -m grpc_tools.protoc --proto_path=proto --python_out=rpc_stubs --grpc_python_out=rpc_stubs proto/live.proto

# Copy to backend
cp rpc_stubs/* ../backend/rpc_stubs/
```

### 3. Restart Market Ingestor
```bash
cd market_ingestor
python main.py
```

### 4. Test gRPC Connection
```bash
cd backend
python test_market_ingestor.py
```

Expected output:
```
✅ Connected to market ingestor
✅ ChangeSymbol response: success=True, message='Successfully switched to ETHUSDT'
✅ StreamSnapshots working
```
## Docker Alternative

### Option 1: Docker Compose (Recommended)
```bash
cd backend
docker-compose down
docker-compose up --build -d
```

### Option 2: Individual Docker Commands
```bash
# Stop containers
docker stop market-ingestor cpp-engine backend-api

# Rebuild and start market ingestor
cd market_ingestor
docker build -t market-ingestor .
docker run -d -p 6000:6000 --name market-ingestor market-ingestor

# Start other services
cd ../cpp_engine
docker build -t cpp-engine .
docker run -d -p 50051:50051 --name cpp-engine cpp-engine

cd ../backend
docker build -t backend-api .
docker run -d -p 8000:8000 --name backend-api backend-api
```

## Files Created/Modified for This Fix

### New Files:
- `backend/test_market_ingestor.py` - gRPC connection test script
- `market_ingestor/rpc_stubs/__init__.py` - Python package marker
- `backend/rpc_stubs/__init__.py` - Python package marker

### Regenerated Files:
- `market_ingestor/rpc_stubs/live_pb2.py` - Protobuf message classes
- `market_ingestor/rpc_stubs/live_pb2_grpc.py` - gRPC service stubs
- `backend/rpc_stubs/live_pb2.py` - Backend protobuf classes
- `backend/rpc_stubs/live_pb2_grpc.py` - Backend gRPC stubs

### Source Files (Already Correct):
- `market_ingestor/proto/live.proto` - gRPC service definition
- `market_ingestor/main.py` - Market ingestor with ChangeSymbol method
- `backend/main.py` - Backend with gRPC client calls

## Git Commands to Push Fix

```bash
# Add new test script
git add backend/test_market_ingestor.py

# Add regenerated gRPC stubs
git add market_ingestor/rpc_stubs/
git add backend/rpc_stubs/

# Commit
git commit -m "Fix LIVE mode gRPC 'Method not found' error

- Add market ingestor gRPC test script
- Regenerate gRPC stubs with ChangeSymbol method
- Fix protobuf compilation issues
- Ensure backend and market_ingestor use same gRPC definitions"

git push origin main
```

## Verification Commands

### Check Services Running:
```bash
# Market ingestor (port 6000)
curl -v telnet://localhost:6000

# Backend API (port 8000)
curl http://localhost:8000/health

# C++ Engine (port 50051)
telnet localhost 50051
```

### Test LIVE Mode:
```bash
# Switch to LIVE mode
curl -X POST http://localhost:8000/mode -H "Content-Type: application/json" -d '{"mode":"LIVE","symbol":"ETHUSDT"}'

# Check if data is flowing
curl http://localhost:8000/features
curl http://localhost:8000/metrics
```

## Common Issues & Solutions

### "Port already in use"
```bash
# Find and kill process
netstat -ano | findstr :6000
taskkill /F /PID <PID>
```

### "Module not found" errors
```bash
# Ensure __init__.py files exist
touch market_ingestor/rpc_stubs/__init__.py
touch backend/rpc_stubs/__init__.py
```

### "Protobuf compilation failed"
```bash
# Install grpcio-tools
pip install grpcio-tools

# Clean and regenerate
rm -rf */rpc_stubs/*.py
python -m grpc_tools.protoc --proto_path=market_ingestor/proto --python_out=market_ingestor/rpc_stubs --grpc_python_out=market_ingestor/rpc_stubs market_ingestor/proto/live.proto
```

### Docker build fails
```bash
# Clean Docker cache
docker system prune -a

# Rebuild with no cache
docker-compose build --no-cache
```

## Success Indicators

✅ **Market Ingestor**: `[MARKET_INGESTOR] gRPC server started on port 6000`
✅ **gRPC Test**: `✅ ChangeSymbol response: success=True`
✅ **LIVE Mode**: Backend logs show `INFO - Switched MODE=LIVE, SYMBOL=ETHUSDT`
✅ **Data Flow**: `/features` endpoint returns live market data
✅ **No Errors**: No "Method not found!" in backend logs

## Prevention

To avoid this issue in the future:
1. **Always restart market_ingestor** after updating gRPC definitions
2. **Regenerate stubs** when modifying `.proto` files
3. **Use Docker** for consistent service versions
4. **Test gRPC connection** before switching to LIVE mode