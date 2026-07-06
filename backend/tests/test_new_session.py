"""Tests for session creation and lifecycle."""
import pytest
from fastapi.testclient import TestClient
from main import app
import uuid


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def test_create_session_via_websocket(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        data = websocket.receive_json()
        assert isinstance(data, dict)
        assert data.get("session_id") == session_id


def test_get_all_sessions_after_creating_one(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        websocket.receive_json()
        response = client.get("/sessions")
        assert response.status_code == 200
        stats = response.json()
        assert isinstance(stats, dict)
        assert "total_sessions" in stats
        assert stats["total_sessions"] >= 1


def test_delete_session_cleans_up(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        websocket.receive_json()

    response = client.delete(f"/sessions/{session_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_replay_controls_on_new_session(client):
    session_id = str(uuid.uuid4())
    with client.websocket_connect(f"/ws/{session_id}") as websocket:
        websocket.receive_json()

        response = client.post(f"/replay/{session_id}/start")
        assert response.status_code == 200
        assert response.json()["status"] == "started"

        response = client.get(f"/replay/{session_id}/state")
        assert response.status_code == 200
        assert response.json()["state"] == "PLAYING"
