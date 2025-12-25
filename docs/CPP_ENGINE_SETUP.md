# C++ Analytics Engine Setup

## Overview

The C++ analytics engine provides high-performance market data processing via gRPC. Currently it's a stub implementation that needs to be completed with real analytics calculations.

## Current Status

- ✅ gRPC server framework setup
- ✅ Protocol buffer definitions
- ✅ Python client integration
- ✅ Analytics calculations (spread, OFI, OBI)
- ✅ Anomaly detection (gaps, imbalance, spoofing)
- ❌ Advanced features (regime, divergence, VPIN)

## Quick Setup

### 1. Build C++ Engine

```bash
cd cpp_engine
docker build -t cpp-analytics .
docker run -p 50051:50051 cpp-analytics
```

### 2. Enable in Backend

```python
# In backend/main.py
USE_CPP_ENGINE = True
```

### 3. Verify Connection

```bash
# Test gRPC endpoint
grpcurl -plaintext localhost:50051 analytics.AnalyticsService/ProcessSnapshot
```

## Development Tasks

### Implemented Analytics

The C++ engine now includes:

1. **Spread Calculation** ✅
   - `best_ask - best_bid`

2. **Order Flow Imbalance (OFI)** ✅
   - Tracks bid/ask flow changes
   - Normalized to [-1, 1] range

3. **Order Book Imbalance (OBI)** ✅
   - Multi-level weighted calculation
   - `(bid_vol - ask_vol) / total_vol`

4. **Anomaly Detection** ✅
   - Liquidity gaps detection
   - Heavy imbalance alerts
   - Spread shock detection
   - Large order detection

### Missing Advanced Features

The following advanced features still need implementation:

1. **Market Regime Classification**
   - Missing from protobuf
   - Needed: K-means clustering

2. **Microprice & Divergence**
   - Missing from protobuf
   - Needed: Volume-weighted price

3. **VPIN & Advanced Analytics**
   - Missing from protobuf
   - Needed: Volume-synchronized probability

### Protocol Buffer Updates Needed

Add to `proto/analytics.proto`:

```protobuf
message ProcessedSnapshot {
  // ... existing fields ...
  double microprice = 7;
  double divergence = 8;
  double directional_prob = 9;
  int32 regime = 10;
  string regime_label = 11;
  double vpin = 12;
  int32 gap_count = 13;
  double gap_severity_score = 14;
  double spoofing_risk = 15;
  double volume_volatility = 16;
}
```

## Performance Comparison

| Engine | Latency | Features |
|--------|---------|----------|
| Python | ~2.2ms | Complete |
| C++ (stub) | ~0.5ms | Basic only |
| C++ (target) | ~0.3ms | Complete |

## Files Structure

```
cpp_engine/
├── proto/analytics.proto        # gRPC definitions
├── src/server.cpp              # gRPC server
├── src/analytics_engine.h      # Analytics header
├── src/analytics_engine.cpp    # Analytics logic ✅
├── CMakeLists.txt             # Build config
└── Dockerfile                 # Container setup
```

## Implementation Priority

1. **Phase 1**: Basic calculations (spread, OBI, OFI)
2. **Phase 2**: Anomaly detection (gaps, spoofing)
3. **Phase 3**: Advanced features (regime, VPIN)

## Testing

```bash
# Run Python engine (current)
USE_CPP_ENGINE = False

# Run C++ engine (development)
USE_CPP_ENGINE = True

# Compare outputs
curl localhost:8000/metrics
```

## Notes

- C++ engine runs on port 50051
- Python fallback always available
- Feature flag controls engine selection
- gRPC timeout set to 50ms

## Also

- To regenerate the backend/grpc_client/analytics_pb2_grpc.py and backend/grpc_client/analytics_pb2_grpc.py, run this:

python -m grpc_tools.protoc -I cpp_engine/proto --python_out=backend/grpc_client --grpc_python_out=backend/grpc_client cpp_engine/proto/analytics.proto
