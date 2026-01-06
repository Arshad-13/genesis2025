from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import asyncio
import logging
from typing import List
import os
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from routers import auth
from utils.database import Base, engine as db_engine
from analytics_core import AnalyticsEngine, db_row_to_snapshot, MarketSimulator
from db import get_connection, return_connection, close_all_connections, get_pool_stats

from datetime import datetime
from decimal import Decimal
import threading
import queue
import time
import json
from collections import defaultdict, deque

from analytics.analytics_client import CppAnalyticsClient
import grpc

from rpc_stubs import live_pb2, live_pb2_grpc

from session_replay import SessionManager, UserSession
from utils.security import decode_access_token
from utils.data import sanitize
from typing import Dict
from snapshot_processor import SnapshotProcessor

# Load environment variables from .env file
load_dotenv()

# Configuration
USE_CPP_ENGINE = os.getenv("USE_CPP_ENGINE", "true").lower() == "true"  # Auto-enable C++ engine
CPP_ENGINE_HOST = os.getenv("CPP_ENGINE_HOST", "localhost")
CPP_ENGINE_PORT = int(os.getenv("CPP_ENGINE_PORT", "50051"))

# Buffer and Queue Configuration
MAX_BUFFER_SIZE = int(os.getenv("MAX_BUFFER_SIZE", "100"))
RAW_QUEUE_SIZE = int(os.getenv("RAW_QUEUE_SIZE", "2000"))
PROCESSED_QUEUE_SIZE = int(os.getenv("PROCESSED_QUEUE_SIZE", "2000"))
REPLAY_BATCH_SIZE = int(os.getenv("REPLAY_BATCH_SIZE", "500"))
BACKPRESSURE_THRESHOLD = int(os.getenv("BACKPRESSURE_THRESHOLD", "1500"))  # 75% of queue size

engine_mode = "unknown"  # Track which engine is active: "cpp", "python", or "unavailable"


# --------------------------------------------------
# Logging
# --------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# Rate Limiting (Issue #11)
# --------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

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
        
        # Engine-specific latency stats
        cpp_avg = sum(self.cpp_latency) / len(self.cpp_latency) if self.cpp_latency else 0
        py_avg = sum(self.py_latency) / len(self.py_latency) if self.py_latency else 0
        
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
            "mode": MODE,
            "engine": engine_mode,
            "cpp_avg_latency_ms": round(cpp_avg, 3),
            "python_avg_latency_ms": round(py_avg, 3),
            "cpp_samples": len(self.cpp_latency),
            "python_samples": len(self.py_latency),
            "performance_improvement": f"{(py_avg / cpp_avg):.1f}x" if cpp_avg > 0 and py_avg > 0 else "N/A",
            "adaptive_processor": adaptive_processor.get_stats()  # Add adaptive processing stats
        }

metrics = MetricsCollector()

# --------------------------------------------------
# Application Lifespan
# --------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    # Startup
    logger.info("Starting application...")
    
    # Create database tables only if engine is available
    if db_engine:
        Base.metadata.create_all(bind=db_engine)
    
    # Initialize C++ engine
    initialize_cpp_engine()
    
    # Session cleanup task
    async def cleanup_sessions_periodically():
        while True:
            await asyncio.sleep(300)  # Every 5 minutes
            await session_manager.cleanup_inactive_sessions()
    
    cleanup_task = asyncio.create_task(cleanup_sessions_periodically())
    
    logger.info("Backend started with session management")
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("Shutting down...")
    
    # Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    try:
        # Close database connections
        await asyncio.wait_for(close_all_connections(), timeout=3.0)
        logger.info("Database connections closed")
        
        # Cleanup model resources
        logger.info("Cleaning up model resources...")
        if hasattr(inference_engine, 'model') and inference_engine.model is not None:
            inference_engine.session_buffers.clear()
            if hasattr(inference_engine.model, 'cpu'):
                inference_engine.model.cpu()  # Move model off GPU
            del inference_engine.model
        
        import gc
        gc.collect()
        logger.info("Resources cleaned up successfully")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# --------------------------------------------------
# FastAPI App
# --------------------------------------------------
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

# --------------------------------------------------
# Core Components
# --------------------------------------------------
engine = AnalyticsEngine()
cpp_client = None  # Lazy initialization
session_manager = SessionManager()

# Model Inference
from inference_service import ModelInference
from session_strategy import SessionStrategyManager

inference_engine = ModelInference()
strategy_manager = SessionStrategyManager()

# Engine state lock to prevent race conditions
engine_state_lock = threading.Lock()


def initialize_cpp_engine():
    """Initialize C++ engine with connection test and fallback."""
    global cpp_client, engine_mode
    
    with engine_state_lock:
        if not USE_CPP_ENGINE:
            logger.info("C++ engine disabled via config, using Python engine")
            engine_mode = "python"
            return False
        
        try:
            temp_client = CppAnalyticsClient(host=CPP_ENGINE_HOST, port=CPP_ENGINE_PORT, timeout_ms=100)
            
            # Test connection with dummy snapshot
            test_snapshot = {
                "timestamp": "2024-01-01T00:00:00",
                "bids": [[100.0, 10.0], [99.9, 20.0]],
                "asks": [[100.1, 15.0], [100.2, 25.0]],
                "mid_price": 100.05
            }
            result = temp_client.process_snapshot(test_snapshot)
            
            logger.info(f"✅ C++ engine connected at {CPP_ENGINE_HOST}:{CPP_ENGINE_PORT} (latency: {result.get('latency_ms', 0):.2f}ms)")
            # Only assign to global after successful test
            cpp_client = temp_client
            engine_mode = "cpp"
            snapshot_processor.set_cpp_client(cpp_client)
            return True
            
        except grpc.RpcError as e:
            logger.warning(f"⚠️  C++ engine unavailable ({e.code()}), falling back to Python engine")
            engine_mode = "python"
            cpp_client = None
            return False
        except Exception as e:
            logger.warning(f"⚠️  C++ engine initialization failed: {e}, falling back to Python engine")
            engine_mode = "python"
            cpp_client = None
            return False

# Initialize snapshot processor service (requires engine to be initialized)
snapshot_processor = SnapshotProcessor(
    cpp_client=None, 
    analytics_engine=engine,
    max_failures=5
)


data_buffer: List[dict] = []
simulation_queue = queue.Queue()
MODE = "REPLAY"  # REPLAY | LIVE | SIMULATION
ACTIVE_SOURCE = None   # e.g. "BINANCE"
ACTIVE_SYMBOL = None   # e.g. "BTCUSDT"

# --------------------------------------------------
# DB Replay Buffer (LATENCY FIX #1)
# --------------------------------------------------
replay_buffer = deque()

# --------------------------------------------------
# Analytics Worker (LATENCY FIX #2)
# --------------------------------------------------
raw_snapshot_queue = queue.Queue(maxsize=RAW_QUEUE_SIZE)
processed_snapshot_queue = queue.Queue(maxsize=PROCESSED_QUEUE_SIZE)

class AdaptiveProcessor:
    """Adaptive analytics processor that handles slow engines gracefully"""
    def __init__(self):
        self.processing_times = []
        self.slow_processing_threshold = 100  # ms
        self.adaptive_mode = False
        self.skip_counter = 0
        self.skip_ratio = 1  # Process every Nth snapshot when adaptive
        
    def should_process(self, snapshot):
        """Decide if snapshot should be processed based on system load"""
        if not self.adaptive_mode:
            return True
            
        # In adaptive mode, skip some snapshots to catch up
        self.skip_counter += 1
        if self.skip_counter >= self.skip_ratio:
            self.skip_counter = 0
            return True
        return False
    
    def record_processing_time(self, processing_time_ms):
        """Record processing time and adjust adaptive mode"""
        self.processing_times.append(processing_time_ms)
        
        # Keep only recent samples
        if len(self.processing_times) > 20:
            self.processing_times.pop(0)
        
        # Calculate average processing time
        if len(self.processing_times) >= 5:
            avg_time = sum(self.processing_times[-5:]) / 5
            
            # Enter adaptive mode if processing is consistently slow
            if avg_time > self.slow_processing_threshold and not self.adaptive_mode:
                self.adaptive_mode = True
                self.skip_ratio = min(3, int(avg_time / 50))  # Skip more for slower processing
                logger.warning(f"Entering adaptive processing mode - skipping {self.skip_ratio-1}/{self.skip_ratio} snapshots")
            
            # Exit adaptive mode if processing speeds up
            elif avg_time < self.slow_processing_threshold * 0.7 and self.adaptive_mode:
                self.adaptive_mode = False
                self.skip_counter = 0
                logger.info("Exiting adaptive processing mode - processing speed recovered")
    
    def get_stats(self):
        """Get adaptive processor statistics"""
        avg_time = sum(self.processing_times) / len(self.processing_times) if self.processing_times else 0
        return {
            "adaptive_mode": self.adaptive_mode,
            "skip_ratio": self.skip_ratio if self.adaptive_mode else 1,
            "avg_processing_time_ms": round(avg_time, 2),
            "recent_samples": len(self.processing_times)
        }

adaptive_processor = AdaptiveProcessor()


# --------------------------------------------------
# WebSocket Connection Manager
# --------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.websocket_to_session: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.websocket_to_session[websocket] = session_id
        logger.info(f"WebSocket connected for session {session_id}")

    def disconnect(self, websocket: WebSocket):
        session_id = self.websocket_to_session.get(websocket)
        if session_id:
            if session_id in self.active_connections:
                del self.active_connections[session_id]
            del self.websocket_to_session[websocket]
            
            # Cleanup inference buffers for this session
            if inference_engine:
                inference_engine.cleanup_session(session_id)
            
            logger.info(f"WebSocket disconnected for session {session_id}")

    async def send_to_session(self, session_id: str, message: dict):
        """Send message to specific session."""
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.send_json(message)
                metrics.record_websocket_send()
                return True
            except Exception as e:
                metrics.record_error("websocket_send_failed")
                logger.warning(f"Send failed to session {session_id}: {e}")
                return False
        return False

    async def broadcast(self, message: dict):
        """Broadcast to all connected sessions."""
        for session_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
                metrics.record_websocket_send()
            except Exception as e:
                metrics.record_error("websocket_broadcast_failed")
                logger.warning(f"Broadcast failed to session {session_id}: {e}")


manager = ConnectionManager()

# --------------------------------------------------
# Session-Specific Analytics Worker (Async)
# --------------------------------------------------
async def session_analytics_worker_async(session: UserSession):
    """
    Async analytics worker for a specific session.
    Replaces threaded worker for better concurrency and resource efficiency.
    """
    global engine_mode, cpp_client
    logger.info(f"Async analytics worker started for session {session.session_id}")
    
    consecutive_cpp_failures = 0
    MAX_CPP_FAILURES = 5

    while session.is_active():
        try:
            # Non-blocking queue check
            try:
                snapshot = session.raw_snapshot_queue.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.01)  # Yield control, 10ms sleep
                continue
                
            if snapshot is None:
                continue

            # Process using snapshot processor service
            processed, processing_time, used_engine, consecutive_cpp_failures = snapshot_processor.process(
                snapshot, consecutive_cpp_failures
            )

            processed["engine"] = used_engine
            
            # === MODEL PREDICTION ===
            prediction = inference_engine.predict(session.session_id, snapshot)
            if prediction:
                processed['prediction'] = prediction
                
                # === STRATEGY ENGINE ===
                # Get strategy for this session
                strategy = strategy_manager.get_or_create(session.session_id)
                strategy_update = strategy.process_signal(prediction, snapshot)
                if strategy_update:
                    processed['strategy'] = strategy_update
            
            # Also update global buffer for backward compatibility
            data_buffer.append(processed)
            
            session.processed_snapshot_queue.put((processed, processing_time))
            metrics.record_engine_latency(used_engine.replace("_fallback", ""), processing_time)

        except queue.Empty:
            await asyncio.sleep(0.01)
        except Exception as e:
            metrics.record_error("session_analytics_worker_error")
            logger.error(f"Session {session.session_id} async analytics error: {e}")
            await asyncio.sleep(0.1)  # Back off on error

    logger.info(f"Async analytics worker stopped for session {session.session_id}")

# Backward compatibility: Legacy threaded worker (deprecated)
# --------------------------------------------------
# Session Replay Loop
# --------------------------------------------------
async def session_replay_loop(session: UserSession):
    """Replay loop for individual session."""
    logger.info(f"Starting replay loop for session {session.session_id}")
    
    conn = None
    try:
        conn = await get_connection()
        
        QUERY_BATCH = """
            SELECT *
            FROM l2_orderbook
            WHERE ts > $1
            ORDER BY ts
            LIMIT $2
        """
        
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        while session.is_active():
            try:
                if session.state != "PLAYING":
                    await asyncio.sleep(0.1)
                    continue
                
                # Refill buffer if empty
                if not session.replay_buffer:
                    last_ts = session.cursor_ts or datetime.min
                    
                    try:
                        rows = await conn.fetch(QUERY_BATCH, last_ts, REPLAY_BATCH_SIZE)
                    except Exception as db_err:
                        logger.error(f"Session {session.session_id} DB error: {db_err}")
                        consecutive_errors += 1
                        
                        if consecutive_errors >= max_consecutive_errors:
                            logger.error(f"Session {session.session_id}: Too many DB errors")
                            break
                        
                        await asyncio.sleep(1.0)
                        continue
                    
                    if not rows:
                        logger.info(f"Session {session.session_id}: Replay finished")
                        session.stop()
                        continue
                    
                    consecutive_errors = 0
                    
                    for r in rows:
                        session.replay_buffer.append(dict(r))
                
                # Pop next row
                row = session.replay_buffer.popleft()
                session.cursor_ts = row["ts"]
                
                snapshot = db_row_to_snapshot(row)
                
                # Process snapshot
                try:
                    # Backpressure handling: check queue size before pushing
                    queue_size = session.raw_snapshot_queue.qsize()
                    if queue_size > BACKPRESSURE_THRESHOLD:
                        logger.warning(f"Session {session.session_id}: High backpressure ({queue_size}/{RAW_QUEUE_SIZE}), skipping snapshot")
                        metrics.record_error("queue_backpressure")
                        await asyncio.sleep(0.5)  # Slow down replay
                        continue
                    
                    session.raw_snapshot_queue.put_nowait(snapshot)
                    consecutive_errors = 0  # Reset on success
                except queue.Full:
                    logger.warning(f"Session {session.session_id}: Queue full, dropping snapshot")
                    metrics.record_error("queue_full")
                    consecutive_errors += 1
                
                # Replay speed
                await asyncio.sleep(0.25 / session.speed)
            
            except Exception as e:
                logger.error(f"Session {session.session_id} loop error: {e}")
                consecutive_errors += 1
                
                if consecutive_errors >= max_consecutive_errors:
                    break
                
                await asyncio.sleep(0.5)
    
    finally:
        if conn:
            await return_connection(conn)


# --------------------------------------------------
# Session Broadcast Loop
# --------------------------------------------------
async def session_broadcast_loop(session: UserSession):
    """Broadcast processed snapshots to specific session."""
    while session.is_active():
        try:
            while not session.processed_snapshot_queue.empty():
                processed, processing_time = session.processed_snapshot_queue.get_nowait()
                
                session.data_buffer.append(processed)
                
                # Send to this session only
                await manager.send_to_session(session.session_id, processed)
                
                metrics.record_snapshot(processing_time, processing_time)
            
            await asyncio.sleep(0.005)
        except Exception as e:
            logger.error(f"Session {session.session_id} broadcast error: {e}")
            await asyncio.sleep(0.05)

# --------------------------------------------------
# CSV Replay Loop (Ad-Hoc for ModelTest)
# --------------------------------------------------
async def session_csv_replay_loop(session: UserSession, csv_path: str):
    """Streams data from CSV for a specific session."""
    print(f"DEBUG: Starting CSV replay for session {session.session_id} from {csv_path}")
    logger.info(f"Starting CSV replay for session {session.session_id} from {csv_path}")
    
    try:
        # Check if file exists
        if not os.path.exists(csv_path):
             print(f"DEBUG: ERROR - File not found: {csv_path}")
             logger.error(f"File not found: {csv_path}")
             return

        # Use pandas for easy chunk reading
        chunk_size = 1000
        print(f"DEBUG: Reading CSV chunks...")
        for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
            print(f"DEBUG: Processing chunk of size {len(chunk)}")
            if not session.is_active():
                print("DEBUG: Session not active, breaking")
                break
                
            # Convert chunk to dict records
            records = chunk.to_dict('records')
            
            for row in records:
                if not session.is_active():
                    break
                    
                # Map CSV columns to snapshot format
                # Assuming l2_clean.csv format: 
                # [exchange_ts, receive_ts, bid1, vol1, ..., mid_price]
                # We need to construct the snapshot carefully.
                # Actually, data_loader.py logic handles this mapping usually.
                # Let's align with what DataHandler does or simple mapping.
                
                # Simple mapping for visualization:
                # 40 columns are features. 
                # 0-20: Bids (Price, Vol) x 10
                # 20-40: Asks (Price, Vol) x 10
                
                # Check columns to decide mapping
                # If unnamed columns, we might need to assume indices.
                # Let's assume standard LOB format.
                
                # Construct snapshot with safer column handling
                snapshot = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "symbol": "BTCUSDT",
                    "bids": [],
                    "asks": [],
                    "mid_price": 0.0
                }
                
                # Try to use column names if available, fallback to positional
                try:
                    # Check if we have named columns (safer approach)
                    if any(col.startswith('bid_price') for col in row.keys()):
                        # Use named columns
                        for i in range(1, 11):
                            bid_price_col = f'bid_price_{i}'
                            bid_vol_col = f'bid_volume_{i}'
                            if bid_price_col in row and bid_vol_col in row:
                                snapshot['bids'].append([float(row[bid_price_col]), float(row[bid_vol_col])])
                        for i in range(1, 11):
                            ask_price_col = f'ask_price_{i}'
                            ask_vol_col = f'ask_volume_{i}'
                            if ask_price_col in row and ask_vol_col in row:
                                snapshot['asks'].append([float(row[ask_price_col]), float(row[ask_vol_col])])
                    else:
                        # Fallback to positional indexing
                        vals = list(row.values())
                        start_idx = 1 if "Unnamed: 0" in row else 0
                        features = vals[start_idx:start_idx+40] if len(vals) >= start_idx + 40 else vals[start_idx:]
                        
                        if len(features) < 40:
                            logger.warning(f"Insufficient features in CSV row: {len(features)}/40")
                            continue
                        
                        current_bids = []
                        current_asks = []
                        
                        for i in range(0, 20, 2):
                            if i+1 < len(features):
                                current_bids.append([float(features[i]), float(features[i+1])])
                        
                        for i in range(20, 40, 2):
                            if i+1 < len(features):
                                current_asks.append([float(features[i]), float(features[i+1])])
                        
                        snapshot["bids"] = current_bids
                        snapshot["asks"] = current_asks
                
                    # Calc mid price from top levels
                    if snapshot["bids"] and snapshot["asks"]:
                        snapshot["mid_price"] = (snapshot["bids"][0][0] + snapshot["asks"][0][0]) / 2
                    
                except (ValueError, KeyError, IndexError) as e:
                    logger.error(f"CSV parsing error: {e}")
                    continue
                
                try:
                    session.raw_snapshot_queue.put_nowait(snapshot)
                except queue.Full:
                    await asyncio.sleep(0.01)
                    
                await asyncio.sleep(0.1) # Throttled playback speed
                
    except Exception as e:
        logger.error(f"CSV Replay Error: {e}")


# --------------------------------------------------
# Simulation Loop (FALLBACK)
# --------------------------------------------------

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

                # Trim buffer if exceeds max size
                if len(data_buffer) > MAX_BUFFER_SIZE:
                    data_buffer.pop(0)

                await manager.broadcast(processed)

                total_latency = processing_time  # DB + queue already removed
                metrics.record_snapshot(total_latency, processing_time)

            await asyncio.sleep(0.005)
        except Exception as e:
            logger.error(f"Processed broadcast error: {e}")
            await asyncio.sleep(0.05)


def analytics_worker():
    """Runs heavy analytics off the event loop with adaptive processing."""
    global engine_mode, cpp_client
    logger.info(f"Analytics worker started (engine: {engine_mode})")
    
    consecutive_cpp_failures = 0
    MAX_CPP_FAILURES = 5

    while True:
        try:
            snapshot = raw_snapshot_queue.get()
            if snapshot is None:
                continue

            # Check if we should process this snapshot (adaptive mode)
            if not adaptive_processor.should_process(snapshot):
                continue  # Skip processing to catch up

            # Process using snapshot processor service
            processed, processing_time, used_engine, consecutive_cpp_failures = snapshot_processor.process(
                snapshot, consecutive_cpp_failures
            )

            # Record processing time for adaptive mode
            adaptive_processor.record_processing_time(processing_time)

            processed["engine"] = used_engine  # Track which engine processed this
            processed_snapshot_queue.put((processed, processing_time))
            metrics.record_engine_latency(used_engine.replace("_fallback", ""), processing_time)

        except KeyError as e:
            metrics.record_error("analytics_worker_missing_field")
            logger.error(f"Analytics worker missing field error: {e}")
        except ValueError as e:
            metrics.record_error("analytics_worker_value_error")
            logger.error(f"Analytics worker value error: {e}")
        except Exception as e:
            metrics.record_error("analytics_worker_error")
            logger.error(f"Analytics worker unexpected error: {e}", exc_info=True)


# live ingestion
async def live_grpc_loop():
    global MODE
    
    logger.info("Starting live gRPC loop...")
    
    while True:  # Retry loop
        try:
            logger.info("Attempting to connect to market_ingestor...")
            async with grpc.aio.insecure_channel("localhost:6000") as channel:
                stub = live_pb2_grpc.LiveFeedServiceStub(channel)
                logger.info("Connected to market_ingestor gRPC service")

                async for msg in stub.StreamSnapshots(
                    live_pb2.SubscribeRequest(source="BINANCE")
                ):
                    if MODE != "LIVE":
                        logger.debug(f"Skipping message, MODE={MODE}")
                        continue

                    logger.info(f"Received live snapshot: symbol={msg.symbol}, mid_price={msg.mid_price}")

                    snapshot = {
                        # analytics timestamp remains internal / synthetic
                        "timestamp": datetime.utcnow().isoformat(),

                        # LIVE-specific timestamps
                        "exchange_ts": msg.exchange_ts,
                        "ingest_ts": msg.ingest_ts,

                        "bids": [[l.price, l.volume] for l in msg.bids],
                        "asks": [[l.price, l.volume] for l in msg.asks],
                        "mid_price": msg.mid_price,
                        "symbol": msg.symbol,
                        "source": msg.source
                    }

                    try:
                        raw_snapshot_queue.put_nowait(snapshot)
                        logger.debug("Successfully queued live snapshot")
                    except queue.Full:
                        metrics.record_error("live_queue_full")
                        logger.warning("Live snapshot queue is full")
                        
        except Exception as e:
            logger.error(f"Live gRPC loop error: {e}")
            logger.info("Retrying connection to market_ingestor in 5 seconds...")
            await asyncio.sleep(5)  # Wait before retrying


@app.post("/strategy/{session_id}/start")
async def start_strategy(session_id: str):
    """Start the paper trading strategy for a session"""
    strategy = strategy_manager.get_or_create(session_id)
    strategy.start()
    return {"status": "started", "session_id": session_id, "is_active": strategy.is_active}

@app.post("/strategy/{session_id}/stop")
async def stop_strategy(session_id: str):
    """Stop the paper trading strategy for a session"""
    strategy = strategy_manager.get_or_create(session_id)
    strategy.stop()
    return {"status": "stopped", "session_id": session_id, "is_active": strategy.is_active}

@app.post("/strategy/{session_id}/reset")
async def reset_strategy(session_id: str):
    """Reset the paper trading strategy for a session"""
    strategy = strategy_manager.get_or_create(session_id)
    strategy.reset()
    return {
        "status": "reset",
        "session_id": session_id,
        "is_active": strategy.is_active,
        "pnl": {
            "realized": strategy.pnl,
            "unrealized": 0.0,
            "total": strategy.pnl,
            "position": strategy.position
        }
    }

# Backward compatibility endpoints (no session_id in path)
@app.post("/strategy/start")
async def start_strategy_default():
    """Start strategy for default session (backward compatibility)"""
    # Use first active session or return error
    sessions = session_manager.sessions
    if not sessions:
        return {"status": "error", "message": "No active sessions found. Please establish a WebSocket connection first."}
    session_id = next(iter(sessions.keys()))
    return await start_strategy(session_id)

@app.post("/strategy/stop")
async def stop_strategy_default():
    """Stop strategy for default session (backward compatibility)"""
    sessions = session_manager.sessions
    if not sessions:
        return {"status": "error", "message": "No active sessions found."}
    session_id = next(iter(sessions.keys()))
    return await stop_strategy(session_id)

@app.post("/strategy/reset")
async def reset_strategy_default():
    """Reset strategy for default session (backward compatibility)"""
    sessions = session_manager.sessions
    if not sessions:
        return {"status": "error", "message": "No active sessions found."}
    session_id = next(iter(sessions.keys()))
    return await reset_strategy(session_id)

# --------------------------------------------------
# CSV Replay Loop (FALLBACK 2)
# --------------------------------------------------

# to ingest live data
async def live_snapshot_ingest(snapshot: dict):
    """
    Unified LIVE entrypoint.
    This mirrors replay → analytics path exactly.
    """
    if MODE != "LIVE":
        return

    # Optional symbol filter
    if ACTIVE_SYMBOL and snapshot.get("symbol") != ACTIVE_SYMBOL:
        return

    try:
        raw_snapshot_queue.put_nowait(snapshot)
    except queue.Full:
        metrics.record_error("live_queue_full")
        logger.warning("LIVE queue full, dropping snapshot")


# --------------------------------------------------
# Database Replay Loop (CORE LOGIC)
# --------------------------------------------------

# --------------------------------------------------
# Startup Hook
# --------------------------------------------------
        logger.warning("Database close timed out")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# --------------------------------------------------
# WebSocket Endpoint with Session Support
# --------------------------------------------------
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint with session support."""
    # Get or create session
    session = await session_manager.get_session(session_id)
    if not session:
        session = await session_manager.create_session(session_id)
        
        # Start session-specific tasks with async worker
        asyncio.create_task(session_analytics_worker_async(session))
        
        # Special case for ModelTest: Use CSV Replay
        if "model-test" in session_id:
            logger.info(f"Session {session_id} identified as ModelTest. Using CSV Replay.")
            asyncio.create_task(session_csv_replay_loop(session, "../l2_clean.csv"))
        else:
            asyncio.create_task(session_replay_loop(session))
            
        asyncio.create_task(session_broadcast_loop(session))
    
    await manager.connect(websocket, session_id)
    
    try:
        # Send initial history
        await websocket.send_json({
            "type": "history",
            "data": list(session.data_buffer),
            "session_id": session_id
        })
        
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received message from session {session_id}: {data}")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --------------------------------------------------
# Session-Based Replay Control Endpoints
# --------------------------------------------------
@app.post("/replay/{session_id}/start")
async def start_replay(session_id: str):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.start()
    session.replay_buffer.clear()
    return {"status": "started", **session.get_state()}

@app.post("/replay/{session_id}/pause")
async def pause_replay(session_id: str):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.pause()
    return {"status": "paused", **session.get_state()}

@app.post("/replay/{session_id}/resume")
async def resume_replay(session_id: str):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.resume()
    return {"status": "resumed", **session.get_state()}

@app.post("/replay/{session_id}/stop")
async def stop_replay(session_id: str):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.stop()
    return {"status": "stopped", **session.get_state()}

@app.post("/replay/{session_id}/speed/{value}")
async def set_speed(session_id: str, value: int):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    session.set_speed(value)
    return {"status": "success", "speed": session.speed, **session.get_state()}

@app.get("/replay/{session_id}/state")
async def get_replay_state(session_id: str):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    return session.get_state()

@app.post("/replay/{session_id}/goback/{seconds}")
async def go_back(session_id: str, seconds: float):
    session = await session_manager.get_session(session_id)
    if not session:
        return {"status": "error", "message": "Session not found"}
    
    if session.go_back(seconds):
        return {"status": "success", "message": f"Rewound by {seconds}s", **session.get_state()}
    else:
        return {"status": "error", "message": "Cannot rewind"}

# --------------------------------------------------
# Session Management Endpoints
# --------------------------------------------------
@app.get("/sessions")
async def get_all_sessions():
    """Get all active sessions."""
    return session_manager.get_stats()

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a specific session and cleanup resources."""
    # Cleanup session
    await session_manager.delete_session(session_id)
    
    # Cleanup model buffers
    inference_engine.cleanup_session(session_id)
    
    # Cleanup strategy
    strategy_manager.cleanup_session(session_id)
    
    return {"status": "success", "message": f"Session {session_id} deleted"}


@app.post("/mode")
async def set_mode(payload: dict):
    global MODE, ACTIVE_SYMBOL, ACTIVE_SOURCE

    mode = payload.get("mode")
    symbol = payload.get("symbol")
    source = payload.get("source", "BINANCE")

    if mode not in ["REPLAY", "LIVE", "SIMULATION"]:
        return {"status": "error", "message": "Invalid mode"}

    MODE = mode

    if mode == "LIVE":
        ACTIVE_SYMBOL = symbol or "BTCUSDT"
        ACTIVE_SOURCE = source
        
        # Notify market_ingestor about symbol change
        try:
            async with grpc.aio.insecure_channel("localhost:6000") as channel:
                stub = live_pb2_grpc.LiveFeedServiceStub(channel)
                response = await stub.ChangeSymbol(
                    live_pb2.ChangeSymbolRequest(symbol=ACTIVE_SYMBOL)
                )
                if not response.success:
                    logger.warning(f"Failed to change symbol in market_ingestor: {response.message}")
        except Exception as e:
            logger.error(f"Error communicating with market_ingestor: {e}")
    else:
        ACTIVE_SYMBOL = None
        ACTIVE_SOURCE = None

    logger.info(f"Switched MODE={MODE}, SYMBOL={ACTIVE_SYMBOL}")
    return {
        "status": "success",
        "mode": MODE,
        "symbol": ACTIVE_SYMBOL,
        "source": ACTIVE_SOURCE
    }

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

@app.get("/anomalies/quote-stuffing")
def get_quote_stuffing_events():
    """Get recent quote stuffing events (rapid order fire/cancel)."""
    events = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "QUOTE_STUFFING":
                    events.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "update_rate": a.get("update_rate"),
                        "avg_rate": a.get("avg_rate"),
                        "mid_price": snap.get("mid_price")
                    })
    return events

@app.get("/anomalies/layering")
def get_layering_events():
    """Get recent layering/spoofing events (stacked fake orders)."""
    events = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "LAYERING":
                    events.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "side": a.get("side"),
                        "score": a.get("score"),
                        "large_order_count": a.get("large_order_count"),
                        "mid_price": snap.get("mid_price")
                    })
    return events

@app.get("/anomalies/momentum-ignition")
def get_momentum_ignition_events():
    """Get recent momentum ignition events (aggressive orders triggering algos)."""
    events = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "MOMENTUM_IGNITION":
                    events.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "price_change_pct": a.get("price_change_pct"),
                        "volume": a.get("volume"),
                        "direction": a.get("direction"),
                        "mid_price": snap.get("mid_price")
                    })
    return events

@app.get("/anomalies/wash-trading")
def get_wash_trading_events():
    """Get recent wash trading events (self-trading patterns)."""
    events = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "WASH_TRADING":
                    events.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "avg_volume": a.get("avg_volume"),
                        "volume_variance": a.get("volume_variance"),
                        "pattern_count": a.get("pattern_count"),
                        "mid_price": snap.get("mid_price")
                    })
    return events

@app.get("/anomalies/iceberg-orders")
def get_iceberg_order_events():
    """Get recent iceberg order detections (hidden large orders)."""
    events = []
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") == "ICEBERG_ORDER":
                    events.append({
                        "timestamp": snap.get("timestamp"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "price": a.get("price"),
                        "side": a.get("side"),
                        "fill_count": a.get("fill_count"),
                        "total_volume": a.get("total_volume"),
                        "avg_fill_size": a.get("avg_fill_size"),
                        "mid_price": snap.get("mid_price")
                    })
    return events

@app.get("/anomalies/summary")
def get_anomalies_summary():
    """Get summary statistics of all advanced anomaly types."""
    summary = {
        "quote_stuffing": 0,
        "layering": 0,
        "momentum_ignition": 0,
        "wash_trading": 0,
        "iceberg_orders": 0,
        "spoofing": 0,
        "liquidity_gaps": 0
    }
    
    for snap in data_buffer:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                anomaly_type = a.get("type", "").lower().replace("_", "")
                if "quotestuffing" in anomaly_type:
                    summary["quote_stuffing"] += 1
                elif "layering" in anomaly_type:
                    summary["layering"] += 1
                elif "momentumignition" in anomaly_type:
                    summary["momentum_ignition"] += 1
                elif "washtrading" in anomaly_type:
                    summary["wash_trading"] += 1
                elif "icebergorder" in anomaly_type:
                    summary["iceberg_orders"] += 1
                elif "spoofing" in anomaly_type:
                    summary["spoofing"] += 1
                elif "liquiditygap" in anomaly_type:
                    summary["liquidity_gaps"] += 1
    
    return summary

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
    """Health check endpoint for load balancers and monitoring."""
    stats = metrics.get_stats()
    
    # Check if system is healthy
    is_healthy = True
    issues = []
    
    # Check 1: Database connection
    db_healthy = False
    try:
        if db_engine:
            pool_stats = get_pool_stats()
            db_healthy = pool_stats["active"] >= 0  # Basic connectivity check
    except Exception as e:
        issues.append(f"Database check failed: {str(e)}")
    
    # Check 2: Are we processing data?
    if stats["last_snapshot_ago_seconds"] and stats["last_snapshot_ago_seconds"] > 10:
        is_healthy = False
        issues.append(f"No data processed in {stats['last_snapshot_ago_seconds']}s")
    
    # Check 3: Error rate
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
    stats = metrics.get_stats()
    stats["active_websocket_connections"] = len(manager.active_connections)
    stats["buffer_size"] = len(data_buffer)
    stats["db_pool"] = get_pool_stats()
    return stats

@app.get("/db/pool")
def database_pool_stats():
    """Get detailed database connection pool statistics."""
    return get_pool_stats()

@app.get("/db/health")
def database_health():
    """Check database connection pool health."""
    pool_stats = get_pool_stats()
    
    is_healthy = True
    issues = []
    
    if pool_stats["status"] != "active":
        is_healthy = False
        issues.append("Pool not initialized")
    elif pool_stats["failed_acquisitions"] > 10:
        is_healthy = False
        issues.append(f"High failure rate: {pool_stats['failed_acquisitions']} failed acquisitions")
    elif pool_stats["utilization_percent"] > 90:
        issues.append(f"High utilization: {pool_stats['utilization_percent']}%")
    
    if pool_stats["status"] == "active" and pool_stats.get("avg_acquisition_time_ms", 0) > 50:
        issues.append(f"Slow acquisitions: {pool_stats['avg_acquisition_time_ms']}ms avg")
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "issues": issues,
        "pool_stats": pool_stats
    }

@app.get("/benchmark/latency")
def latency_benchmark():
    """Compare Python vs C++ engine performance."""
    def avg(x): return sum(x) / len(x) if x else 0

    return {
        "python_avg_ms": round(avg(metrics.py_latency), 3),
        "cpp_avg_ms": round(avg(metrics.cpp_latency), 3),
        "python_samples": len(metrics.py_latency),
        "cpp_samples": len(metrics.cpp_latency),
        "winner": "cpp" if avg(metrics.cpp_latency) < avg(metrics.py_latency) else "python"
    }

@app.get("/engine/status")
def engine_status():
    """Get current analytics engine status and configuration."""
    return {
        "active_engine": engine_mode,
        "cpp_enabled": USE_CPP_ENGINE,
        "cpp_host": CPP_ENGINE_HOST,
        "cpp_port": CPP_ENGINE_PORT,
        "cpp_available": cpp_client is not None,
        "fallback_available": True  # Python engine always available
    }

@app.post("/engine/switch/{target_engine}")
def switch_engine(target_engine: str):
    """Manually switch between C++ and Python engines."""
    global engine_mode, cpp_client
    
    if target_engine not in ["cpp", "python"]:
        return {"status": "error", "message": "Invalid engine. Choose 'cpp' or 'python'"}
    
    if target_engine == "cpp":
        if not USE_CPP_ENGINE:
            return {"status": "error", "message": "C++ engine disabled in configuration"}
        
        # Try to reinitialize C++ engine (uses lock internally)
        success = initialize_cpp_engine()
        if success:
            return {"status": "success", "message": "Switched to C++ engine", "engine": engine_mode}
        else:
            return {"status": "error", "message": "C++ engine unavailable, using Python", "engine": engine_mode}
    
    elif target_engine == "python":
        with engine_state_lock:
            engine_mode = "python"
        logger.info("Manually switched to Python engine")
        return {"status": "success", "message": "Switched to Python engine", "engine": engine_mode}

@app.post("/engine/benchmark")
async def run_benchmark():
    """Run comprehensive benchmark comparing both engines."""
    if engine_mode != "cpp" or cpp_client is None:
        return {"status": "error", "message": "C++ engine not available for benchmarking"}
    
    test_snapshot = {
        "timestamp": "2024-01-01T00:00:00",
        "bids": [[100.0 - i*0.01, 100 + i*10] for i in range(10)],
        "asks": [[100.0 + i*0.01, 100 + i*10] for i in range(10)],
        "mid_price": 100.0
    }
    
    # Warmup
    for _ in range(10):
        engine.process_snapshot(test_snapshot)
        cpp_client.process_snapshot(test_snapshot)
    
    # Benchmark Python
    py_times = []
    for _ in range(100):
        start = time.time()
        engine.process_snapshot(test_snapshot)
        py_times.append((time.time() - start) * 1000)
    
    # Benchmark C++
    cpp_times = []
    for _ in range(100):
        try:
            result = cpp_client.process_snapshot(test_snapshot)
            cpp_times.append(result.get("latency_ms", 0))
        except Exception as e:
            return {"status": "error", "message": f"C++ benchmark failed: {e}"}
    
    py_avg = sum(py_times) / len(py_times)
    cpp_avg = sum(cpp_times) / len(cpp_times)
    
    return {
        "status": "success",
        "python": {
            "avg_ms": round(py_avg, 3),
            "min_ms": round(min(py_times), 3),
            "max_ms": round(max(py_times), 3),
            "p50_ms": round(sorted(py_times)[50], 3),
            "p95_ms": round(sorted(py_times)[95], 3),
            "p99_ms": round(sorted(py_times)[99], 3)
        },
        "cpp": {
            "avg_ms": round(cpp_avg, 3),
            "min_ms": round(min(cpp_times), 3),
            "max_ms": round(max(cpp_times), 3),
            "p50_ms": round(sorted(cpp_times)[50], 3),
            "p95_ms": round(sorted(cpp_times)[95], 3),
            "p99_ms": round(sorted(cpp_times)[99], 3)
        },
        "speedup": round(py_avg / cpp_avg, 2) if cpp_avg > 0 else 0,
        "winner": "cpp" if cpp_avg < py_avg else "python"
    }
# Priority #14: Trade Data Integration API Endpoints
@app.get("/trades/classification")
def get_trade_classification():
    """Get recent trade classifications (buy/sell side)."""
    trades = []
    for snap in data_buffer[-100:]:  # Last 100 snapshots
        if snap.get("trade_classified"):
            trades.append({
                "timestamp": snap.get("timestamp"),
                "price": snap.get("last_trade_price"),
                "volume": snap.get("trade_volume"),
                "side": snap.get("trade_side"),
                "mid_price": snap.get("mid_price"),
                "effective_spread": snap.get("effective_spread")
            })
    return {"trades": trades, "count": len(trades)}

@app.get("/trades/spreads")
def get_trade_spreads():
    """Get effective and realized spreads over time."""
    spreads = []
    for snap in data_buffer[-100:]:
        if snap.get("trade_classified"):
            spreads.append({
                "timestamp": snap.get("timestamp"),
                "effective_spread": snap.get("effective_spread", 0),
                "realized_spread": snap.get("realized_spread", 0),
                "trade_side": snap.get("trade_side"),
                "mid_price": snap.get("mid_price")
            })
    
    # Calculate statistics
    if spreads:
        effective = [s["effective_spread"] for s in spreads]
        realized = [s["realized_spread"] for s in spreads]
        
        stats = {
            "effective_spread": {
                "mean": round(np.mean(effective), 4),
                "std": round(np.std(effective), 4),
                "min": round(min(effective), 4),
                "max": round(max(effective), 4)
            },
            "realized_spread": {
                "mean": round(np.mean(realized), 4),
                "std": round(np.std(realized), 4),
                "min": round(min(realized), 4),
                "max": round(max(realized), 4)
            }
        }
    else:
        stats = {
            "effective_spread": {"mean": 0, "std": 0, "min": 0, "max": 0},
            "realized_spread": {"mean": 0, "std": 0, "min": 0, "max": 0}
        }
    
    return {
        "spreads": spreads,
        "count": len(spreads),
        "statistics": stats
    }

@app.get("/trades/vpin")
def get_vpin():
    """Get V-PIN (Volume-Synchronized Probability of Informed Trading) history."""
    vpin_data = []
    for snap in data_buffer[-100:]:
        if "vpin" in snap and snap["vpin"] > 0:
            vpin_data.append({
                "timestamp": snap.get("timestamp"),
                "vpin": snap["vpin"],
                "mid_price": snap.get("mid_price"),
                "obi": snap.get("obi", 0)
            })
    
    # Calculate statistics
    if vpin_data:
        vpins = [v["vpin"] for v in vpin_data]
        stats = {
            "mean": round(np.mean(vpins), 4),
            "std": round(np.std(vpins), 4),
            "min": round(min(vpins), 4),
            "max": round(max(vpins), 4),
            "current": round(vpins[-1], 4) if vpins else 0
        }
    else:
        stats = {"mean": 0, "std": 0, "min": 0, "max": 0, "current": 0}
    
    return {
        "vpin_history": vpin_data,
        "count": len(vpin_data),
        "statistics": stats,
        "interpretation": {
            "low": "V-PIN < 0.3: Low informed trading probability",
            "medium": "0.3 ≤ V-PIN < 0.6: Moderate informed trading",
            "high": "V-PIN ≥ 0.6: High informed trading probability (potential adverse selection)"
        }
    }

@app.get("/trades/anomalies")
def get_trade_anomalies():
    """Get trade-level anomalies (unusual sizes, rapid trading, etc.)."""
    trade_anomalies = []
    for snap in data_buffer[-100:]:
        if "anomalies" in snap:
            for a in snap["anomalies"]:
                if a.get("type") in ["UNUSUAL_TRADE_SIZE", "RAPID_TRADING"]:
                    trade_anomalies.append({
                        "timestamp": snap.get("timestamp"),
                        "type": a.get("type"),
                        "severity": a.get("severity"),
                        "message": a.get("message"),
                        "details": {
                            k: v for k, v in a.items() 
                            if k not in ["type", "severity", "message", "timestamp"]
                        }
                    })
    return {
        "anomalies": trade_anomalies,
        "count": len(trade_anomalies)
    }