#!/usr/bin/env python3
"""
Test creating a new session to trigger database connection
"""

import asyncio
import websockets
import json
import uuid

async def test_new_session():
    session_id = f"test-session-{uuid.uuid4().hex[:8]}"
    uri = f"ws://localhost:8000/ws/{session_id}"
    
    try:
        print(f"Creating new session: {session_id}")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected!")
            
            # Wait for initial message
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)
            print(f"📨 Received: {data.get('type', 'unknown')}")
            
            # Keep connection alive briefly
            await asyncio.sleep(2)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_new_session())