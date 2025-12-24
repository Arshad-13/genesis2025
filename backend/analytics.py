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
            
            # Structural Noise Filtering (HFT "Fleeting Orders")
            # Simulate orders that are "too fast" to be real liquidity.
            # We assign a random "lifetime" to this level's update.
            # If lifetime < 50ms, we flag it as noise (in a real system, we'd filter it out).
            # For this simulation, we will just randomly "zero out" some volume to simulate 
            # the filter removing fleeting liquidity.
            is_fleeting = np.random.random() < 0.1 # 10% of updates are fleeting noise
            if is_fleeting:
                # Reduce volume significantly to simulate the filter removing the "fake" part
                bid_vol = int(bid_vol * 0.1)
                ask_vol = int(ask_vol * 0.1)
            
            # Create liquidity gaps (simulate market maker withdrawal)
            # Higher probability of gaps during shock periods
            gap_probability = 0.08 if not is_shock else 0.20
            if np.random.random() < gap_probability:
                # Create a gap by reducing volume to very low levels
                bid_vol = max(5, int(bid_vol * 0.05))  # Very thin liquidity
                ask_vol = max(5, int(ask_vol * 0.05))

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
        
        # Feature F: Market State Clusters
        self.feature_history = deque(maxlen=600)
        self.kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        self.is_fitted = False
        self.last_train_time = datetime.now()
        self.regime_labels = {0: "Calm", 1: "Stressed", 2: "Execution Hot", 3: "Manipulation Suspected"}
        
        # Feature G: Microprice Divergence
        self.tick_size = 0.01
        
        # Feature H: Liquidity Gaps Detection
        self.gap_threshold = 50  # Minimum volume to not be considered a gap

    def process_snapshot(self, snapshot):
        bids = snapshot['bids']
        asks = snapshot['asks']
        
        # L1 Metrics (Top of Book)
        best_bid_px, best_bid_q = bids[0]
        best_ask_px, best_ask_q = asks[0]
        
        spread = best_ask_px - best_bid_px
        mid_price = snapshot['mid_price']
        
        # Multi-level Weighted OBI (Top 5 levels)
        sum_bid_q = sum(b[1] for b in bids[:5])
        sum_ask_q = sum(a[1] for a in asks[:5])
        total_q_5 = sum_bid_q + sum_ask_q
        
        obi = (sum_bid_q - sum_ask_q) / total_q_5 if total_q_5 > 0 else 0
        
        # Microprice Calculation
        total_q_1 = best_bid_q + best_ask_q
        if total_q_1 > 0:
            microprice = (best_bid_q * best_ask_px + best_ask_q * best_bid_px) / total_q_1
        else:
            microprice = (best_ask_px + best_bid_px) / 2

        # Feature G: Microprice Divergence
        divergence = microprice - mid_price
        divergence_score = divergence / self.tick_size # Normalized by tick size
        
        # Directional Probability (Simple sigmoid mapping of divergence)
        # If divergence is +2 ticks, prob -> 100%
        directional_prob = 1 / (1 + np.exp(-2 * divergence_score))
        
        snapshot['spread'] = round(spread, 4)
        snapshot['obi'] = round(obi, 4)
        snapshot['microprice'] = round(microprice, 2)
        snapshot['divergence'] = round(divergence, 4)
        snapshot['directional_prob'] = round(directional_prob * 100, 1)
        
        # Add L1 fields for UI backward compatibility
        snapshot['best_bid'] = best_bid_px
        snapshot['best_ask'] = best_ask_px
        snapshot['q_bid'] = best_bid_q
        snapshot['q_ask'] = best_ask_q
        
        # Feature F: Market State Clusters
        # 1. Calculate Features
        # Volatility (Rolling Log Returns)
        self.history.append(mid_price)
        if len(self.history) > self.window_size:
            self.history.pop(0)
            
        volatility = 0
        if len(self.history) > 20:
            prices = np.array(self.history[-20:])
            log_returns = np.diff(np.log(prices))
            volatility = np.std(log_returns) * 1000 # Scale up
            
        # Spread Z-Score
        spread_mean = 0.05 # Approximate historical mean
        spread_std = 0.02
        spread_z = (spread - spread_mean) / spread_std
        
        # Feature Vector
        feature_vector = [spread_z, abs(obi), volatility, abs(divergence_score)]
        self.feature_history.append(feature_vector)
        
        # 2. Clustering (Online-ish)
        # Retrain every 100 ticks or if not fitted
        regime = 0
        if len(self.feature_history) > 50:
            if not self.is_fitted or (datetime.now() - self.last_train_time).seconds > 10:
                X = np.array(self.feature_history)
                self.kmeans.fit(X)
                self.is_fitted = True
                self.last_train_time = datetime.now()
                
                # Heuristic Labeling: Sort clusters by "Stress" (Spread + Volatility)
                centers = self.kmeans.cluster_centers_
                # Stress score = Spread Z + Volatility
                stress_scores = centers[:, 0] + centers[:, 2]
                sorted_indices = np.argsort(stress_scores)
                
                # Map sorted indices to 0..3
                self.cluster_map = {original_idx: new_rank for new_rank, original_idx in enumerate(sorted_indices)}

            # Predict current
            raw_cluster = self.kmeans.predict([feature_vector])[0]
            regime = self.cluster_map.get(raw_cluster, 0)
            
        snapshot['regime'] = regime
        snapshot['regime_label'] = self.regime_labels.get(regime, "Unknown")

        # 2. Detect Anomalies
        anomalies = []
        
        # A. OBI Threshold
        if abs(obi) > 0.5:
            anomalies.append({
                "type": "HEAVY_IMBALANCE",
                "severity": "high",
                "message": f"Heavy {'BUY' if obi > 0 else 'SELL'} Pressure (OBI: {obi:.2f})"
            })
            
        # B. Spread Shock (Regime Change) - Legacy Logic (kept for compatibility)
        # We can now use the Regime Cluster as well
        if regime == 1: # Stressed
             anomalies.append({
                "type": "REGIME_STRESS",
                "severity": "medium",
                "message": f"Market Regime: Stressed (Vol: {volatility:.4f})"
            })
        if regime == 3: # Manipulation/Crisis
             anomalies.append({
                "type": "REGIME_CRISIS",
                "severity": "critical",
                "message": f"Market Regime: CRITICAL/MANIPULATION"
            })
        
        snapshot['anomalies'] = anomalies
        
        # Feature H: Liquidity Gaps Detection
        liquidity_gaps = self.detect_liquidity_gaps(bids, asks, mid_price)
        snapshot['liquidity_gaps'] = liquidity_gaps
        
        return snapshot
    
    def detect_liquidity_gaps(self, bids, asks, mid_price):
        """
        Detect price levels with zero or minimal liquidity (gaps).
        Returns list of gaps with their risk scores.
        """
        gaps = []
        
        # Analyze bid side for thin liquidity
        for i, (price, volume) in enumerate(bids):
            if volume < self.gap_threshold:
                distance_from_mid = abs(price - mid_price)
                # Risk score: higher when gap is closer to mid and volume is lower
                risk_score = (1 - (volume / self.gap_threshold)) * (1 / (1 + distance_from_mid * 10))
                
                gaps.append({
                    'price': round(price, 2),
                    'volume': volume,
                    'side': 'bid',
                    'risk_score': round(risk_score * 100, 1),
                    'distance_from_mid': round(distance_from_mid, 4),
                    'level': i + 1
                })
        
        # Analyze ask side for thin liquidity
        for i, (price, volume) in enumerate(asks):
            if volume < self.gap_threshold:
                distance_from_mid = abs(price - mid_price)
                risk_score = (1 - (volume / self.gap_threshold)) * (1 / (1 + distance_from_mid * 10))
                
                gaps.append({
                    'price': round(price, 2),
                    'volume': volume,
                    'side': 'ask',
                    'risk_score': round(risk_score * 100, 1),
                    'distance_from_mid': round(distance_from_mid, 4),
                    'level': i + 1
                })
        
        # Sort by risk score (highest first) and return top 5
        gaps.sort(key=lambda x: x['risk_score'], reverse=True)
        return gaps[:5]
