import grpc
import time
from analytics import analytics_pb2, analytics_pb2_grpc


class CppAnalyticsClient:
    def __init__(self, host="localhost", port=50051, timeout_ms=500):
        self.channel = grpc.insecure_channel(f"{host}:{port}")
        self.stub = analytics_pb2_grpc.AnalyticsServiceStub(self.channel)
        self.timeout = timeout_ms / 1000.0

    def process_snapshot(self, snapshot: dict):
        def _to_price_levels(levels):
            return [
                analytics_pb2.PriceLevel(price=float(p), volume=float(v))
                for p, v in levels
            ]


        req = analytics_pb2.Snapshot(
            timestamp=str(snapshot["timestamp"]),
            bids=_to_price_levels(snapshot["bids"]),
            asks=_to_price_levels(snapshot["asks"]),
            mid_price=float(snapshot["mid_price"])
        )

        start = time.time()
        resp = self.stub.ProcessSnapshot(req, timeout=self.timeout)
        latency_ms = (time.time() - start) * 1000

        return {
            "timestamp": resp.timestamp,
            "mid_price": resp.mid_price,
            "spread": resp.spread,
            "ofi": resp.ofi,
            "obi": resp.obi,
            "microprice": resp.microprice,
            "divergence": resp.divergence,
            "directional_prob": resp.directional_prob,
            "regime": resp.regime,
            "regime_label": resp.regime_label,
            "vpin": resp.vpin,
            "anomalies": [
                {
                    "type": a.type,
                    "severity": a.severity,
                    "message": a.message
                }
                for a in resp.anomalies
            ],
            "latency_ms": latency_ms
        }

