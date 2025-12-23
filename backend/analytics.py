import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.cluster import KMeans
from collections import deque

class MarketSimulator:
    def __init__(self):
        self.current_price = 100.0
        self.spread_mean = 0.05
        self.spread_std = 0.02
        self.time_step = timedelta(milliseconds=100)
        self.current_time = datetime.now()
        self.tick_size = 0.01
        self.depth_levels = 10
        self.cumulative_volume = 0
        self.last_trade_price = 100.0
        
        # Feature I: Endogenous Price Impact
        self.last_ofi = 0
        self.impact_coeff = 0.05 # Price impact per unit of normalized OFI
        
        # Feature J: Interactive Trading Desk
        self.pending_orders = []

    def update_ofi(self, ofi):
        """Updates the internal OFI state for price impact calculation."""
        self.last_ofi = ofi
        
    def place_order(self, side, quantity):
        """Receives an order from the user (via WebSocket)."""
        self.pending_orders.append({'side': side, 'quantity': quantity})

    def generate_snapshot(self):
        self.current_time += self.time_step
        
        # Feature I: Endogenous Price Impact
        # Price change is driven by Order Flow Imbalance + Noise
        impact = self.last_ofi * self.impact_coeff
        noise = np.random.normal(0, 0.05)
        shock = impact + noise
        
        # Feature J: Process User Orders
        user_trade_vol = 0
        user_trade_dir = 0
        
        if self.pending_orders:
            for order in self.pending_orders:
                qty = order['quantity']
                if order['side'] == 'buy':
                    shock += 0.5 # Buying pushes price up significantly
                    user_trade_vol += qty
                    user_trade_dir = 1
                elif order['side'] == 'sell':
                    shock -= 0.5 # Selling pushes price down
                    user_trade_vol += qty
                    user_trade_dir = -1
            self.pending_orders = [] # Clear processed orders
            
        self.current_price += shock
        
        # Simulate Spread Regime
        is_shock = np.random.random() < 0.05
        spread = max(self.tick_size, np.random.normal(self.spread_mean, self.spread_std))
        if is_shock:
            spread *= np.random.uniform(3, 5)
            
        mid_price = self.current_price
        best_bid = mid_price - (spread / 2)
        best_ask = mid_price + (spread / 2)
        
        # Generate Depth (L2 Data)
        bids = []
        asks = []
        pressure = np.clip(shock * 2, -0.5, 0.5)
        
        for i in range(self.depth_levels):
            bid_px = round(best_bid - (i * self.tick_size), 2)
            ask_px = round(best_ask + (i * self.tick_size), 2)
            vol_shape = 1000 * (1 + np.exp(-0.5 * (i - 2)**2)) 
            
            bid_vol = int(max(10, np.random.normal(vol_shape, vol_shape*0.2)) * (1 + pressure))
            ask_vol = int(max(10, np.random.normal(vol_shape, vol_shape*0.2)) * (1 - pressure))
            
            # HFT Noise Filter
            if np.random.random() < 0.1:
                bid_vol = int(bid_vol * 0.1)
                ask_vol = int(ask_vol * 0.1)

            bids.append([bid_px, bid_vol])
            asks.append([ask_px, ask_vol])
            
        # Simulate Trades (Feature G: Volume Generation)
        # Trade probability increases with volatility (shock)
        trade_vol = 0
        trade_direction = 0 # 0: None, 1: Buy, -1: Sell
        
        if user_trade_vol > 0:
            trade_vol = user_trade_vol
            trade_direction = user_trade_dir
            self.last_trade_price = best_ask if user_trade_dir == 1 else best_bid
            self.cumulative_volume += trade_vol
        elif np.random.random() < (0.3 + abs(shock)):
            trade_vol = int(np.random.exponential(100))
            # Direction depends on pressure
            if pressure > 0: # Buy Aggressor
                self.last_trade_price = best_ask
                trade_direction = 1
            else: # Sell Aggressor
                self.last_trade_price = best_bid
                trade_direction = -1
            self.cumulative_volume += trade_vol
        
        return {
            "timestamp": self.current_time.isoformat(),
            "mid_price": round(mid_price, 2),
            "bids": bids,
            "asks": asks,
            "spread": round(spread, 4),
            "trade_volume": trade_vol,
            "trade_direction": trade_direction,
            "cumulative_volume": self.cumulative_volume,
            "last_trade_price": round(self.last_trade_price, 2)
        }

class AnalyticsEngine:
    def __init__(self):
        self.history = []
        self.window_size = 600 
        
        # Feature F: Market State Clusters
        self.feature_history = deque(maxlen=600)
        self.kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        self.is_fitted = False
        self.last_train_time = datetime.now()
        self.regime_labels = {0: "Calm", 1: "Stressed", 2: "Execution Hot", 3: "Manipulation Suspected"}
        
        # Feature G: Microprice Divergence
        self.tick_size = 0.01
        
        # Feature F: OFI State
        self.prev_best_bid = None
        self.prev_best_ask = None
        self.prev_bid_q = 0
        self.prev_ask_q = 0
        
        # Feature H: V-PIN (Volume-Synchronized Probability of Informed Trading)
        self.bucket_size = 1000 # Volume per bucket
        self.current_bucket_vol = 0
        self.current_bucket_buy = 0
        self.current_bucket_sell = 0
        self.bucket_history = deque(maxlen=50) # Rolling window of Order Imbalances (OI)

    def process_snapshot(self, snapshot):
        bids = snapshot['bids']
        asks = snapshot['asks']
        
        # L1 Metrics
        best_bid_px, best_bid_q = bids[0]
        best_ask_px, best_ask_q = asks[0]
        
        # --- Feature F: Order Flow Imbalance (OFI) ---
        ofi = 0
        if self.prev_best_bid is not None:
            # Bid OFI
            if best_bid_px > self.prev_best_bid:
                ofi += best_bid_q
            elif best_bid_px < self.prev_best_bid:
                ofi -= self.prev_bid_q
            else: # Price unchanged
                ofi += (best_bid_q - self.prev_bid_q)
            
            # Ask OFI (Inverted logic for supply)
            if best_ask_px > self.prev_best_ask:
                ofi += self.prev_ask_q
            elif best_ask_px < self.prev_best_ask:
                ofi -= best_ask_q
            else:
                ofi -= (best_ask_q - self.prev_ask_q)
        
        # Update state for next tick
        self.prev_best_bid = best_bid_px
        self.prev_best_ask = best_ask_px
        self.prev_bid_q = best_bid_q
        self.prev_ask_q = best_ask_q
        
        # Normalize OFI (simple scaling for UI)
        ofi_normalized = np.clip(ofi / 500, -1, 1) # Assuming avg size ~500

        # --- Feature H: V-PIN Calculation ---
        trade_vol = snapshot.get('trade_volume', 0)
        trade_dir = snapshot.get('trade_direction', 0)
        
        if trade_vol > 0:
            self.current_bucket_vol += trade_vol
            if trade_dir == 1:
                self.current_bucket_buy += trade_vol
            elif trade_dir == -1:
                self.current_bucket_sell += trade_vol
                
            # Check if bucket is full
            if self.current_bucket_vol >= self.bucket_size:
                # Calculate Order Imbalance for this bucket
                oi = abs(self.current_bucket_buy - self.current_bucket_sell)
                self.bucket_history.append(oi)
                
                # Reset bucket (Carry over excess logic omitted for simplicity, just reset)
                self.current_bucket_vol = 0
                self.current_bucket_buy = 0
                self.current_bucket_sell = 0
        
        # Calculate V-PIN
        vpin = 0
        if len(self.bucket_history) > 0:
            # V-PIN = Sum(|OI|) / (N * BucketSize)
            # Or more accurately: Sum(|OI|) / Sum(TotalVolume)
            # Since TotalVolume per bucket is roughly BucketSize
            total_oi = sum(self.bucket_history)
            total_vol = len(self.bucket_history) * self.bucket_size
            vpin = total_oi / total_vol
            
        spread = best_ask_px - best_bid_px
        mid_price = snapshot['mid_price']
        
        # Multi-level Weighted OBI
        sum_bid_q = sum(b[1] for b in bids[:5])
        sum_ask_q = sum(a[1] for a in asks[:5])
        total_q_5 = sum_bid_q + sum_ask_q
        obi = (sum_bid_q - sum_ask_q) / total_q_5 if total_q_5 > 0 else 0
        
        # Microprice
        total_q_1 = best_bid_q + best_ask_q
        if total_q_1 > 0:
            microprice = (best_bid_q * best_ask_px + best_ask_q * best_bid_px) / total_q_1
        else:
            microprice = (best_ask_px + best_bid_px) / 2

        # Divergence
        divergence = microprice - mid_price
        divergence_score = divergence / self.tick_size
        directional_prob = 1 / (1 + np.exp(-2 * divergence_score))
        
        snapshot['spread'] = round(spread, 4)
        snapshot['obi'] = round(obi, 4)
        snapshot['ofi'] = round(ofi_normalized, 4)
        snapshot['vpin'] = round(vpin, 4) # Feature H
        snapshot['microprice'] = round(microprice, 2)
        snapshot['divergence'] = round(divergence, 4)
        snapshot['directional_prob'] = round(directional_prob * 100, 1)
        
        # Add L1 fields
        snapshot['best_bid'] = best_bid_px
        snapshot['best_ask'] = best_ask_px
        snapshot['q_bid'] = best_bid_q
        snapshot['q_ask'] = best_ask_q
        
        # Feature F: Market State Clusters
        self.history.append(mid_price)
        if len(self.history) > self.window_size:
            self.history.pop(0)
            
        volatility = 0
        if len(self.history) > 20:
            prices = np.array(self.history[-20:])
            log_returns = np.diff(np.log(prices))
            volatility = np.std(log_returns) * 1000
            
        spread_mean = 0.05
        spread_std = 0.02
        spread_z = (spread - spread_mean) / spread_std
        
        # Updated Feature Vector with OFI
        feature_vector = [spread_z, abs(obi), volatility, abs(ofi_normalized)]
        self.feature_history.append(feature_vector)
        
        # Clustering
        regime = 0
        if len(self.feature_history) > 50:
            if not self.is_fitted or (datetime.now() - self.last_train_time).seconds > 10:
                X = np.array(self.feature_history)
                self.kmeans.fit(X)
                self.is_fitted = True
                self.last_train_time = datetime.now()
                
                centers = self.kmeans.cluster_centers_
                # Stress score = Spread Z + Volatility + OFI Impact
                stress_scores = centers[:, 0] + centers[:, 2] + centers[:, 3]
                sorted_indices = np.argsort(stress_scores)
                self.cluster_map = {original_idx: new_rank for new_rank, original_idx in enumerate(sorted_indices)}

            raw_cluster = self.kmeans.predict([feature_vector])[0]
            regime = self.cluster_map.get(raw_cluster, 0)
            
        snapshot['regime'] = regime
        snapshot['regime_label'] = self.regime_labels.get(regime, "Unknown")

        # Anomalies
        anomalies = []
        if abs(obi) > 0.5:
            anomalies.append({
                "type": "HEAVY_IMBALANCE",
                "severity": "high",
                "message": f"Heavy {'BUY' if obi > 0 else 'SELL'} Pressure (OBI: {obi:.2f})"
            })
        if regime == 1:
             anomalies.append({
                "type": "REGIME_STRESS",
                "severity": "medium",
                "message": f"Market Regime: Stressed (Vol: {volatility:.4f})"
            })
        if regime == 3:
             anomalies.append({
                "type": "REGIME_CRISIS",
                "severity": "critical",
                "message": f"Market Regime: CRITICAL/MANIPULATION"
            })
        
        snapshot['anomalies'] = anomalies
        return snapshot
    
def db_row_to_snapshot(row):
    bids = []
    asks = []

    for i in range(1, 11):
        bids.append([
            float(row[f"bid_price_{i}"]),
            float(row[f"bid_volume_{i}"])
        ])
        asks.append([
            float(row[f"ask_price_{i}"]),
            float(row[f"ask_volume_{i}"])
        ])

    # Compute mid-price from L1
    best_bid = bids[0][0]
    best_ask = asks[0][0]
    mid_price = (best_bid + best_ask) / 2

    snapshot = {
        "timestamp": row["ts"],
        "bids": bids,
        "asks": asks,
        "mid_price": round(mid_price, 2)
    }

    return snapshot
