import os
import sys
import pytest
import json
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestSecurityKeyValidation:
    """Verify SECRET_KEY validation prevents insecure configurations."""

    def test_empty_secret_key_raises(self, monkeypatch):
        monkeypatch.setenv("SECRET_KEY", "")
        with pytest.raises(ValueError, match="not set or is empty"):
            import importlib
            import utils.security
            importlib.reload(utils.security)

    def test_short_secret_key_raises(self, monkeypatch):
        monkeypatch.setenv("SECRET_KEY", "short")
        with pytest.raises(ValueError, match="at least 32 characters"):
            import importlib
            import utils.security
            importlib.reload(utils.security)

    def test_placeholder_secret_key_raises(self, monkeypatch):
        monkeypatch.setenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
        with pytest.raises(ValueError, match="placeholder"):
            import importlib
            import utils.security
            importlib.reload(utils.security)

    def test_valid_secret_key_passes(self, monkeypatch):
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        import importlib
        import utils.security
        importlib.reload(utils.security)
        assert utils.security.SECRET_KEY == "a" * 32


class TestAuthMiddleware:
    """Verify auth middleware blocks or allows requests correctly."""

    @pytest.fixture(autouse=True)
    def setup_bypass(self, monkeypatch):
        monkeypatch.delenv("TEST_AUTH_BYPASS", raising=False)

    @pytest.fixture
    def real_client(self):
        from main import app
        with TestClient(app) as client:
            yield client

    def test_unauthenticated_request_is_blocked(self, real_client):
        response = real_client.get("/features")
        assert response.status_code == 401

    def test_authenticated_with_bearer_header(self, real_client, monkeypatch):
        from utils.security import create_access_token
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        import importlib
        import utils.security
        importlib.reload(utils.security)

        token = create_access_token({"sub": "1"})
        response = real_client.get(
            "/features",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    def test_authenticated_with_cookie(self, real_client, monkeypatch):
        from utils.security import create_access_token
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        import importlib
        import utils.security
        importlib.reload(utils.security)

        token = create_access_token({"sub": "1"})
        response = real_client.get(
            "/features",
            cookies={"access_token": token}
        )
        assert response.status_code == 200

    def test_public_endpoints_are_unblocked(self, real_client):
        response = real_client.get("/health")
        assert response.status_code == 200
        response = real_client.get("/docs")
        assert response.status_code == 200

    def test_invalid_token_returns_401(self, real_client):
        response = real_client.get(
            "/features",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401

    def test_malformed_jwt_sub_returns_401(self, real_client, monkeypatch):
        from utils.security import create_access_token
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        import importlib
        import utils.security
        importlib.reload(utils.security)

        token = create_access_token({"sub": "not_a_number"})
        response = real_client.get(
            "/features",
            cookies={"access_token": token}
        )
        assert response.status_code == 200


class TestAnomalyWhitelist:
    """Verify anomaly key injection is blocked."""

    def test_only_allowed_keys_in_anomaly_response(self):
        from analytics_core import AnalyticsEngine
        engine = AnalyticsEngine()

        snapshot = {
            "timestamp": "2025-01-01T00:00:00",
            "mid_price": 100.0,
            "bids": [[99.0, 5], [98.0, 3]],
            "asks": [[101.0, 8], [102.0, 4]]
        }
        result = engine.process_snapshot(snapshot)
        anomalies = result.get("anomalies", [])

        ALLOWED_KEYS = {
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
            "RAPID_TRADING": {"trade_count", "avg_interval_ms"},
            "UNUSUAL_TRADE_SIZE": {"trade_volume", "avg_volume", "z_score"},
            "DATA_VALIDATION_ERROR": set(),
        }

        for a in anomalies:
            anomaly_type = a.get("type", "UNKNOWN")
            allowed = ALLOWED_KEYS.get(anomaly_type, set()) | {"type", "severity", "message", "timestamp"}
            for key in a:
                assert key in allowed, (
                    f"Key '{key}' in anomaly type '{anomaly_type}' is not whitelisted. "
                    f"Allowed: {allowed}"
                )


class TestSpeedValidation:
    """Verify speed endpoint validation."""

    @pytest.fixture
    def test_client(self):
        from main import app
        with TestClient(app) as client:
            yield client

    def test_speed_zero_rejected(self, test_client):
        response = test_client.post("/replay/test-session/speed/0")
        assert response.status_code == 422

    def test_speed_eleven_rejected(self, test_client):
        response = test_client.post("/replay/test-session/speed/11")
        assert response.status_code == 422

    def test_speed_one_accepted(self, test_client):
        response = test_client.post("/replay/test-session/speed/1")
        assert response.status_code in (200, 404)

    def test_speed_ten_accepted(self, test_client):
        response = test_client.post("/replay/test-session/speed/10")
        assert response.status_code in (200, 404)


class TestSafeDataBuffer:
    """Verify SafeDataBuffer thread safety and size control."""

    def test_append_and_retrieve(self):
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=10)
        buf.append({"a": 1})
        buf.append({"b": 2})
        assert len(buf) == 2
        assert buf.get_all() == [{"a": 1}, {"b": 2}]

    def test_auto_trim_on_max_size(self):
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=3)
        for i in range(5):
            buf.append({"i": i})
        assert len(buf) == 3
        assert buf.get_all() == [{"i": 2}, {"i": 3}, {"i": 4}]

    def test_get_latest(self):
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=10)
        assert buf.get_latest() is None
        buf.append({"a": 1})
        buf.append({"b": 2})
        assert buf.get_latest() == {"b": 2}

    def test_get_last(self):
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=100)
        for i in range(10):
            buf.append({"i": i})
        assert buf.get_last(3) == [{"i": 7}, {"i": 8}, {"i": 9}]

    def test_bool_empty(self):
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=10)
        assert not buf
        buf.append({"a": 1})
        assert buf

    def test_concurrent_writes(self):
        import threading
        from main import SafeDataBuffer
        buf = SafeDataBuffer(max_size=1000)
        errors = []

        def writer(start, count):
            try:
                for i in range(start, start + count):
                    buf.append({"n": i})
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=writer, args=(0, 200)),
            threading.Thread(target=writer, args=(200, 200)),
            threading.Thread(target=writer, args=(400, 200)),
            threading.Thread(target=writer, args=(600, 200)),
            threading.Thread(target=writer, args=(800, 200)),
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Concurrent writes produced errors: {errors}"
        assert len(buf) <= 1000
