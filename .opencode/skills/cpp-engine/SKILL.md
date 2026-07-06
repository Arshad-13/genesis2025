# C++ Engine Skill — gRPC Analytics Microservice

You are working on a **C++17 gRPC microservice** for high-performance market microstructure analytics.

## Tech Stack
- **C++17** standard, **CMake 3.20+** build system
- **gRPC + Protocol Buffers** for communication
- **Docker** for containerized deployment

## Architecture
```
Python Backend (main.py) → gRPC → C++ Engine (server.cpp:50051)
                                     → AnalyticsEngine (analytics_engine.cpp)
                                     → ProcessedSnapshot (proto response)
```

Port: 50051 (configurable via `CPP_ENGINE_PORT` env var)

## Key Files
| File | Purpose |
|---|---|
| `cpp_engine/proto/analytics.proto` | gRPC service definition, message schemas |
| `cpp_engine/src/server.cpp` | gRPC server implementation |
| `cpp_engine/src/analytics_engine.cpp` | Core analytics algorithms (312 lines) |
| `cpp_engine/src/analytics_engine.h` | Engine class declaration |
| `cpp_engine/CMakeLists.txt` | Build configuration |

## Feature Parity (C++ vs Python)
The C++ engine implements:
- **OFI** (Order Flow Imbalance): Bid/ask volume change tracking
- **OBI** (Order Book Imbalance): `(bid_q - ask_q) / total_vol`
- **Microprice**: Volume-weighted fair price
- **Divergence**: Microprice - mid_price with sigmoid directional probability
- **Spread**: Ask - Bid with EWMA dynamic baseline
- **Regime Classification**: Heuristic-based (Calm/Stressed/Execution Hot/Manipulation Suspected)
- **Volatility**: Log-returns standard deviation over rolling window
- **Liquidity Gaps**: Volume threshold-based detection
- **Spoofing Risk**: Volume volatility + order size assessment
- **Heavy Imbalance**: OBI > 0.5 detection
- **Spread Shock**: Spread > 3x EWMA average

The C++ engine does **NOT** implement (Python-only):
- VPIN calculation (needs trade data not available via gRPC)
- Quote Stuffing detection
- Layering detection
- Momentum Ignition detection
- Wash Trading detection
- Iceberg Order detection
- Trade Classification (Lee-Ready)
- K-Means regime clustering (uses heuristic instead)

## Performance
- **Target latency**: <1ms per snapshot
- **Achieved**: 0.5ms average (4.4x faster than Python engine's 2.2ms)
- No heap allocations in hot path (reuse ProcessedSnapshot)
- Avoid bounds checking in tight loops (validate once at entry)

## When Modifying C++ Engine
1. **Proto first**: Define message schema in `analytics.proto`, regenerate stubs
2. **Validate input**: Check `bids_size() > 0`, `asks_size() > 0`, prices > 0
3. **Return safe defaults**: On bad data, return `ProcessedSnapshot` with default values (never crash)
4. **Keep Python in sync**: Any new feature in C++ should also exist in `analytics_core.py` (and vice versa for critical path features)
5. **Test with gRPC**: Use `grpcurl -plaintext localhost:50051 list` for testing

## EWMA State Management
The engine maintains state across snapshots:
- `avg_spread`, `avg_spread_sq`, `avg_l1_vol` — EWMA with α=0.05
- `prev_best_bid`, `prev_best_ask`, `prev_bid_q`, `prev_ask_q` — for OFI
- `price_history` (deque) — for volatility
- `volume_volatility_history` (deque) — for spoofing risk
- This state is **not persisted** — restarting the engine resets all baselines

## Build & Deploy
```bash
# Docker build:
cd cpp_engine
docker build -t cpp-analytics .

# Start via docker-compose:
docker-compose up -d cpp-analytics

# Rebuild after changes:
docker-compose build cpp-analytics && docker-compose up -d cpp-analytics

# Test connection:
grpcurl -plaintext localhost:50051 list
```

## C++ Conventions
- Use `double` for all numeric calculations (not `float`)
- Avoid `std::vector` copies in hot paths (pass by const ref)
- Use `std::deque` for sliding window data (efficient push/pop at both ends)
- Initialize all member variables in constructor
- Use `std::max(0.0, ...)` for variance before `std::sqrt()`
- Safe division: check denominator > `1e-9`
