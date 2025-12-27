import asyncio
from datetime import datetime
import grpc

from binance_depth import BinanceDepthClient
from rpc_stubs import live_pb2, live_pb2_grpc


class LiveFeedServicer(live_pb2_grpc.LiveFeedServiceServicer):
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=50)
        self.current_client = None
        self.current_symbol = None

    async def ChangeSymbol(self, request, context):
        """Change the symbol being streamed"""
        try:
            symbol = request.symbol.upper()
            print(f"[MARKET_INGESTOR] Changing symbol to {symbol}")
            await self._start_client(symbol)
            
            return live_pb2.ChangeSymbolResponse(
                success=True,
                message=f"Successfully switched to {symbol}"
            )
        except Exception as e:
            print(f"[MARKET_INGESTOR] Error changing symbol: {e}")
            return live_pb2.ChangeSymbolResponse(
                success=False,
                message=f"Failed to change symbol: {str(e)}"
            )

    async def _start_client(self, symbol):
        """Start a new Binance client for the given symbol"""
        if self.current_client:
            # Stop existing client if any
            # Note: WebSocket will be closed when the task is cancelled
            pass
            
        self.current_symbol = symbol.lower()
        self.current_client = BinanceDepthClient(self.current_symbol)
        
        # Clear the queue of old data
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        # Start streaming
        asyncio.create_task(self.current_client.stream(self.queue))
        print(f"[MARKET_INGESTOR] Started streaming {symbol}")

    async def StreamSnapshots(self, request, context):
        # Default to BTCUSDT if no specific symbol requested
        if not self.current_client:
            await self._start_client("BTCUSDT")
            
        while True:
            try:
                snap = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                
                yield live_pb2.LiveSnapshot(
                    source="BINANCE",
                    symbol=snap["symbol"],
                    exchange_ts=snap["exchange_ts"],
                    ingest_ts=datetime.utcnow().isoformat(),
                    bids=[
                        live_pb2.PriceLevel(price=p, volume=v)
                        for p, v in snap["bids"]
                    ],
                    asks=[
                        live_pb2.PriceLevel(price=p, volume=v)
                        for p, v in snap["asks"]
                    ],
                    mid_price=snap["mid_price"]
                )
            except asyncio.TimeoutError:
                # Send heartbeat or continue
                continue
            except Exception as e:
                print(f"[MARKET_INGESTOR] Stream error: {e}")
                break

    async def change_symbol(self, symbol):
        """Change the symbol being streamed"""
        await self._start_client(symbol)


async def serve():
    server = grpc.aio.server()
    servicer = LiveFeedServicer()

    live_pb2_grpc.add_LiveFeedServiceServicer_to_server(
        servicer, server
    )

    server.add_insecure_port("[::]:6000")
    await server.start()
    print("[MARKET_INGESTOR] gRPC server started on port 6000")

    await server.wait_for_termination()


if __name__ == "__main__":
    print("[MARKET_INGESTOR] Starting market data ingestor...")
    asyncio.run(serve())
