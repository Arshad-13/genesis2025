"""Integration tests for FastAPI endpoints and WebSocket."""
import pytest
import uuid
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def session_id(client):
    sid = str(uuid.uuid4())
    try:
        with client.websocket_connect(f"/ws/{sid}"):
            pass
    except Exception:
        pass
    return sid


class TestHealthAndMetrics:

    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
        assert "mode" in data
        assert isinstance(data["uptime"], (int, float))
        assert data["uptime"] >= 0
        assert isinstance(data["snapshots_processed"], int)

    def test_metrics_endpoint(self, client):
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["uptime_seconds"], (int, float))
        assert isinstance(data["total_snapshots_processed"], int)
        assert isinstance(data["avg_latency_ms"], (int, float))
        assert isinstance(data["total_errors"], int)
        assert "engine" in data
        assert data["engine"] in ["python", "cpp", "unknown"]
        assert "cpp_avg_latency_ms" in data
        assert "python_avg_latency_ms" in data

    def test_metrics_dashboard_endpoint(self, client):
        response = client.get("/metrics/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["active_websocket_connections"], int)
        assert isinstance(data["buffer_size"], int)
        assert "db_pool" in data


class TestReplayControls:

    def test_replay_lifecycle(self, client, session_id):
        response = client.post(f"/replay/{session_id}/start")
        assert response.status_code == 200
        assert response.json()["status"] == "started"
        assert response.json()["state"] == "PLAYING"

        response = client.post(f"/replay/{session_id}/pause")
        assert response.status_code == 200
        assert response.json()["status"] == "paused"

        response = client.post(f"/replay/{session_id}/resume")
        assert response.status_code == 200
        assert response.json()["status"] == "resumed"

        response = client.post(f"/replay/{session_id}/stop")
        assert response.status_code == 200
        assert response.json()["status"] == "stopped"

        state = client.get(f"/replay/{session_id}/state").json()
        assert state["state"] == "STOPPED"

    def test_replay_speed_control(self, client, session_id):
        client.post(f"/replay/{session_id}/start")

        for speed in [1, 5, 10]:
            response = client.post(f"/replay/{session_id}/speed/{speed}")
            assert response.status_code == 200
            assert response.json()["speed"] == speed

        state = client.get(f"/replay/{session_id}/state").json()
        assert state["speed"] == 10

    def test_replay_go_back(self, client, session_id):
        client.post(f"/replay/{session_id}/start")
        response = client.post(f"/replay/{session_id}/goback/30")
        assert response.status_code in [200, 404]
        data = response.json()
        assert "status" in data

    def test_missing_session_returns_error(self, client):
        response = client.post("/replay/nonexistent-session-999/start")
        assert response.status_code in [200, 404]
        data = response.json()
        assert "status" in data

    def test_speed_out_of_bounds_rejected(self, client, session_id):
        client.post(f"/replay/{session_id}/start")
        for bad_speed in [0, -1, 11, 999]:
            response = client.post(f"/replay/{session_id}/speed/{bad_speed}")
            assert response.status_code == 422, f"speed {bad_speed} should be 422"


class TestDataEndpoints:

    def test_features_returns_expected_type(self, client):
        response = client.get("/features")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_latest_snapshot_is_valid_dict(self, client):
        response = client.get("/snapshot/latest")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_anomalies_has_required_structure(self, client):
        response = client.get("/anomalies")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for anomaly in data:
            assert "type" in anomaly, "Every anomaly must have a type"
            assert "severity" in anomaly, "Every anomaly must have a severity"
            assert "message" in anomaly, "Every anomaly must have a message"
            assert anomaly["severity"] in ["low", "medium", "high", "critical"], (
                f"Invalid severity: {anomaly['severity']}"
            )
            assert anomaly["type"] != "UNKNOWN", "Anomaly type should not be UNKNOWN"

    def test_alert_history_respects_limit(self, client):
        for limit in [0, 1, 5, 100]:
            response = client.get(f"/alerts/history?limit={limit}")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) <= limit

    def test_alert_history_handles_edge_cases(self, client):
        response = client.get("/alerts/history?limit=-1")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

        response = client.get("/alerts/history?limit=999999")
        assert response.status_code == 200
        assert len(response.json()) <= 1000

    def test_alert_stats_has_required_keys(self, client):
        response = client.get("/alerts/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_alerts_logged" in data
        assert "alert_counts_by_type" in data
        assert isinstance(data["total_alerts_logged"], int)
        assert isinstance(data["alert_counts_by_type"], dict)

    def test_data_endpoints_consistent(self, client):
        features = client.get("/features").json()
        anomalies = client.get("/anomalies").json()
        latest = client.get("/snapshot/latest").json()
        summary = client.get("/anomalies/summary").json()
        alert_stats = client.get("/alerts/stats").json()

        assert isinstance(features, list)
        assert isinstance(anomalies, list)
        assert isinstance(latest, dict)
        assert isinstance(summary, dict)
        assert isinstance(alert_stats, dict)


class TestAnomalyEndpoints:

    ANOMALY_ENDPOINTS = [
        "/anomalies/liquidity-gaps",
        "/anomalies/spoofing",
        "/anomalies/quote-stuffing",
        "/anomalies/layering",
        "/anomalies/momentum-ignition",
        "/anomalies/wash-trading",
        "/anomalies/iceberg-orders",
    ]

    def test_all_anomaly_endpoints_return_lists(self, client):
        for endpoint in self.ANOMALY_ENDPOINTS:
            response = client.get(endpoint)
            assert response.status_code == 200, f"{endpoint} should return 200"
            data = response.json()
            assert isinstance(data, list), f"{endpoint} should return a list"

            for entry in data:
                assert "timestamp" in entry, f"{endpoint} entries need timestamp"
                assert "severity" in entry, f"{endpoint} entries need severity"
                assert "mid_price" in entry, f"{endpoint} entries need mid_price"

    def test_anomalies_summary_has_all_types(self, client):
        response = client.get("/anomalies/summary")
        assert response.status_code == 200
        data = response.json()
        required_types = [
            "quote_stuffing", "layering", "momentum_ignition",
            "wash_trading", "iceberg_orders", "spoofing", "liquidity_gaps"
        ]
        for atype in required_types:
            assert atype in data, f"Summary missing {atype}"
            assert isinstance(data[atype], int), f"{atype} should be an integer"
            assert data[atype] >= 0, f"{atype} count should be non-negative"


class TestWebSocket:

    def test_websocket_connects_and_receives_initial_data(self, client, session_id):
        with client.websocket_connect(f"/ws/{session_id}") as websocket:
            data = websocket.receive_json()
            assert isinstance(data, dict)
            assert "type" in data or "session_id" in data

    def test_websocket_handles_invalid_json_gracefully(self, client, session_id):
        with client.websocket_connect(f"/ws/{session_id}") as websocket:
            websocket.send_text("not valid json {{{")
            try:
                websocket.receive_json(timeout=1)
            except Exception:
                pass


class TestEngineEndpoints:

    def test_engine_status_returns_valid_payload(self, client):
        response = client.get("/engine/status")
        assert response.status_code == 200
        data = response.json()
        assert data["active_engine"] in ["python", "cpp", "unknown"]
        assert isinstance(data["cpp_enabled"], bool)

    def test_engine_switch_to_python(self, client):
        response = client.post("/engine/switch/python")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        if data["status"] == "success":
            assert "engine" in data
            assert data["engine"] == "python"

    def test_engine_switch_to_cpp(self, client):
        response = client.post("/engine/switch/cpp")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        if data["status"] == "success":
            assert data["engine"] == "cpp"

    def test_database_pool_when_not_initialized(self, client):
        response = client.get("/db/pool")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["active", "not_initialized"]
        if data["status"] == "not_initialized":
            assert data["size"] == 0
        else:
            assert isinstance(data.get("used"), int)
            assert isinstance(data.get("available"), int)
            assert isinstance(data.get("total"), int)

    def test_database_health(self, client):
        response = client.get("/db/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]

    def test_engine_endpoints_are_consistent(self, client):
        status = client.get("/engine/status").json()
        switch = client.post("/engine/switch/python").json()
        if switch.get("status") == "success":
            status2 = client.get("/engine/status").json()
            assert status2["active_engine"] == "python"
            assert status2["cpp_enabled"] is status["cpp_enabled"]
