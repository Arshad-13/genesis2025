from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from typing import List

from analytics import AnalyticsEngine, db_row_to_snapshot, MarketSimulator
from replay import ReplayController
from db import get_connection

from datetime import datetime
from decimal import Decimal
import threading
import queue
import time
import json

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
simulator = MarketSimulator() # Fallback Simulator

MAX_BUFFER = 100
data_buffer: List[dict] = []
simulation_queue = queue.Queue()
MODE = "UNKNOWN" # "REPLAY" or "SIMULATION"

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
# Simulation Loop (FALLBACK)
# --------------------------------------------------
def simulation_loop():
    """Runs in a separate thread when DB is unavailable."""
    logger.info("Simulation Loop started (Fallback Mode)")
    while True:
        try:
            if controller.state == "PLAYING":
                raw_snapshot = simulator.generate_snapshot()
                processed_snapshot = engine.process_snapshot(raw_snapshot)
                
                # Feature I: Feedback Loop
                if 'ofi' in processed_snapshot:
                    simulator.update_ofi(processed_snapshot['ofi'])
                
                simulation_queue.put(processed_snapshot)
            
            time.sleep(0.1 / controller.speed)
        except Exception as e:
            logger.error(f"Simulation error: {e}")
            time.sleep(1)

async def broadcast_loop():
    """Reads from the queue and broadcasts to WebSockets."""
    while True:
        try:
            while not simulation_queue.empty():
                snapshot = simulation_queue.get_nowait()
                
                data_buffer.append(snapshot)
                if len(data_buffer) > MAX_BUFFER:
                    data_buffer.pop(0)
                
                await manager.broadcast(snapshot)
            
            await asyncio.sleep(0.01)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            await asyncio.sleep(0.1)

# --------------------------------------------------
# CSV Replay Loop (FALLBACK 2)
# --------------------------------------------------
async def csv_replay_loop():
    """Runs when DB is unavailable but CSV is present."""
    global MODE
    logger.info("Starting CSV Replay Loop")
    
    # Path to the CSV file
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "l2_clean.csv")
    
    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found at {csv_path}. Switching to SIMULATION.")
        MODE = "SIMULATION"
        threading.Thread(target=simulation_loop, daemon=True).start()
        return

    # Read CSV in chunks
    chunk_size = 1000
    # Skip header, assume structure: P,V, P,V... for Bids then Asks, then TS
    
    try:
        for chunk in pd.read_csv(csv_path, chunksize=chunk_size, header=0):
            # Convert to numpy for faster iteration
            data_values = chunk.values
            
            for row in data_values:
                if controller.state != "PLAYING":
                    while controller.state != "PLAYING":
                        await asyncio.sleep(0.1)
                
                # Parse Row (Interleaved Px, Vol)
                # Cols 0-19: Bids (Px, Vol)
                # Cols 20-39: Asks (Px, Vol)
                # Col 40: Timestamp
                
                bids = []
                asks = []
                
                try:
                    for i in range(0, 20, 2):
                        bids.append([float(row[i]), float(row[i+1])])
                    
                    for i in range(20, 40, 2):
                        asks.append([float(row[i]), float(row[i+1])])
                        
                    ts = str(row[40])
                    mid_price = (bids[0][0] + asks[0][0]) / 2
                    
                    snapshot = {
                        "timestamp": ts,
                        "bids": bids,
                        "asks": asks,
                        "mid_price": round(mid_price, 2)
                    }
                    
                    processed = engine.process_snapshot(snapshot)
                    processed = sanitize(processed)
                    
                    data_buffer.append(processed)
                    if len(data_buffer) > MAX_BUFFER:
                        data_buffer.pop(0)
                    
                    await manager.broadcast(processed)
                    await asyncio.sleep(0.1 / controller.speed)
                    
                except Exception as e:
                    logger.error(f"Error processing CSV row: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"CSV Replay Error: {e}")
        MODE = "SIMULATION"
        threading.Thread(target=simulation_loop, daemon=True).start()

# --------------------------------------------------
# Database Replay Loop (CORE LOGIC)
# --------------------------------------------------
async def replay_loop():
    global MODE
    logger.info("Attempting to connect to TimescaleDB...")

    try:
        conn = get_connection()
        cur = conn.cursor()
        MODE = "REPLAY"
        logger.info("Connected to DB. Starting Replay Loop.")
    except Exception as e:
        logger.warning(f"DB Connection failed: {e}")
        logger.info("Checking for CSV dataset...")
        
        csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "l2_clean.csv")
        if os.path.exists(csv_path):
            logger.info("CSV found. Switching to CSV REPLAY MODE.")
            MODE = "CSV_REPLAY"
            asyncio.create_task(csv_replay_loop())
            # Start broadcaster not needed for CSV loop as it broadcasts directly? 
            # Wait, csv_replay_loop broadcasts directly.
            # But simulation_loop puts to queue.
            # Let's keep it consistent.
            return
        else:
            logger.warning("CSV not found. Switching to SIMULATION MODE (Fallback)")
            MODE = "SIMULATION"
            sim_thread = threading.Thread(target=simulation_loop, daemon=True)
            sim_thread.start()
            asyncio.create_task(broadcast_loop())
            return

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

        while True:
            # Keep connection alive and listen for orders
            data = await websocket.receive_text()
            
            # Feature J: Handle incoming orders (Only in Simulation Mode)
            if MODE == "SIMULATION":
                try:
                    message = json.loads(data)
                    if message.get("type") == "ORDER":
                        side = message.get("side")
                        quantity = int(message.get("quantity", 100))
                        simulator.place_order(side, quantity)
                        logger.info(f"Order placed: {side} {quantity}")
                except Exception as e:
                    logger.error(f"Error processing order: {e}")

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
