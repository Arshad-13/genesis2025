import asyncio
from datetime import datetime
import grpc
import time

from binance_depth import BinanceDepthClient
from rpc_stubs import live_pb2, live_pb2_grpc


class SmartQueue:
    """Intelligent queue with overflow handling for market data"""
    def __init__(self, maxsize=50):
        self.queue = asyncio.Queue(maxsize=maxsize)
        self.maxsize = maxsize
        self.dropped_count = 0
        self.last_drop_time = None
        self.consecutive_drops = 0
        
    async def put_smart(self, item):
        """Put item with intelligent overflow handling"""
        try:
            # Try non-blocking put first
            self.queue.put_nowait(item)
            self._reset_drop_counter()
            return True
            
        except asyncio.QueueFull:
            # Queue is full, handle overflow intelligently
            return await self._handle_overflow(item)
    
    async def _handle_overflow(self, item):
        """Handle queue overflow by making space"""
        try:
            # Remove oldest item to make space for newest
            old_item = self.queue.get_nowait()
            self.queue.put_nowait(item)
            
            self.consecutive_drops += 1
            self.dropped_count += 1
            self.last_drop_time = time.time()
            
            # Log with escalating severity
            if self.consecutive_drops <= 3:
                print(f"[QUEUE_OVERFLOW] Dropped oldest snapshot #{self.consecutive_drops} to make space")
            elif self.consecutive_drops <= 10:
                print(f"[QUEUE_OVERFLOW] Persistent overflow #{self.consecutive_drops} - high data rate")
            else:
                print(f"[QUEUE_OVERFLOW] Critical overflow #{self.consecutive_drops} - backend may be slow")
            
            return True
            
        except asyncio.QueueEmpty:
            # Queue somehow became empty, just put the item
            try:
                self.queue.put_nowait(item)
                return True
            except asyncio.QueueFull:
                # Still full, drop the new item as last resort
                self.dropped_count += 1
                print(f"[QUEUE_OVERFLOW] Dropped new snapshot - queue management failed")
                return False
    
    def _reset_drop_counter(self):
        """Reset drop counter on successful put"""
        if self.consecutive_drops > 0:
            print(f"[QUEUE_RECOVERY] Queue overflow recovered after {self.consecutive_drops} drops")
            self.consecutive_drops = 0
    
    async def get(self):
        """Get item from queue"""
        return await self.queue.get()
    
    def empty(self):
        """Check if queue is empty"""
        return self.queue.empty()
    
    def get_nowait(self):
        """Get item without waiting"""
        return self.queue.get_nowait()
    
    def qsize(self):
        """Get current queue size"""
        return self.queue.qsize()
    
    def get_stats(self):
        """Get queue statistics"""
        return {
            "queue_size": self.queue.qsize(),
            "max_size": self.maxsize,
            "utilization_percent": (self.queue.qsize() / self.maxsize) * 100,
            "total_dropped": self.dropped_count,
            "consecutive_drops": self.consecutive_drops,
            "last_drop_ago_seconds": time.time() - self.last_drop_time if self.last_drop_time else None
        }


class LiveFeedServicer(live_pb2_grpc.LiveFeedServiceServicer):
    def __init__(self):
        self.queue = SmartQueue(maxsize=50)  # Use smart queue instead
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
