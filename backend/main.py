from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from typing import List
import os
import pandas as pd

from analytics import AnalyticsEngine, db_row_to_snapshot, MarketSimulator
from replay import ReplayController
from db import get_connection, return_connection

from datetime import datetime
from decimal import Decimal
import threading
import queue
import time
import json
from collections import defaultdict, deque

from grpc_client.analytics_client import CppAnalyticsClient


USE_CPP_ENGINE = False  # feature flag - C++ engine is stub, use Python


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
# Monitoring & Metrics
# --------------------------------------------------
class MetricsCollector:
    def __init__(self):
        self.total_snapshots_processed = 0
        self.total_errors = 0
        self.total_websocket_messages_sent = 0
        self.error_counts = defaultdict(int)
        self.latency_samples = deque(maxlen=1000)  # Rolling window
        self.processing_times = deque(maxlen=1000)
        self.last_snapshot_time = None
        self.start_time = time.time()
        self.cpp_latency = deque(maxlen=1000)
        self.py_latency = deque(maxlen=1000)

        
    def record_snapshot(self, latency_ms: float, processing_time_ms: float):
        self.total_snapshots_processed += 1
        self.latency_samples.append(latency_ms)
        self.processing_times.append(processing_time_ms)
        self.last_snapshot_time = time.time()

    def record_engine_latency(self, engine, latency_ms):
        if engine == "cpp":
            self.cpp_latency.append(latency_ms)
        else:
            self.py_latency.append(latency_ms)

    
    def record_error(self, error_type: str):
        self.total_errors += 1
        self.error_counts[error_type] += 1
        
    def record_websocket_send(self):
        self.total_websocket_messages_sent += 1
    
    def get_stats(self):
        uptime = time.time() - self.start_time
        avg_latency = sum(self.latency_samples) / len(self.latency_samples) if self.latency_samples else 0
        avg_processing = sum(self.processing_times) / len(self.processing_times) if self.processing_times else 0
        p95_latency = sorted(self.latency_samples)[int(len(self.latency_samples) * 0.95)] if len(self.latency_samples) > 20 else 0
        p99_latency = sorted(self.latency_samples)[int(len(self.latency_samples) * 0.99)] if len(self.latency_samples) > 100 else 0
        
        return {
            "uptime_seconds": round(uptime, 1),
            "total_snapshots_processed": self.total_snapshots_processed,
            "total_errors": self.total_errors,
            "total_websocket_messages_sent": self.total_websocket_messages_sent,
            "snapshots_per_second": round(self.total_snapshots_processed / uptime, 2) if uptime > 0 else 0,
            "avg_latency_ms": round(avg_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "p99_latency_ms": round(p99_latency, 2),
            "avg_processing_time_ms": round(avg_processing, 2),
            "error_breakdown": dict(self.error_counts),
            "last_snapshot_ago_seconds": round(time.time() - self.last_snapshot_time, 1) if self.last_snapshot_time else None,
            "mode": MODE
        }

metrics = MetricsCollector()

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
cpp_client = CppAnalyticsClient()
controller = ReplayController()
simulator = MarketSimulator() # Fallback Simulator

MAX_BUFFER = 100
data_buffer: List[dict] = []
simulation_queue = queue.Queue()
MODE = "UNKNOWN" # "REPLAY" or "SIMULATION"

# --------------------------------------------------
# DB Replay Buffer (LATENCY FIX #1)
# --------------------------------------------------
REPLAY_BATCH_SIZE = 500
replay_buffer = deque()

# --------------------------------------------------
# Analytics Worker (LATENCY FIX #2)
# --------------------------------------------------
raw_snapshot_queue = queue.Queue(maxsize=2000)
processed_snapshot_queue = queue.Queue(maxsize=2000)


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
                metrics.record_websocket_send()
            except Exception as e:
                metrics.record_error("websocket_broadcast_failed")
                logger.warning(f"Broadcast failed to client: {e}")


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
                start_time = time.time()
                raw_snapshot = simulator.generate_snapshot()
                
                processing_start = time.time()
                processed_snapshot = engine.process_snapshot(raw_snapshot)
                processing_time = (time.time() - processing_start) * 1000
                
                # Feature I: Feedback Loop
                if 'ofi' in processed_snapshot:
                    simulator.update_ofi(processed_snapshot['ofi'])
                
                simulation_queue.put(processed_snapshot)
                
                total_latency = (time.time() - start_time) * 1000
                metrics.record_snapshot(total_latency, processing_time)
            
            time.sleep(0.1 / controller.speed)
        except Exception as e:
            metrics.record_error("simulation_loop_error")
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

async def processed_broadcast_loop():
    """Broadcast processed snapshots from analytics worker."""
    while True:
        try:
            while not processed_snapshot_queue.empty():
                processed, processing_time = processed_snapshot_queue.get_nowait()

                data_buffer.append(processed)
                if len(data_buffer) > MAX_BUFFER:
                    data_buffer.pop(0)

                await manager.broadcast(processed)

                total_latency = processing_time  # DB + queue already removed
                metrics.record_snapshot(total_latency, processing_time)

            await asyncio.sleep(0.005)
        except Exception as e:
            logger.error(f"Processed broadcast error: {e}")
            await asyncio.sleep(0.05)


def analytics_worker():
    """Runs heavy analytics off the event loop."""
    logger.info("Analytics worker started")

    while True:
        try:
            snapshot = raw_snapshot_queue.get()
            if snapshot is None:
                continue

            processing_start = time.time()

            if USE_CPP_ENGINE:
                result = cpp_client.process_snapshot(snapshot)

                processed = {
                    "timestamp": snapshot["timestamp"],
                    "mid_price": result["mid_price"],
                    "spread": result["spread"],
                    "ofi": result["ofi"],
                    "obi": result["obi"],
                    "anomalies": result["anomalies"],
                }

                processing_time = result["latency_ms"]

            else:
                processed = engine.process_snapshot(snapshot)
                processing_time = (time.time() - processing_start) * 1000

            processed = sanitize(processed)
            processed_snapshot_queue.put((processed, processing_time))

        except Exception as e:
            metrics.record_error("analytics_worker_error")
            logger.error(f"Analytics worker error: {e}")


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
                    start_time = time.time()
                    
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
                    
                    processing_start = time.time()
                    processed = engine.process_snapshot(snapshot)
                    processing_time = (time.time() - processing_start) * 1000
                    
                    processed = sanitize(processed)
                    
                    data_buffer.append(processed)
                    if len(data_buffer) > MAX_BUFFER:
                        data_buffer.pop(0)
                    
                    await manager.broadcast(processed)
                    
                    total_latency = (time.time() - start_time) * 1000
                    metrics.record_snapshot(total_latency, processing_time)
                    
                    await asyncio.sleep(0.1 / controller.speed)
                    
                except Exception as e:
                    metrics.record_error("csv_row_processing_error")
                    logger.error(f"Error processing CSV row: {e}")
                    continue
                    
    except Exception as e:
        metrics.record_error("csv_replay_fatal_error")
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
        
        QUERY_BATCH = """
            SELECT *
            FROM l2_orderbook
            WHERE ts > %s
            ORDER BY ts
            LIMIT %s
        """
        
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

        # Refill buffer if empty
        if not replay_buffer:
            last_ts = controller.cursor_ts or datetime.min
            cur.execute(QUERY_BATCH, (last_ts, REPLAY_BATCH_SIZE))
            rows = cur.fetchall()

            if not rows:
                logger.info("Replay finished")
                controller.state = "STOPPED"
                continue

            for r in rows:
                replay_buffer.append(r)

        # Pop next row from buffer
        row = replay_buffer.popleft()
        controller.cursor_ts = row["ts"]

        start_time = time.time()
        
        snapshot = db_row_to_snapshot(row)

        # Send to analytics worker (non-blocking)
        try:
            raw_snapshot_queue.put_nowait(snapshot)
        except queue.Full:
            metrics.record_error("analytics_queue_full")

        
        # Replay speed (250 ms base)
        await asyncio.sleep(0.25 / controller.speed)

# --------------------------------------------------
# Startup Hook
# --------------------------------------------------
@app.on_event("startup")
async def startup():
    controller.state = "PLAYING"

    # Start analytics worker
    threading.Thread(target=analytics_worker, daemon=True).start()

    # Start loops
    asyncio.create_task(replay_loop())
    asyncio.create_task(processed_broadcast_loop())

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
                    metrics.record_error("order_processing_error")
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
                    "message": a.get("message"),
                    **{k: v for k, v in a.items() if k not in ["type", "severity", "message"]}
                })
    return anomalies

@app.get("/anomalies/liquidity-gaps")
def get_liquidity_gaps():
    """Get recent liquidity gap events with detailed information."""
    gaps = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "LIQUIDITY_GAP":
                    gaps.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "gap_count": a.get("gap_count", 0),
                        "affected_levels": a.get("affected_levels", []),
                        "total_gap_volume": a.get("total_gap_volume", 0),
                        "mid_price": snap.get("mid_price")
                    })
    return gaps

@app.get("/anomalies/spoofing")
def get_spoofing_events():
    """Get recent spoofing-like behavior events."""
    spoofing = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "SPOOFING":
                    spoofing.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "side": a.get("side"),
                        "volume_ratio": a.get("volume_ratio", 0),
                        "price_level": a.get("price_level"),
                        "mid_price": snap.get("mid_price")
                    })
    return spoofing

@app.get("/alerts/history")
def get_alert_history(limit: int = 100):
    """Get alert audit log with optional limit."""
    return engine.alert_manager.get_alert_history(limit)

@app.get("/alerts/stats")
def get_alert_stats():
    """Get alert statistics and counts."""
    return engine.alert_manager.get_alert_stats()

@app.get("/snapshot/latest")
def get_latest_snapshot():
    if not data_buffer:
        return {}
    return data_buffer[-1]

# --------------------------------------------------
# Monitoring Endpoints
# --------------------------------------------------
@app.get("/metrics")
def get_metrics():
    """Prometheus-compatible metrics endpoint."""
    stats = metrics.get_stats()
    return stats

@app.get("/health")
def health_check():
    """Health check endpoint for load balancers."""
    stats = metrics.get_stats()
    
    # Check if system is healthy
    is_healthy = True
    issues = []
    
    # Check 1: Are we processing data?
    if stats["last_snapshot_ago_seconds"] and stats["last_snapshot_ago_seconds"] > 10:
        is_healthy = False
        issues.append(f"No data processed in {stats['last_snapshot_ago_seconds']}s")
    
    # Check 2: Error rate
    if stats["total_snapshots_processed"] > 100:
        error_rate = stats["total_errors"] / stats["total_snapshots_processed"]
        if error_rate > 0.05:  # More than 5% errors
            is_healthy = False
            issues.append(f"High error rate: {error_rate*100:.1f}%")
    
    # Check 3: Latency
    if stats["p99_latency_ms"] > 1000:  # P99 > 1 second
        issues.append(f"High P99 latency: {stats['p99_latency_ms']}ms")
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "issues": issues,
        "mode": MODE,
        "uptime": stats["uptime_seconds"],
        "snapshots_processed": stats["total_snapshots_processed"]
    }

@app.get("/metrics/dashboard")
def metrics_dashboard():
    """Detailed metrics for monitoring dashboard."""
    stats = metrics.get_stats()
    
    # Add additional context
    stats["active_websocket_connections"] = len(manager.active_connections)
    stats["buffer_size"] = len(data_buffer)
    stats["controller_state"] = controller.state
    stats["replay_speed"] = controller.speed
    
    return stats

@app.get("/benchmark/latency")
def latency_benchmark():
    def avg(x): return sum(x) / len(x) if x else 0

    return {
        "python_avg_ms": round(avg(metrics.py_latency), 3),
        "cpp_avg_ms": round(avg(metrics.cpp_latency), 3),
        "python_samples": len(metrics.py_latency),
        "cpp_samples": len(metrics.cpp_latency),
        "winner": "cpp" if avg(metrics.cpp_latency) < avg(metrics.py_latency) else "python"
    }
