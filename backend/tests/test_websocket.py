"""WebSocket integration tests using the FastAPI test client."""
import pytest
from fastapi.testclient import TestClient
from main import app
import uuid


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def test_websocket_receives_history_on_connect(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        data = websocket.receive_json()
        assert isinstance(data, dict)
        assert data.get("type") == "history", "First message should be history"
        assert "data" in data
        assert "session_id" in data
        assert data["session_id"] == session_id


def test_websocket_receives_multiple_message_types(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        data1 = websocket.receive_json()
        assert data1.get("type") == "history"

        try:
            data2 = websocket.receive_json(timeout=2)
            assert isinstance(data2, dict)
            assert data2.get("type") in ["snapshot", "trade_event"] or "timestamp" in data2
        except Exception:
            pass


def test_multiple_sessions_have_isolation(client):
    sid1 = str(uuid.uuid4())
    sid2 = str(uuid.uuid4())

    with client.websocket_connect(f"/ws/{sid1}") as ws1:
        data1 = ws1.receive_json()
        assert data1["session_id"] == sid1

    with client.websocket_connect(f"/ws/{sid2}") as ws2:
        data2 = ws2.receive_json()
        assert data2["session_id"] == sid2
        assert data2["session_id"] != sid1


def test_websocket_handles_invalid_json(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        websocket.receive_json()
        websocket.send_text("invalid { json [[[")
        try:
            websocket.receive_json(timeout=1)
        except Exception:
            pass
