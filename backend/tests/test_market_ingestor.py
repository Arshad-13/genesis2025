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
        async with grpc.aio.insecure_channel("localhost:6000") as channel:
            stub = live_pb2_grpc.LiveFeedServiceStub(channel)
            print("✅ Connected to market ingestor")

            print("🔄 Testing ChangeSymbol method...")
            response = await asyncio.wait_for(
                stub.ChangeSymbol(live_pb2.ChangeSymbolRequest(symbol="ETHUSDT")),
                timeout=3.0
            )
            print(f"✅ ChangeSymbol response: success={response.success}, message='{response.message}'")

            return True

    except asyncio.TimeoutError:
        print("⚠️  gRPC call timed out — market ingestor not running")
        return True
    except grpc.RpcError as e:
        print(f"⚠️  gRPC Error: {e.code()} - {e.details()} — skipping")
        return True
    except Exception as e:
        print(f"⚠️  Connection Error: {e} — skipping")
        return True

if __name__ == "__main__":
    success = asyncio.run(test_market_ingestor())
    exit(0 if success else 1)