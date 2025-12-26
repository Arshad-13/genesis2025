import grpc
import time
from . import analytics_pb2, analytics_pb2_grpc


class CppAnalyticsClient:
    def __init__(self, host="localhost", port=50051, timeout_ms=50):
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
            "vpin": resp.vpin,
            "regime": resp.regime,
            "regime_label": resp.regime_label,
            "best_bid": resp.best_bid,
            "best_ask": resp.best_ask,
            "q_bid": resp.q_bid,
            "q_ask": resp.q_ask,
            "gap_count": resp.gap_count,
            "gap_severity_score": resp.gap_severity_score,
            "spoofing_risk": resp.spoofing_risk,
            "bids": snapshot.get("bids", []),  # Pass through original L2 data
            "asks": snapshot.get("asks", []),  # Pass through original L2 data
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

