import logging
from datetime import datetime
from collections import deque
import numpy as np

logger = logging.getLogger(__name__)

class BaseStrategy:
    def __init__(self, name: str):
        self.name = name
        self.pnl = 0.0
        self.position = 0.0  # Contracts/Coins
        self.entry_price = 0.0
        self.trades = []
        self.is_active = False
        self.entry_time = None
        
        # Strategy Parameters (Tuned via Config UI)
        self.config = {
            "stop_loss_pct": 0.015,       # 1.5% SL
            "take_profit_pct": 0.03,      # 3% TP
            "position_size": 0.5,        # 0.5 units
            "max_duration_seconds": 180,  # 3 minutes
            "confidence_threshold": 0.15,
            
            # Specific parameters
            "ofi_threshold": 0.3,
            "z_score_threshold": 2.0,
            "vpin_max": 0.7,
            "spoof_threshold": 0.6,
        }

    def start(self):
        self.is_active = True
        logger.info(f"Strategy {self.name} STARTED")

    def stop(self):
        self.is_active = False

    def reset(self):
        self.position = 0.0
        self.entry_price = 0.0
        self.pnl = 0.0
        self.trades = []
        self.is_active = False
        self.entry_time = None

    def _open_position(self, side_multiplier, price, side_str, timestamp, confidence=1.0):
        self.position = side_multiplier * self.config["position_size"]
        self.entry_price = price
        try:
            self.entry_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00')) if isinstance(timestamp, str) else timestamp
        except Exception:
            self.entry_time = datetime.utcnow()
            
        trade = {
            "id": len(self.trades) + 1,
            "timestamp": timestamp if isinstance(timestamp, str) else str(timestamp),
            "side": side_str,
            "price": price,
            "size": abs(self.position),
            "type": "ENTRY",
            "confidence": confidence,
            "pnl": 0.0,
            "strategy": self.name
        }
        self.trades.append(trade)
        logger.info(f"[{self.name}] ENTRY: {side_str} @ {price:.2f}")
        return trade

    def _close_position(self, price, side_str, timestamp):
        trade_pnl = 0.0
        if self.position > 0:
            trade_pnl = (price - self.entry_price) * self.position
        else:
            trade_pnl = (self.entry_price - price) * abs(self.position)
            
        self.pnl += trade_pnl
        
        trade = {
            "id": len(self.trades) + 1,
            "timestamp": timestamp if isinstance(timestamp, str) else str(timestamp),
            "side": side_str,
            "price": price,
            "size": abs(self.position),
            "type": "EXIT",
            "pnl": trade_pnl,
            "strategy": self.name
        }
        self.trades.append(trade)
        logger.info(f"[{self.name}] EXIT: {side_str} @ {price:.2f} (PnL: {trade_pnl:.2f})")
        
        self.position = 0.0
        self.entry_price = 0.0
        self.entry_time = None
        return trade

    def check_risk(self, current_price, timestamp):
        if self.position == 0:
            return None
            
        # 1. Stop Loss & Take Profit
        pnl_pct = 0.0
        if self.position > 0:
            pnl_pct = (current_price - self.entry_price) / self.entry_price
        else:
            pnl_pct = (self.entry_price - current_price) / self.entry_price
            
        if pnl_pct <= -self.config["stop_loss_pct"]:
            side = "SELL" if self.position > 0 else "BUY"
            logger.info(f"[{self.name}] Stop-Loss triggered at {current_price:.2f}")
            return self._close_position(current_price, side, timestamp)
            
        if pnl_pct >= self.config["take_profit_pct"]:
            side = "SELL" if self.position > 0 else "BUY"
            logger.info(f"[{self.name}] Take-Profit triggered at {current_price:.2f}")
            return self._close_position(current_price, side, timestamp)
            
        # 2. Position Timeout
        if self.entry_time:
            try:
                now = datetime.fromisoformat(timestamp.replace('Z', '+00:00')) if isinstance(timestamp, str) else timestamp
            except Exception:
                now = datetime.utcnow()
            if (now - self.entry_time).total_seconds() > self.config["max_duration_seconds"]:
                side = "SELL" if self.position > 0 else "BUY"
                logger.info(f"[{self.name}] Position duration timeout triggered")
                return self._close_position(current_price, side, timestamp)
                
        return None


class MomentumBreakoutStrategy(BaseStrategy):
    def __init__(self):
        super().__init__("Momentum Breakout")

    def process_signal(self, prediction, snapshot):
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
        mid_price = snapshot.get('mid_price', (best_bid + best_ask) / 2)
        timestamp = snapshot.get('timestamp')
        
        # Check risk first
        risk_trade = self.check_risk(mid_price, timestamp)
        if risk_trade:
            return risk_trade

        if not self.is_active:
            return None

        # Logic: OFI and Prediction alignment
        ofi = snapshot.get('obi', 0.0)
        prob_up = prediction.get('up', 0.0)
        prob_down = prediction.get('down', 0.0)

        if self.position == 0:
            if ofi > self.config["ofi_threshold"] and prob_up > self.config["confidence_threshold"]:
                return self._open_position(1.0, best_ask, "BUY", timestamp, prob_up)
            elif ofi < -self.config["ofi_threshold"] and prob_down > self.config["confidence_threshold"]:
                return self._open_position(-1.0, best_bid, "SELL", timestamp, prob_down)
        else:
            if self.position > 0 and (ofi < -self.config["ofi_threshold"] or prob_down > 0.3):
                return self._close_position(best_bid, "SELL", timestamp)
            elif self.position < 0 and (ofi > self.config["ofi_threshold"] or prob_up > 0.3):
                return self._close_position(best_ask, "BUY", timestamp)
        return None


class MeanReversionStrategy(BaseStrategy):
    def __init__(self):
        super().__init__("Mean Reversion")
        self.prices = deque(maxlen=100)

    def process_signal(self, prediction, snapshot):
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
        mid_price = snapshot.get('mid_price', (best_bid + best_ask) / 2)
        timestamp = snapshot.get('timestamp')
        
        self.prices.append(mid_price)
        
        risk_trade = self.check_risk(mid_price, timestamp)
        if risk_trade:
            return risk_trade

        if not self.is_active:
            return None

        if len(self.prices) < 20:
            return None

        mean_val = np.mean(self.prices)
        std_val = np.std(self.prices)
        std_safe = std_val if std_val > 1e-5 else 1.0
        z_score = (mid_price - mean_val) / std_safe
        vpin = snapshot.get('vpin', 0.0)

        # Revert on extreme z-score with low toxicity
        if self.position == 0:
            if z_score < -self.config["z_score_threshold"] and vpin < self.config["vpin_max"]:
                return self._open_position(1.0, best_ask, "BUY", timestamp)
            elif z_score > self.config["z_score_threshold"] and vpin < self.config["vpin_max"]:
                return self._open_position(-1.0, best_bid, "SELL", timestamp)
        else:
            if self.position > 0 and z_score >= 0.0:
                return self._close_position(best_bid, "SELL", timestamp)
            elif self.position < 0 and z_score <= 0.0:
                return self._close_position(best_ask, "BUY", timestamp)
        return None


class SpoofingCounterStrategy(BaseStrategy):
    def __init__(self):
        super().__init__("Spoofing Counter")

    def process_signal(self, prediction, snapshot):
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
        mid_price = snapshot.get('mid_price', (best_bid + best_ask) / 2)
        timestamp = snapshot.get('timestamp')
        
        risk_trade = self.check_risk(mid_price, timestamp)
        if risk_trade:
            return risk_trade

        if not self.is_active:
            return None

        # Spoofing risk is 0 to 1
        spoofing_risk = snapshot.get('spoofing_risk', 0.0)

        if self.position == 0:
            # High spoofing risk indicates artificial bid pressure. Fade it (Go Short).
            if spoofing_risk > self.config["spoof_threshold"]:
                return self._open_position(-1.0, best_bid, "SELL", timestamp)
        else:
            if spoofing_risk < self.config["spoof_threshold"] * 0.4:
                return self._close_position(best_ask, "BUY", timestamp)
        return None


class MarketMakingStrategy(BaseStrategy):
    def __init__(self):
        super().__init__("Market Making")

    def process_signal(self, prediction, snapshot):
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
        mid_price = snapshot.get('mid_price', (best_bid + best_ask) / 2)
        timestamp = snapshot.get('timestamp')
        
        risk_trade = self.check_risk(mid_price, timestamp)
        if risk_trade:
            return risk_trade

        if not self.is_active:
            return None

        prob_up = prediction.get('up', 0.5)
        prob_down = prediction.get('down', 0.5)

        if self.position == 0:
            # Place buy order or sell order based on prediction skew
            if prob_up > prob_down:
                return self._open_position(1.0, best_bid, "BUY", timestamp)
            else:
                return self._open_position(-1.0, best_ask, "SELL", timestamp)
        else:
            # Exit to pocket the spread
            if self.position > 0:
                return self._close_position(best_ask, "SELL", timestamp)
            else:
                return self._close_position(best_bid, "BUY", timestamp)
        return None


class PortfolioEngine:
    def __init__(self):
        self.strategies = {
            "momentum": MomentumBreakoutStrategy(),
            "mean_reversion": MeanReversionStrategy(),
            "spoofing_counter": SpoofingCounterStrategy(),
            "market_making": MarketMakingStrategy()
        }
        self.pnl = 0.0
        self.position = 0.0
        self.is_active = False
        self.trades = []
        
        # Portfolio level risk parameters
        self.max_drawdown = -50.0  # Stop trading if cumulative loss exceeds $50
        self.circuit_breaker_tripped = False

    def start(self):
        self.is_active = True
        for s in self.strategies.values():
            s.start()
        logger.info("Portfolio Engine STARTED")

    def stop(self):
        self.is_active = False
        for s in self.strategies.values():
            s.stop()
        logger.info("Portfolio Engine STOPPED")

    def reset(self):
        self.pnl = 0.0
        self.position = 0.0
        self.is_active = False
        self.trades = []
        self.circuit_breaker_tripped = False
        for s in self.strategies.values():
            s.reset()
        logger.info("Portfolio Engine RESET")

    def set_config(self, strategy_key: str, params: dict):
        if strategy_key in self.strategies:
            self.strategies[strategy_key].config.update(params)
            logger.info(f"Updated config for {strategy_key}: {params}")

    def process_signal(self, prediction, snapshot):
        if self.circuit_breaker_tripped:
            return None

        # Check circuit breaker
        if self.pnl <= self.max_drawdown:
            self.circuit_breaker_tripped = True
            self.stop()
            logger.warning(f"CIRCUIT BREAKER TRIPPED! P&L ({self.pnl:.2f}) breached Max Drawdown ({self.max_drawdown:.2f})")
            # Force close all open positions
            timestamp = snapshot.get('timestamp')
            best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
            best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
            for name, strat in self.strategies.items():
                if strat.position != 0:
                    strat._close_position(best_bid if strat.position > 0 else best_ask, 
                                          "SELL" if strat.position > 0 else "BUY", 
                                          timestamp)
            return None

        trade_event = None
        
        # Process signal on each strategy
        for name, strat in self.strategies.items():
            res = strat.process_signal(prediction, snapshot)
            if res:
                trade_event = res
                self.trades.append(res)

        # Aggregate PnL and Position
        realized_pnl = sum(s.pnl for s in self.strategies.values())
        self.pnl = realized_pnl
        self.position = sum(s.position for s in self.strategies.values())

        # Aggregate unrealized PnL
        best_bid = snapshot['bids'][0][0] if snapshot['bids'] else 0.0
        best_ask = snapshot['asks'][0][0] if snapshot['asks'] else 0.0
        
        unrealized_pnl = 0.0
        strategy_stats = {}
        for name, s in self.strategies.items():
            strat_unrealized = 0.0
            if s.position > 0:
                strat_unrealized = (best_bid - s.entry_price) * s.position
            elif s.position < 0:
                strat_unrealized = (s.entry_price - best_ask) * abs(s.position)
            
            unrealized_pnl += strat_unrealized
            strategy_stats[name] = {
                "realized": float(s.pnl),
                "unrealized": float(strat_unrealized),
                "total": float(s.pnl + strat_unrealized),
                "position": float(s.position),
                "is_active": bool(s.is_active)
            }

        return {
            "trade_event": trade_event,
            "pnl": {
                "realized": float(self.pnl),
                "unrealized": float(unrealized_pnl),
                "total": float(self.pnl + unrealized_pnl),
                "position": float(self.position),
                "is_active": bool(self.is_active),
                "circuit_tripped": bool(self.circuit_breaker_tripped),
                "strategies": strategy_stats
            }
        }

# Alias for backwards compatibility
StrategyEngine = PortfolioEngine
