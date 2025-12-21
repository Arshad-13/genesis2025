import numpy as np
import pandas as pd
from datetime import datetime, timedelta

class MarketSimulator:
    def __init__(self):
        self.current_price = 100.0
        self.spread_mean = 0.05
        self.spread_std = 0.02
        self.time_step = timedelta(milliseconds=100)
        self.current_time = datetime.now()
        self.tick_size = 0.01
        self.depth_levels = 10

    def generate_snapshot(self):
        self.current_time += self.time_step
        
        # Random walk for price
        shock = np.random.normal(0, 0.1)
        self.current_price += shock
        
        # Simulate Spread Regime (Normal vs Shock)
        is_shock = np.random.random() < 0.05
        spread = max(self.tick_size, np.random.normal(self.spread_mean, self.spread_std))
        if is_shock:
            spread *= np.random.uniform(3, 5) # Liquidity withdrawal
            
        mid_price = self.current_price
        best_bid = mid_price - (spread / 2)
        best_ask = mid_price + (spread / 2)
        
        # Generate Depth (L2 Data)
        bids = []
        asks = []
        
        # Apply pressure to volumes based on price shock (Directional Liquidity)
        # If price moving up (shock > 0), bids get heavier, asks get lighter
        pressure = np.clip(shock * 2, -0.5, 0.5)
        
        for i in range(self.depth_levels):
            # Price levels
            bid_px = round(best_bid - (i * self.tick_size), 2)
            ask_px = round(best_ask + (i * self.tick_size), 2)
            
            # Volume profile (Liquidity usually thicker a few ticks back)
            vol_shape = 1000 * (1 + np.exp(-0.5 * (i - 2)**2)) 
            
            # Randomize and apply pressure
            bid_vol = int(max(10, np.random.normal(vol_shape, vol_shape*0.2)) * (1 + pressure))
            ask_vol = int(max(10, np.random.normal(vol_shape, vol_shape*0.2)) * (1 - pressure))
            
            bids.append([bid_px, bid_vol])
            asks.append([ask_px, ask_vol])
        
        return {
            "timestamp": self.current_time.isoformat(),
            "mid_price": round(mid_price, 2),
            "bids": bids, # List of [price, qty]
            "asks": asks, # List of [price, qty]
            "spread": round(spread, 4)
        }

class AnalyticsEngine:
    def __init__(self):
        self.history = []
        self.window_size = 600 # 1 minute at 100ms
        
    def process_snapshot(self, snapshot):
        bids = snapshot['bids']
        asks = snapshot['asks']
        
        # L1 Metrics (Top of Book)
        best_bid_px, best_bid_q = bids[0]
        best_ask_px, best_ask_q = asks[0]
        
        spread = best_ask_px - best_bid_px
        
        # Multi-level Weighted OBI (Top 5 levels)
        # We sum the volumes of the top 5 levels to get a "Wall" metric
        sum_bid_q = sum(b[1] for b in bids[:5])
        sum_ask_q = sum(a[1] for a in asks[:5])
        total_q_5 = sum_bid_q + sum_ask_q
        
        obi = (sum_bid_q - sum_ask_q) / total_q_5 if total_q_5 > 0 else 0
        
        # Microprice Calculation (Volume Weighted Price)
        # P_micro = (Q_bid * P_ask + Q_ask * P_bid) / (Q_bid + Q_ask)
        # Using L1 volumes for standard microprice definition
        total_q_1 = best_bid_q + best_ask_q
        if total_q_1 > 0:
            microprice = (best_bid_q * best_ask_px + best_ask_q * best_bid_px) / total_q_1
        else:
            microprice = (best_ask_px + best_bid_px) / 2

        # Update snapshot with calculated metrics
        snapshot['spread'] = round(spread, 4)
        snapshot['obi'] = round(obi, 4)
        snapshot['microprice'] = round(microprice, 2)
        
        # Add L1 fields for UI backward compatibility
        snapshot['best_bid'] = best_bid_px
        snapshot['best_ask'] = best_ask_px
        snapshot['q_bid'] = best_bid_q
        snapshot['q_ask'] = best_ask_q
        
        # 2. Detect Anomalies
        anomalies = []
        
        # A. OBI Threshold
        if abs(obi) > 0.5:
            anomalies.append({
                "type": "HEAVY_IMBALANCE",
                "severity": "high",
                "message": f"Heavy {'BUY' if obi > 0 else 'SELL'} Pressure (OBI: {obi:.2f})"
            })
            
        # B. Spread Shock (Regime Change)
        # We need history for rolling stats
        self.history.append(spread)
        if len(self.history) > self.window_size:
            self.history.pop(0)
            
        # Use 20-period rolling mean for regime detection as per formula
        if len(self.history) >= 20:
            rolling_window = self.history[-20:]
            rolling_mean = np.mean(rolling_window)
            rolling_std = np.std(rolling_window)
            
            # Avoid division by zero or extremely tight spreads causing false positives
            if rolling_std < 0.0001: 
                rolling_std = 0.0001
            
            if spread > (rolling_mean + 2 * rolling_std):
                 anomalies.append({
                    "type": "LIQUIDITY_WITHDRAWAL",
                    "severity": "critical",
                    "message": f"Spread Shock Detected: {spread:.4f} (Mean: {rolling_mean:.4f})"
                })
        
        snapshot['anomalies'] = anomalies
        return snapshot
