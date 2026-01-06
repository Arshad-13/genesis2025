
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class StrategyEngine:
    def __init__(self):
        self.pnl = 0.0
        self.position = 0.0  # +1 for Long, -1 for Short, 0 for Flat
        self.entry_price = 0.0
        self.trades = []
        
        # Configuration
        self.CONFIDENCE_THRESHOLD = 0.23
        self.EXIT_THRESHOLD = 0.22
        self.MAX_POSITION = 1.0 # 1 BTC
        self.is_active = False # Default to Stopped

    def start(self):
        self.is_active = True
        logger.info("Strategy Engine STARTED")

    def stop(self):
        """Stop the strategy (no new entries)"""
        self.is_active = False
        
    def reset(self):
        """Reset all PnL and trade history"""
        self.position = 0.0
        self.entry_price = 0.0
        self.pnl = 0.0
        self.trades = []
        self.is_active = False  # Also stop the strategy on reset
        logger.info("Strategy Engine RESET")

    def process_signal(self, prediction, snapshot):
        """
        Process a model prediction and execute paper trades.
        Returns a dict with trade details if a trade occurred, else None.
        """
        # Always calculate PnL updates even if stopped (for unrealized/marking to market)
        # But only OPEN new positions if active.
        
        if not prediction or not snapshot:
            return None

        # Extract market data
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0
        mid_price = snapshot.get('mid_price', (best_bid + best_ask) / 2)
        timestamp = snapshot.get('timestamp')
        
        # Ensure timestamp is a string (ISO format)
        if timestamp and not isinstance(timestamp, str):
            from datetime import datetime
            if isinstance(timestamp, datetime):
                timestamp = timestamp.isoformat()
            else:
                timestamp = str(timestamp)

        prob_up = prediction['up']
        prob_down = prediction['down']
        prob_neutral = prediction['neutral']
        
        trade_event = None

        # --- Entry Logic (Only if Active) ---
        if self.is_active and self.position == 0:
            if prob_up > self.CONFIDENCE_THRESHOLD:
                # BUY (Long) at Ask
                self._open_position(1.0, best_ask, "BUY", timestamp, prob_up)
                trade_event = self.trades[-1]
                
            elif prob_down > self.CONFIDENCE_THRESHOLD:
                # SELL (Short) at Bid
                self._open_position(-1.0, best_bid, "SELL", timestamp, prob_down)
                trade_event = self.trades[-1]

        # --- Exit Logic (Always allow exiting if we have a position, or maybe only if active? 
        # Usually you want to allow exits even if "stopped" from new entries, but for simple toggle
        # let's assume "Stop" means "Pause new entries". Existing positions should probably be managed.
        # Let's keep exit logic active to protect capital.)
        elif self.position > 0: # Long
            # Exit if Neutral or Down signal is strong
            if prob_neutral > self.EXIT_THRESHOLD or prob_down > self.EXIT_THRESHOLD:
                 pnl = self._close_position(best_bid, "SELL", timestamp)
                 trade_event = self.trades[-1]
                 
        elif self.position < 0: # Short
            # Exit if Neutral or Up signal is strong
            if prob_neutral > self.EXIT_THRESHOLD or prob_up > self.EXIT_THRESHOLD:
                 pnl = self._close_position(best_ask, "BUY", timestamp)
                 trade_event = self.trades[-1]

        # Update unrealized PnL in the return object if holding
        unrealized_pnl = 0.0
        if self.position > 0:
            unrealized_pnl = (best_bid - self.entry_price) * self.position
        elif self.position < 0:
            unrealized_pnl = (self.entry_price - best_ask) * abs(self.position)

        return {
            "trade_event": trade_event,
            "pnl": {
                "realized": self.pnl,
                "unrealized": unrealized_pnl,
                "total": self.pnl + unrealized_pnl,
                "position": self.position,
                "is_active": self.is_active
            }
        }

    def _open_position(self, side_multiplier, price, side_str, timestamp, confidence):
        self.position = side_multiplier
        self.entry_price = price
        
        trade = {
            "id": len(self.trades) + 1,
            "timestamp": timestamp,
            "side": side_str,
            "price": price,
            "size": abs(self.position),
            "type": "ENTRY",
            "confidence": confidence,
            "pnl": 0.0
        }
        self.trades.append(trade)
        logger.info(f"Strategy ENTRY: {side_str} @ {price} (Conf: {confidence:.2f})")

    def _close_position(self, price, side_str, timestamp):
        # Calc PnL
        # Long (pos=1): SellPrice - EntryPrice
        # Short (pos=-1): EntryPrice - BuyPrice
        trade_pnl = 0.0
        if self.position > 0:
            trade_pnl = price - self.entry_price
        else:
            trade_pnl = self.entry_price - price
            
        self.pnl += trade_pnl
        
        trade = {
            "id": len(self.trades) + 1,
            "timestamp": timestamp,
            "side": side_str,
            "price": price,
            "size": abs(self.position),
            "type": "EXIT",
            "pnl": trade_pnl
        }
        self.trades.append(trade)
        logger.info(f"Strategy EXIT: {side_str} @ {price} (PnL: {trade_pnl:.2f})")
        
        self.position = 0.0
        self.entry_price = 0.0
        return trade_pnl
