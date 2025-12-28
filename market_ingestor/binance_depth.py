import asyncio
import json
import websockets
from datetime import datetime

DEBUG_LIVE_SNAPSHOTS = True   # flip to False to disable

class BinanceDepthClient:
    def __init__(self, symbol: str, depth: int = 20):
        self.symbol = symbol.lower()
        self.depth = depth
        self.ws_url = f"wss://stream.binance.com:9443/ws/{self.symbol}@depth{depth}@100ms"

        self.bids = {}
        self.asks = {}

    def _apply_updates(self, side_dict, updates):
        for price, qty in updates:
            price = float(price)
            qty = float(qty)
            if qty == 0.0:
                side_dict.pop(price, None)
            else:
                side_dict[price] = qty

    def _snapshot(self):
        bids = sorted(self.bids.items(), reverse=True)[:self.depth]
        asks = sorted(self.asks.items())[:self.depth]

        if not bids or not asks:
            return None

        mid = (bids[0][0] + asks[0][0]) / 2

        return {
            "symbol": self.symbol.upper(),
            "exchange_ts": datetime.utcnow().isoformat(),
            "bids": bids,
            "asks": asks,
            "mid_price": mid
        }

    async def stream(self, out_queue: asyncio.Queue):
        while True:  # Retry loop for WebSocket reconnections
            try:
                print(f"[BINANCE_CLIENT] Connecting to: {self.ws_url}")
                async with websockets.connect(self.ws_url, ping_interval=20) as ws:
                    print(f"[BINANCE_CLIENT] Connected to Binance WebSocket for {self.symbol.upper()}")
                    async for msg in ws:
                        try:
                            data = json.loads(msg)

                            self._apply_updates(self.bids, data.get("bids", []))
                            self._apply_updates(self.asks, data.get("asks", []))

                            snap = self._snapshot()
                            if snap:
                                if DEBUG_LIVE_SNAPSHOTS:
                                    print(
                                        "[INGESTOR LIVE SNAP]",
                                        {
                                            "ts": snap["exchange_ts"],
                                            "symbol": snap["symbol"],
                                            "mid": snap["mid_price"],
                                            "best_bid": snap["bids"][0] if snap["bids"] else None,
                                            "best_ask": snap["asks"][0] if snap["asks"] else None,
                                        }
                                    )

                                await out_queue.put_smart(snap)
                        except json.JSONDecodeError as e:
                            print(f"[BINANCE_CLIENT] JSON decode error: {e}")
                        except Exception as e:
                            print(f"[BINANCE_CLIENT] Error processing message: {e}")
            except Exception as e:
                print(f"[BINANCE_CLIENT] WebSocket connection error: {e}")
                print("[BINANCE_CLIENT] Reconnecting in 3 seconds...")
                await asyncio.sleep(3)  # Wait before reconnecting

