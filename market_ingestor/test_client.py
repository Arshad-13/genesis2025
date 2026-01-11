#!/usr/bin/env python3
"""
Simple test client to verify market_ingestor is getting realtime data from Binance
"""
import asyncio
import grpc
from rpc_stubs import live_pb2, live_pb2_grpc
from datetime import datetime

async def test_realtime_data():
    """Test if market_ingestor can get realtime data"""
    try:
        # Connect to the market_ingestor gRPC server
        channel = grpc.aio.insecure_channel('localhost:6000')
        stub = live_pb2_grpc.LiveFeedServiceStub(channel)
        
        print("Connecting to market_ingestor on localhost:6000...")
        
        # Test 1: Change symbol to BTCUSDT
        print("Testing symbol change to BTCUSDT...")
        change_request = live_pb2.ChangeSymbolRequest(symbol="BTCUSDT")
        change_response = await stub.ChangeSymbol(change_request)
        
        if change_response.success:
            print(f"Symbol change successful: {change_response.message}")
        else:
            print(f"Symbol change failed: {change_response.message}")
            return False
        
        # Test 2: Stream snapshots for a few seconds
        print("Testing realtime data stream...")
        subscribe_request = live_pb2.SubscribeRequest(source="BINANCE")
        
        snapshot_count = 0
        start_time = datetime.now()
        
        async for snapshot in stub.StreamSnapshots(subscribe_request):
            snapshot_count += 1
            
            # Parse exchange timestamp
            exchange_time = datetime.fromisoformat(snapshot.exchange_ts.replace('Z', '+00:00'))
            ingest_time = datetime.fromisoformat(snapshot.ingest_ts.replace('Z', '+00:00'))
            
            # Check if data is recent (within last 10 seconds)
            time_diff = (datetime.now() - exchange_time.replace(tzinfo=None)).total_seconds()
            
            print(f"📈 Snapshot #{snapshot_count}:")
            print(f"   Symbol: {snapshot.symbol}")
            print(f"   Exchange Time: {snapshot.exchange_ts}")
            print(f"   Ingest Time: {snapshot.ingest_ts}")
            print(f"   Mid Price: ${snapshot.mid_price:.2f}")
            print(f"   Best Bid: ${snapshot.bids[0].price:.2f} (Vol: {snapshot.bids[0].volume:.4f})")
            print(f"   Best Ask: ${snapshot.asks[0].price:.2f} (Vol: {snapshot.asks[0].volume:.4f})")
            print(f"   Data Age: {time_diff:.1f} seconds")
            
            # Check if data is realtime (less than 10 seconds old)
            if time_diff < 10:
                print("✅ Data appears to be REALTIME!")
            else:
                print(f"⚠️  Data seems old ({time_diff:.1f}s ago)")
            
            print("-" * 50)
            
            # Stop after 5 snapshots or 30 seconds
            if snapshot_count >= 5 or (datetime.now() - start_time).total_seconds() > 30:
                break
        
        await channel.close()
        
        if snapshot_count > 0:
            print(f"SUCCESS: Received {snapshot_count} realtime market snapshots!")
            return True
        else:
            print("FAILED: No data received")
            return False
            
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    print("Testing Market Ingestor Realtime Data Capability...")
    print("=" * 60)
    
    result = asyncio.run(test_realtime_data())
    
    print("=" * 60)
    if result:
        print("CONCLUSION: Market Ingestor CAN get realtime market data!")
    else:
        print("CONCLUSION: Market Ingestor CANNOT get realtime market data!")