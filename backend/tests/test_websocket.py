#!/usr/bin/env python3
"""
Simple WebSocket client to test the backend data processing.
This will establish a WebSocket connection to trigger the data processing loops.
"""

import asyncio
import websockets
import json
import sys

async def test_websocket():
    uri = "ws://localhost:8000/ws/test-session-123"
    
    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected!")
            
            # Wait for initial history message
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"📨 Received initial message: {data.get('type', 'unknown')}")
                
                if data.get('type') == 'history':
                    print(f"📊 History data length: {len(data.get('data', []))}")
                
            except asyncio.TimeoutError:
                print("⏰ No initial message received within 5 seconds")
            
            # Keep connection alive for a bit to let data processing start
            print("🔄 Keeping connection alive for 10 seconds to start data processing...")
            await asyncio.sleep(10)
            
            # Try to receive some data
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(message)
                print(f"📈 Received data: {data.get('timestamp', 'no timestamp')}")
            except asyncio.TimeoutError:
                print("⏰ No data received within 2 seconds")
            
            print("✅ Test completed successfully")
            
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Starting WebSocket test...")
    success = asyncio.run(test_websocket())
    
    if success:
        print("✅ WebSocket test completed")
        sys.exit(0)
    else:
        print("❌ WebSocket test failed")
        sys.exit(1)