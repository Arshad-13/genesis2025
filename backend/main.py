from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from typing import List

from analytics import AnalyticsEngine, db_row_to_snapshot
from replay import ReplayController
from db import get_connection

from datetime import datetime
from decimal import Decimal

def sanitize(obj):
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


# --------------------------------------------------
# Logging
# --------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# FastAPI App
# --------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Core Components
# --------------------------------------------------
engine = AnalyticsEngine()
controller = ReplayController()

MAX_BUFFER = 100
data_buffer: List[dict] = []

# --------------------------------------------------
# WebSocket Connection Manager
# --------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket disconnected")

    async def broadcast(self, message: dict):
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()

# --------------------------------------------------
# Database Replay Loop (CORE LOGIC)
# --------------------------------------------------
async def replay_loop():
    logger.info("TimescaleDB replay loop started")

    conn = get_connection()
    cur = conn.cursor()

    while True:
        if controller.state != "PLAYING":
            await asyncio.sleep(0.1)
            continue

        if controller.cursor_ts is None:
            cur.execute("""
                SELECT *
                FROM l2_orderbook
                ORDER BY ts
                LIMIT 1
            """)
        else:
            cur.execute("""
                SELECT *
                FROM l2_orderbook
                WHERE ts > %s
                ORDER BY ts
                LIMIT 1
            """, (controller.cursor_ts,))

        row = cur.fetchone()

        if row is None:
            logger.info("Replay finished")
            controller.state = "STOPPED"
            continue

        controller.cursor_ts = row["ts"]

        # Analytics processing
        snapshot = db_row_to_snapshot(row)
        processed = engine.process_snapshot(snapshot)

        processed = sanitize(processed)

        data_buffer.append(processed)
        if len(data_buffer) > MAX_BUFFER:
            data_buffer.pop(0)

        await manager.broadcast(processed)
        # Replay speed (250 ms base)
        await asyncio.sleep(0.25 / controller.speed)

# --------------------------------------------------
# Startup Hook
# --------------------------------------------------
@app.on_event("startup")
async def startup():
    controller.state = "PLAYING"   # auto-start
    asyncio.create_task(replay_loop())
    logger.info("Backend started")

# --------------------------------------------------
# WebSocket Endpoint
# --------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial history
        await websocket.send_json({
            "type": "history",
            "data": data_buffer
        })

        # KEEP ALIVE — do NOT wait for client messages
        while True:
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --------------------------------------------------
# Replay Control Endpoints (BUTTONS)
# --------------------------------------------------
@app.post("/replay/start")
def start_replay():
    controller.state = "PLAYING"
    controller.cursor_ts = None
    logger.info("Replay started")
    return {"status": "started"}

@app.post("/replay/pause")
def pause_replay():
    controller.state = "PAUSED"
    logger.info("Replay paused")
    return {"status": "paused"}

@app.post("/replay/resume")
def resume_replay():
    controller.state = "PLAYING"
    logger.info("Replay resumed")
    return {"status": "resumed"}

@app.post("/replay/stop")
def stop_replay():
    controller.state = "STOPPED"
    controller.cursor_ts = None
    logger.info("Replay stopped")
    return {"status": "stopped"}

@app.post("/replay/speed/{value}")
def set_speed(value: int):
    controller.speed = max(1, value)
    logger.info(f"Replay speed set to {controller.speed}x")
    return {"speed": controller.speed}

# --------------------------------------------------
# Data APIs (Dashboard)
# --------------------------------------------------
@app.get("/features")
def get_features():
    return data_buffer

@app.get("/anomalies")
def get_anomalies():
    anomalies = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                anomalies.append({
                    "timestamp": snap.get("timestamp"),
                    "type": a.get("type"),
                    "severity": a.get("severity"),
                    "message": a.get("message")
                })
    return anomalies

@app.get("/snapshot/latest")
def get_latest_snapshot():
    if not data_buffer:
        return {}
    return data_buffer[-1]
