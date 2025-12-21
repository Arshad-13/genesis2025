from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from analytics import MarketSimulator, AnalyticsEngine
import asyncio
from typing import List
import uvicorn
import json

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle potential disconnection during broadcast
                pass

manager = ConnectionManager()

simulator = MarketSimulator()
engine = AnalyticsEngine()

# In-memory buffer for the dashboard
data_buffer = []
MAX_BUFFER = 100

@app.on_event("startup")
async def start_generator():
    # Start a background task to generate data
    asyncio.create_task(generate_data())

async def generate_data():
    while True:
        raw_snapshot = simulator.generate_snapshot()
        processed_snapshot = engine.process_snapshot(raw_snapshot)
        
        data_buffer.append(processed_snapshot)
        if len(data_buffer) > MAX_BUFFER:
            data_buffer.pop(0)
        
        # Broadcast to all connected clients
        await manager.broadcast(processed_snapshot)
            
        await asyncio.sleep(0.1) # 100ms interval

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial buffer so client has history immediately
        await websocket.send_json({"type": "history", "data": data_buffer})
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/features")
async def get_features():
    """Returns the latest buffer of time-series data."""
    return data_buffer

@app.get("/anomalies")
async def get_anomalies():
    """Returns a list of timestamps and types for the 'Anomaly Timeline' markers."""
    anomalies_list = []
    for snapshot in data_buffer:
        if snapshot.get("anomalies"):
            for anomaly in snapshot["anomalies"]:
                anomalies_list.append({
                    "timestamp": snapshot["timestamp"],
                    "type": anomaly["type"],
                    "severity": anomaly["severity"],
                    "message": anomaly["message"]
                })
    return anomalies_list

@app.get("/snapshot/latest")
async def get_latest_snapshot():
    """Returns the single latest snapshot for the inspector."""
    if not data_buffer:
        return {}
    return data_buffer[-1]
    """Returns the single latest snapshot for the inspector."""
    if not data_buffer:
        return {}
    return data_buffer[-1]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
