# gRPC & Protobuf Skill — Cross-Service Communication

You are working with **gRPC** for inter-service communication between:
- **Market Ingestor** (Python, port 6000) — streams live data to backend
- **C++ Analytics Engine** (C++, port 50051) — processes snapshots

## Proto Definition
`cpp_engine/proto/analytics.proto` defines:
- `Snapshot` / `ProcessedSnapshot` messages
- `AnalyticsService` with `ProcessSnapshot` RPC

`backend/rpc_stubs/live_pb2.py` / `live_pb2_grpc.py` define:
- `LiveFeedService` with `StreamSnapshots` (server streaming) and `ChangeSymbol` RPCs
- `LiveSnapshot`, `SubscribeRequest`, `ChangeSymbolRequest/Response` messages

## Service Map

| Service | Host:Port | Stub Location | Direction |
|---|---|---|---|
| LiveFeedService | localhost:6000 | `live_pb2_grpc.LiveFeedServiceStub` | Backend → Ingestor |
| AnalyticsService | localhost:50051 | `analytics/analytics_client.py` | Backend → C++ Engine |

## C++ Engine Client Pattern
```python
# backend/analytics/analytics_client.py
class CppAnalyticsClient:
    def __init__(self, host, port, timeout_ms=100):
        self.channel = grpc.insecure_channel(f"{host}:{port}")
        self.stub = analytics_pb2_grpc.AnalyticsServiceStub(self.channel)

    def process_snapshot(self, snapshot: dict) -> dict:
        # Convert dict → proto → call → proto → dict
        proto_snapshot = self._to_proto(snapshot)
        response = self.stub.ProcessSnapshot(proto_snapshot, timeout=0.1)
        return self._from_proto(response)
```

## Market Ingestor Client Pattern
```python
# backend/main.py:867
async with grpc.aio.insecure_channel("localhost:6000") as channel:
    stub = live_pb2_grpc.LiveFeedServiceStub(channel)
    async for msg in stub.StreamSnapshots(SubscribeRequest(source="BINANCE")):
        # Process each live snapshot
```

## gRPC Configuration
- Transport: insecure (localhost only — no TLS needed for internal services)
- Timeout: 100ms for C++ engine calls (must be sub-ms in practice)
- Streaming: Server-side streaming for live feed (long-lived connection)
- Unary: Request-response for analytics processing
- Reconnection: `live_grpc_loop` retries after 5s on connection failure

## Conventions
1. Proto messages use `snake_case` field names → Python dicts use `snake_case`
2. Always set default values for optional proto fields before sending
3. gRPC errors → `grpc.RpcError` with `.code()` and `.details()`
4. Channel lifecycle: create once, reuse for multiple calls
5. For async: use `grpc.aio.insecure_channel()` context manager

## When Adding a New RPC
1. Define message + service in `.proto` file
2. Regenerate stubs: `python -m grpc_tools.protoc`
3. Implement on server side (C++ or Python)
4. Add client method in appropriate client class
5. Test with `grpcurl -plaintext localhost:<port> list`

## Troubleshooting
```bash
# List available services
grpcurl -plaintext localhost:50051 list
grpcurl -plaintext localhost:6000 list

# Test C++ engine with dummy snapshot
python -c "
from backend.analytics.analytics_client import CppAnalyticsClient
c = CppAnalyticsClient('localhost', 50051)
print(c.process_snapshot({'timestamp':'now','bids':[[100,10]],'asks':[[101,15]],'mid_price':100.5}))
"

# Check proto compilation
ls backend/rpc_stubs/*.py
```
