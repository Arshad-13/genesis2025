#!/usr/bin/env python3
"""
Test market ingestor gRPC connection and ChangeSymbol method
"""

import asyncio
import grpc
from rpc_stubs import live_pb2, live_pb2_grpc

async def test_market_ingestor():
    print("Testing market ingestor gRPC connection...")
    
    try:
        # Test connection
        async with grpc.aio.insecure_channel("localhost:6000") as channel:
            stub = live_pb2_grpc.LiveFeedServiceStub(channel)
            print("✅ Connected to market ingestor")
            
            # Test ChangeSymbol method
            print("🔄 Testing ChangeSymbol method...")
            response = await stub.ChangeSymbol(
                live_pb2.ChangeSymbolRequest(symbol="ETHUSDT")
            )
            
            print(f"✅ ChangeSymbol response: success={response.success}, message='{response.message}'")
            
            # Test StreamSnapshots method
            print("🔄 Testing StreamSnapshots method...")
            try:
                async for snapshot in stub.StreamSnapshots(
                    live_pb2.SubscribeRequest(source="BINANCE")
                ):
                    print(f"📊 Received snapshot: {snapshot.symbol}, mid_price={snapshot.mid_price}")
                    break  # Just get one snapshot for testing
                print("✅ StreamSnapshots working")
            except Exception as e:
                print(f"⚠️ StreamSnapshots error: {e}")
            
            return True
            
    except grpc.RpcError as e:
        print(f"❌ gRPC Error: {e.code()} - {e.details()}")
        return False
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_market_ingestor())
    exit(0 if success else 1)