import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.cluster import KMeans
from collections import deque, defaultdict
import hashlib
from typing import Dict, List, Tuple, Optional
import threading
import time

class TradeClassifier:
    """
    Implements Lee-Ready algorithm for trade classification.
    Classifies trades as buyer-initiated or seller-initiated.
    """
    
    def __init__(self, tick_size: float = 0.01):
        self.tick_size = tick_size
        self.trade_history = deque(maxlen=1000)  # Track recent trades
        self.last_mid_price = None
        
    def classify_trade(self, trade_price: float, mid_price: float, 
                       best_bid: float, best_ask: float) -> str:
        """
        Classify trade using Lee-Ready algorithm (tick test).
        
        Returns:
            'buy' if buyer-initiated (aggressive buyer)
            'sell' if seller-initiated (aggressive seller)
            'unknown' if cannot determine
        """
        # Tick test: Compare trade price to mid-price
        if trade_price > mid_price:
            return 'buy'  # Above mid-price -> buyer-initiated
        elif trade_price < mid_price:
            return 'sell'  # Below mid-price -> seller-initiated
        else:
            # Trade at mid-price - use quote rule
            spread = best_ask - best_bid
            if spread < self.tick_size:
                return 'unknown'
                
            # Distance from best bid/ask
            dist_from_bid = trade_price - best_bid
            dist_from_ask = best_ask - trade_price
            
            if dist_from_bid < dist_from_ask:
                return 'sell'  # Closer to bid -> seller-initiated
            elif dist_from_ask < dist_from_bid:
                return 'buy'  # Closer to ask -> buyer-initiated
            else:
                return 'unknown'
    
    def calculate_effective_spread(self, trade_price: float, mid_price: float, 
                                   side: str) -> float:
        """
        Calculate effective spread.
        Effective Spread = 2 * |trade_price - mid_price|
        
        For buyer-initiated: 2 * (trade_price - mid_price)
        For seller-initiated: 2 * (mid_price - trade_price)
        """
        if side == 'buy':
            return 2 * (trade_price - mid_price)
        elif side == 'sell':
            return 2 * (mid_price - trade_price)
        else:
            return 2 * abs(trade_price - mid_price)
    
    def calculate_realized_spread(self, trade_price: float, mid_price_before: float,
                                  mid_price_after: float, side: str) -> float:
        """
        Calculate realized spread (price impact measure).
        Realized Spread = 2 * (trade_price - mid_price_after) for buy
                        = 2 * (mid_price_after - trade_price) for sell
        
        Measures the permanent price impact of the trade.
        """
        if side == 'buy':
            return 2 * (trade_price - mid_price_after)
        elif side == 'sell':
            return 2 * (mid_price_after - trade_price)
        else:
            return 0.0
    
    def update_trade_history(self, trade_info: dict):
        """Track trade for analysis."""
        self.trade_history.append({
            'timestamp': trade_info.get('timestamp', datetime.now()),
            'price': trade_info['price'],
            'volume': trade_info['volume'],
            'side': trade_info['side'],
            'effective_spread': trade_info.get('effective_spread', 0),
            'mid_price': trade_info['mid_price']
        })
    
    def detect_trade_anomalies(self) -> List[Dict]:
        """
        Detect unusual trade patterns using shared anomaly detection utilities.
        Returns list of anomaly dictionaries.
        """
        from analytics_core import AnomalyDetectionUtils
        
        anomalies = []
        
        if len(self.trade_history) < 10:
            return anomalies
        
        recent_trades = list(self.trade_history)[-20:]
        volumes = [t['volume'] for t in recent_trades]
        
        # Use shared utility for volume anomaly detection
        volume_anomaly = AnomalyDetectionUtils.detect_volume_anomaly(
            volumes, recent_trades[-1]['volume'] if recent_trades else 0
        )
        if volume_anomaly:
            last_trade = recent_trades[-1]
            anomalies.append({
                'type': 'UNUSUAL_TRADE_SIZE',
                'severity': volume_anomaly['severity'],
                'message': f'Unusual trade size: {last_trade["volume"]} '
                          f'(z-score: {volume_anomaly["z_score"]:.2f})',
                'timestamp': last_trade['timestamp'],
                'trade_volume': last_trade['volume'],
                'avg_volume': volume_anomaly['avg'],
                'z_score': volume_anomaly['z_score']
            })
        
        # Use shared utility for rapid trading detection
        if len(recent_trades) >= 5:
            last_5_trades = recent_trades[-5:]
            rapid_trading = AnomalyDetectionUtils.detect_rapid_trading(
                last_5_trades, threshold_sec=0.1
            )
            if rapid_trading:
                anomalies.append({
                    'type': 'RAPID_TRADING',
                    'severity': 'MEDIUM',
                    'message': rapid_trading['message'],
                    'timestamp': last_5_trades[-1]['timestamp'],
                    'trade_count': rapid_trading['trade_count'],
                    'avg_interval_ms': rapid_trading['avg_interval_ms']
                })
        
        return anomalies

class AnomalyDetectionUtils:
    """Shared utilities for anomaly detection across different modules."""
    
    @staticmethod
    def detect_volume_anomaly(volumes: List[float], current_volume: float, 
                             threshold_sigma: float = 3.0) -> Optional[Dict]:
        """Detect volume anomalies using z-score method."""
        if len(volumes) < 2:
            return None
        
        # Optimization for small lists: avoid numpy overhead
        if len(volumes) < 20:
            avg_volume = sum(volumes) / len(volumes)
            variance = sum((x - avg_volume) ** 2 for x in volumes) / len(volumes)
            std_volume = variance ** 0.5
        else:
            avg_volume = np.mean(volumes)
            std_volume = np.std(volumes)
        
        if std_volume == 0:
            return None
        
        z_score = (current_volume - avg_volume) / std_volume
        
        if abs(z_score) > threshold_sigma:
            return {
                'z_score': z_score,
                'avg': avg_volume,
                'std': std_volume,
                'severity': 'MEDIUM' if abs(z_score) < 5 else 'HIGH'
            }
        return None
    
    @staticmethod
    def detect_rapid_trading(trades: List[Dict], threshold_sec: float = 0.1) -> Optional[Dict]:
        """Detect rapid sequential trading patterns."""
        if len(trades) < 2:
            return None
        
        time_diffs = []
        for i in range(1, len(trades)):
            t1 = trades[i-1].get('timestamp')
            t2 = trades[i].get('timestamp')
            if isinstance(t1, datetime) and isinstance(t2, datetime):
                time_diffs.append((t2 - t1).total_seconds())
        
        if not time_diffs:
            return None
        
        # Optimization: use pure Python for mean of small lists
        if len(time_diffs) < 20:
            avg_interval = sum(time_diffs) / len(time_diffs)
        else:
            avg_interval = np.mean(time_diffs)

        if avg_interval < threshold_sec:
            return {
                'trade_count': len(trades),
                'total_time': sum(time_diffs),
                'avg_interval_ms': avg_interval * 1000,
                'message': f'Rapid sequential trades detected: '
                          f'{len(trades)} trades in {sum(time_diffs):.3f}s'
            }
        return None

class DataValidator:
    """Validates market data snapshots for sanity and completeness."""
    
    @staticmethod
    def validate_snapshot(snapshot: dict) -> Tuple[bool, List[str]]:
        """Validate a market snapshot. Returns (is_valid, list_of_errors)."""
        errors = []
        
        # Check required fields
        required_fields = ['bids', 'asks', 'mid_price']
        for field in required_fields:
            if field not in snapshot:
                errors.append(f"Missing required field: {field}")
        
        if errors:  # Can't continue validation without basic fields
            return False, errors
        
        bids = snapshot['bids']
        asks = snapshot['asks']
        mid_price = snapshot['mid_price']
        
        # Validate bids
        if not isinstance(bids, list) or len(bids) == 0:
            errors.append("Bids must be a non-empty list")
        else:
            for i, bid in enumerate(bids[:10]):  # Check first 10 levels
                if not isinstance(bid, list) or len(bid) != 2:
                    errors.append(f"Bid level {i} must be [price, volume]")
                    continue
                    
                price, volume = bid
                if not DataValidator._is_valid_number(price) or price <= 0:
                    errors.append(f"Bid level {i}: Invalid price {price}")
                if not DataValidator._is_valid_number(volume) or volume < 0:
                    errors.append(f"Bid level {i}: Invalid volume {volume}")
        
        # Validate asks
        if not isinstance(asks, list) or len(asks) == 0:
            errors.append("Asks must be a non-empty list")
        else:
            for i, ask in enumerate(asks[:10]):
                if not isinstance(ask, list) or len(ask) != 2:
                    errors.append(f"Ask level {i} must be [price, volume]")
                    continue
                    
                price, volume = ask
                if not DataValidator._is_valid_number(price) or price <= 0:
                    errors.append(f"Ask level {i}: Invalid price {price}")
                if not DataValidator._is_valid_number(volume) or volume < 0:
                    errors.append(f"Ask level {i}: Invalid volume {volume}")
        
        # Validate mid_price
        if not DataValidator._is_valid_number(mid_price) or mid_price <= 0:
            errors.append(f"Invalid mid_price: {mid_price}")
        
        # Cross-validation: bid < ask
        if len(bids) > 0 and len(asks) > 0 and not errors:
            best_bid = bids[0][0]
            best_ask = asks[0][0]
            
            if DataValidator._is_valid_number(best_bid) and DataValidator._is_valid_number(best_ask):
                if best_bid >= best_ask:
                    errors.append(f"Invalid book: best_bid ({best_bid}) >= best_ask ({best_ask})")
                
                spread = best_ask - best_bid
                if spread < 0:
                    errors.append(f"Negative spread: {spread}")
                elif spread > best_ask * 0.1:  # Spread > 10% of price is suspicious
                    errors.append(f"Suspiciously wide spread: {spread} ({spread/best_ask*100:.1f}%)")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def _is_valid_number(value) -> bool:
        """Check if value is a valid number (not NaN, not Inf)."""
        try:
            if value is None:
                return False
            if isinstance(value, (int, float)):
                return not (np.isnan(value) or np.isinf(value))
            return False
        except (TypeError, ValueError):
            return False
    
    @staticmethod
    def sanitize_snapshot(snapshot: dict) -> dict:
        """Attempt to fix common issues in snapshot data."""
        # Ensure numeric fields are clean
        if 'mid_price' in snapshot:
            snapshot['mid_price'] = DataValidator._sanitize_number(snapshot['mid_price'], default=100.0)
        
        # Clean bids and asks
        if 'bids' in snapshot:
            snapshot['bids'] = [
                [DataValidator._sanitize_number(p, 100.0), DataValidator._sanitize_number(v, 0.0)]
                for p, v in snapshot['bids']
            ]
        
        if 'asks' in snapshot:
            snapshot['asks'] = [
                [DataValidator._sanitize_number(p, 100.0), DataValidator._sanitize_number(v, 0.0)]
                for p, v in snapshot['asks']
            ]
        
        return snapshot
    
    @staticmethod
    def _sanitize_number(value, default=0.0):
        """Replace invalid numbers with default."""
        if DataValidator._is_valid_number(value):
            return float(value)
        return default
from typing import Dict, List, Tuple, Optional

class AlertManager:
    """Manages alert deduplication, severity escalation, and audit logging."""
    def __init__(self, dedup_window_seconds=5):
        self.dedup_window = dedup_window_seconds
        self.recent_alerts = {}  # alert_hash -> last_seen_timestamp
        self.alert_history = deque(maxlen=1000)  # Audit log
        self.alert_counts = defaultdict(int)  # Counter per alert type
        self.escalation_thresholds = {
            "SPOOFING": 3,  # Escalate to critical after 3 occurrences
            "DEPTH_SHOCK": 2,
            "HEAVY_IMBALANCE": 5
        }
        
    def _hash_alert(self, alert):
        """Generate unique hash for alert deduplication."""
        key = f"{alert['type']}_{alert['message']}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def should_suppress(self, alert, current_time):
        """Check if alert should be suppressed due to recent occurrence."""
        alert_hash = self._hash_alert(alert)
        
        if alert_hash in self.recent_alerts:
            last_seen = self.recent_alerts[alert_hash]
            time_diff = (current_time - last_seen).total_seconds()
            
            if time_diff < self.dedup_window:
                return True  # Suppress duplicate
        
        # Update last seen time
        self.recent_alerts[alert_hash] = current_time
        return False
    
    def escalate_severity(self, alert):
        """Escalate alert severity based on frequency."""
        alert_type = alert['type']
        self.alert_counts[alert_type] += 1
        
        if alert_type in self.escalation_thresholds:
            threshold = self.escalation_thresholds[alert_type]
            if self.alert_counts[alert_type] >= threshold:
                if alert['severity'] == 'high':
                    alert['severity'] = 'critical'
                    alert['message'] += f" [ESCALATED: {self.alert_counts[alert_type]} occurrences]"
                elif alert['severity'] == 'medium':
                    alert['severity'] = 'high'
        
        return alert
    
    def log_alert(self, alert, timestamp):
        """Add alert to audit log."""
        self.alert_history.append({
            "timestamp": timestamp,
            "type": alert['type'],
            "severity": alert['severity'],
            "message": alert['message']
        })
    
    def get_alert_history(self, limit=100):
        """Retrieve recent alert history."""
        return list(self.alert_history)[-limit:]
    
    def get_alert_stats(self):
        """Get statistics about alerts."""
        return {
            "total_alerts_logged": len(self.alert_history),
            "alert_counts_by_type": dict(self.alert_counts),
            "active_deduplications": len(self.recent_alerts)
        }
    
    def cleanup_old_deduplications(self, current_time):
        """Remove expired deduplication entries to prevent memory leak."""
        to_remove = []
        for alert_hash, last_seen in self.recent_alerts.items():
            if (current_time - last_seen).total_seconds() > self.dedup_window * 2:
                to_remove.append(alert_hash)
        
        for alert_hash in to_remove:
            del self.recent_alerts[alert_hash]

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
        
        # Alert Management
        self.alert_manager = AlertManager(dedup_window_seconds=5)
        self.last_cleanup_time = datetime.now()
        
        # Feature F: Market State Clusters
        self.feature_history = deque(maxlen=600)
        self.kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        self.is_fitted = False
        self.last_train_time = datetime.now()
        self.regime_labels = {0: "Calm", 1: "Stressed", 2: "Execution Hot", 3: "Manipulation Suspected"}
        
        # Background Training
        self.training_lock = threading.Lock()
        self.training_in_progress = False
        self.cluster_map = {}
        self.pending_training = False
        
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
        
        # Liquidity Gap Tracking
        self.gap_history = deque(maxlen=100)
        self.gap_severity_history = deque(maxlen=100)
        
        # Spoofing Risk Tracking
        self.spoofing_risk_history = deque(maxlen=100)
        self.volume_volatility_history = deque(maxlen=20)
        self.spoofing_events_count = 0

        # Feature C, D, E State
        self.prev_bids = []
        self.prev_asks = []
        self.prev_total_bid_depth = 0
        self.prev_total_ask_depth = 0
        
        # Dynamic Baselines (EWMA)
        self.avg_spread = 0.05
        self.avg_spread_sq = 0.0025
        self.avg_l1_vol = 10.0
        self.alpha = 0.05 # Smoothing factor
        
        # Advanced Anomaly Detection - Fix #10
        # Quote Stuffing Detection
        self.order_event_timestamps = deque(maxlen=100)  # Track order events timing
        self.quote_update_rate = deque(maxlen=20)  # Updates per second
        
        # Layering Detection
        self.layering_history = deque(maxlen=50)  # Track layering patterns
        self.prev_depth_profile = {'bids': [], 'asks': []}
        
        # Momentum Ignition Detection
        self.aggressive_order_history = deque(maxlen=30)
        self.price_momentum = deque(maxlen=20)
        
        # Wash Trading Detection
        self.trade_pattern_buffer = deque(maxlen=100)  # Track trade patterns
        self.volume_clustering = deque(maxlen=50)
        
        # Iceberg Order Detection
        self.iceberg_candidates = defaultdict(lambda: {'fills': 0, 'volume': 0, 'first_seen': None})
        self.repeated_fills_history = deque(maxlen=100)
        
        # Priority #14: Trade Data Integration
        self.trade_classifier = TradeClassifier(tick_size=0.01)
        self.mid_price_history = deque(maxlen=100)  # Track mid-prices for realized spread
        self.trade_metrics_history = deque(maxlen=1000)  # Store trade metrics
    
    def detect_advanced_anomalies(self, snapshot: dict) -> list:
        """
        Standalone method to detect advanced manipulation patterns.
        Can be called after C++ engine processing to add Python-only detection.
        Returns list of anomaly dictionaries.
        """
        anomalies = []
        
        bids = snapshot.get('bids', [])
        asks = snapshot.get('asks', [])
        mid_price = snapshot.get('mid_price', 100.0)
        
        if not bids or not asks:
            return anomalies
        
        current_l1_vol = (bids[0][1] + asks[0][1]) / 2
        current_time = datetime.now()
        
        # 1. Quote Stuffing Detection
        self.order_event_timestamps.append(current_time)
        one_sec_ago = current_time - timedelta(seconds=1)
        recent_updates = [t for t in self.order_event_timestamps if t > one_sec_ago]
        update_rate = len(recent_updates)
        self.quote_update_rate.append(update_rate)
        
        avg_update_rate = np.mean(list(self.quote_update_rate)) if len(self.quote_update_rate) > 0 else 0
        
        if update_rate > 20 and update_rate > avg_update_rate * 3:
            anomalies.append({
                "type": "QUOTE_STUFFING",
                "severity": "critical",
                "message": f"Quote Stuffing: {update_rate} updates/sec (avg: {avg_update_rate:.1f})",
                "update_rate": update_rate,
                "avg_rate": avg_update_rate
            })
        
        # 2. Layering Detection
        bid_volumes = [b[1] for b in bids[:5]]
        ask_volumes = [a[1] for a in asks[:5]]
        
        bid_large_count = sum(1 for v in bid_volumes if v > (2 * self.avg_l1_vol))
        ask_large_count = sum(1 for v in ask_volumes if v > (2 * self.avg_l1_vol))
        
        if bid_large_count >= 3 and bid_large_count > ask_large_count + 2:
            layering_score = min(bid_large_count * 20, 100)
            anomalies.append({
                "type": "LAYERING",
                "severity": "critical" if layering_score > 70 else "high",
                "message": f"Layering: {bid_large_count} large orders on BID side",
                "side": "BID",
                "score": layering_score,
                "large_order_count": bid_large_count
            })
        elif ask_large_count >= 3 and ask_large_count > bid_large_count + 2:
            layering_score = min(ask_large_count * 20, 100)
            anomalies.append({
                "type": "LAYERING",
                "severity": "critical" if layering_score > 70 else "high",
                "message": f"Layering: {ask_large_count} large orders on ASK side",
                "side": "ASK",
                "score": layering_score,
                "large_order_count": ask_large_count
            })
        
        # 3. Momentum Ignition Detection
        price_change = 0
        if len(self.price_momentum) > 0:
            prev_mid = self.price_momentum[-1]
            price_change = (mid_price - prev_mid) / prev_mid if prev_mid > 0 else 0
        
        self.price_momentum.append(mid_price)
        
        if abs(price_change) > 0.002 and current_l1_vol > (2.5 * self.avg_l1_vol):
            if len(self.price_momentum) >= 3:
                recent_changes = [
                    (self.price_momentum[i] - self.price_momentum[i-1]) / self.price_momentum[i-1]
                    for i in range(-3, 0)
                ]
                same_direction = all(c > 0 for c in recent_changes) or all(c < 0 for c in recent_changes)
                
                if same_direction:
                    anomalies.append({
                        "type": "MOMENTUM_IGNITION",
                        "severity": "critical",
                        "message": f"Momentum Ignition: Rapid {'+' if price_change > 0 else ''}{price_change*100:.2f}% move",
                        "price_change_pct": price_change * 100,
                        "volume": current_l1_vol,
                        "direction": "UP" if price_change > 0 else "DOWN"
                    })
        
        # 4. Wash Trading Detection
        for i in range(min(3, len(bids), len(asks))):
            bid_px, bid_vol = bids[i]
            ask_px, ask_vol = asks[i]
            
            if abs(bid_vol - ask_vol) / max(bid_vol, ask_vol) < 0.05 and bid_vol > self.avg_l1_vol:
                self.volume_clustering.append({
                    "bid_price": bid_px,
                    "ask_price": ask_px,
                    "volume": (bid_vol + ask_vol) / 2,
                    "level": i
                })
        
        if len(self.volume_clustering) >= 5:
            recent_vols = [v['volume'] for v in list(self.volume_clustering)[-5:]]
            vol_std = np.std(recent_vols)
            vol_mean = np.mean(recent_vols)
            
            if vol_std / vol_mean < 0.1 and vol_mean > self.avg_l1_vol * 1.5:
                anomalies.append({
                    "type": "WASH_TRADING",
                    "severity": "high",
                    "message": f"Wash Trading: Repeated similar volumes ({vol_mean:.0f} ± {vol_std:.0f})",
                    "avg_volume": vol_mean,
                    "volume_variance": vol_std,
                    "pattern_count": len(recent_vols)
                })
        
        # 5. Iceberg Order Detection
        for i in range(min(3, len(bids))):
            price_key = f"BID_{bids[i][0]:.2f}"
            volume = bids[i][1]
            
            if price_key in self.iceberg_candidates:
                candidate = self.iceberg_candidates[price_key]
                candidate['fills'] += 1
                candidate['volume'] += volume
                
                if candidate['fills'] >= 8:
                    avg_fill_size = candidate['volume'] / candidate['fills']
                    if 0.8 * avg_fill_size <= volume <= 1.2 * avg_fill_size:
                        anomalies.append({
                            "type": "ICEBERG_ORDER",
                            "severity": "medium",
                            "message": f"Iceberg Order: {candidate['fills']} fills at {bids[i][0]:.2f} (BID side)",
                            "price": bids[i][0],
                            "side": "BID",
                            "fill_count": candidate['fills'],
                            "total_volume": candidate['volume'],
                            "avg_fill_size": avg_fill_size
                        })
                        del self.iceberg_candidates[price_key]
            else:
                self.iceberg_candidates[price_key] = {
                    'fills': 1,
                    'volume': volume,
                    'first_seen': current_time
                }
        
        for i in range(min(3, len(asks))):
            price_key = f"ASK_{asks[i][0]:.2f}"
            volume = asks[i][1]
            
            if price_key in self.iceberg_candidates:
                candidate = self.iceberg_candidates[price_key]
                candidate['fills'] += 1
                candidate['volume'] += volume
                
                if candidate['fills'] >= 8:
                    avg_fill_size = candidate['volume'] / candidate['fills']
                    if 0.8 * avg_fill_size <= volume <= 1.2 * avg_fill_size:
                        anomalies.append({
                            "type": "ICEBERG_ORDER",
                            "severity": "medium",
                            "message": f"Iceberg Order: {candidate['fills']} fills at {asks[i][0]:.2f} (ASK side)",
                            "price": asks[i][0],
                            "side": "ASK",
                            "fill_count": candidate['fills'],
                            "total_volume": candidate['volume'],
                            "avg_fill_size": avg_fill_size
                        })
                        del self.iceberg_candidates[price_key]
            else:
                self.iceberg_candidates[price_key] = {
                    'fills': 1,
                    'volume': volume,
                    'first_seen': current_time
                }
        
        # Cleanup old iceberg candidates
        five_min_ago = current_time - timedelta(minutes=5)
        old_keys = [k for k, v in self.iceberg_candidates.items() if v['first_seen'] and v['first_seen'] < five_min_ago]
        for key in old_keys:
            del self.iceberg_candidates[key]
        
        return anomalies
    
    def _train_kmeans_background(self, feature_data):
        """Train K-Means in background thread to avoid blocking."""
        try:
            self.training_in_progress = True
            
            # Create a new model instance for training
            new_kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
            new_kmeans.fit(feature_data)
            
            # Calculate cluster mapping
            centers = new_kmeans.cluster_centers_
            stress_scores = centers[:, 0] + centers[:, 2] + centers[:, 3]
            sorted_indices = np.argsort(stress_scores)
            new_cluster_map = {original_idx: new_rank for new_rank, original_idx in enumerate(sorted_indices)}
            
            # Atomically update the model
            with self.training_lock:
                self.kmeans = new_kmeans
                self.cluster_map = new_cluster_map
                self.is_fitted = True
                self.last_train_time = datetime.now()
        
        except Exception as e:
            print(f"Background K-Means training failed: {e}")
        finally:
            self.training_in_progress = False
            self.pending_training = False

    def process_snapshot(self, snapshot):
        processing_start = time.time()
        
        # Validate input data
        is_valid, validation_errors = DataValidator.validate_snapshot(snapshot)
        
        if not is_valid:
            # Log validation errors
            print(f"WARNING: Data validation failed: {validation_errors}")
            # Attempt to sanitize
            snapshot = DataValidator.sanitize_snapshot(snapshot)
            # Re-validate
            is_valid, validation_errors = DataValidator.validate_snapshot(snapshot)
            if not is_valid:
                # Still invalid, return minimal safe snapshot
                return {
                    **snapshot,
                    'anomalies': [{
                        'type': 'DATA_VALIDATION_ERROR',
                        'severity': 'critical',
                        'message': f"Invalid data: {', '.join(validation_errors[:3])}"
                    }]
                }
        
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

        # Get mid_price and spread early for trade classification
        spread = best_ask_px - best_bid_px
        mid_price = snapshot['mid_price']

        # --- Feature H: V-PIN Calculation (Priority #14) ---
        # Track mid-price history for realized spread calculations
        self.mid_price_history.append(mid_price)
        
        # Process trade data if present
        trade_volume = snapshot.get('trade_volume', 0)
        trade_price = snapshot.get('last_trade_price', mid_price)
        
        vpin = 0
        trade_side = None
        effective_spread = 0
        realized_spread = 0
        
        if trade_volume > 0:
            # Classify trade using Lee-Ready algorithm
            trade_side = self.trade_classifier.classify_trade(
                trade_price, mid_price, best_bid_px, best_ask_px
            )
            
            # Calculate effective spread
            effective_spread = self.trade_classifier.calculate_effective_spread(
                trade_price, mid_price, trade_side
            )
            
            # Calculate realized spread (if we have previous mid-price)
            if len(self.mid_price_history) >= 2:
                mid_price_before = self.mid_price_history[-2]
                realized_spread = self.trade_classifier.calculate_realized_spread(
                    trade_price, mid_price_before, mid_price, trade_side
                )
            
            # Update V-PIN buckets
            if trade_side == 'buy':
                self.current_bucket_buy += trade_volume
            elif trade_side == 'sell':
                self.current_bucket_sell += trade_volume
            
            self.current_bucket_vol += trade_volume
            
            # Record trade info
            trade_info = {
                'timestamp': snapshot.get('timestamp', datetime.now().isoformat()),
                'price': trade_price,
                'volume': trade_volume,
                'side': trade_side,
                'effective_spread': effective_spread,
                'realized_spread': realized_spread,
                'mid_price': mid_price
            }
            self.trade_classifier.update_trade_history(trade_info)
            self.trade_metrics_history.append(trade_info)
            
            # Complete bucket and calculate V-PIN
            if self.current_bucket_vol >= self.bucket_size:
                # Calculate order imbalance for this bucket
                total_vol = self.current_bucket_buy + self.current_bucket_sell
                if total_vol > 0:
                    bucket_oi = abs(self.current_bucket_buy - self.current_bucket_sell) / total_vol
                    self.bucket_history.append(bucket_oi)
                
                # Calculate V-PIN as average of recent bucket imbalances
                if len(self.bucket_history) >= 10:  # Need sufficient history
                    vpin = np.mean(self.bucket_history)
                
                # Reset bucket
                self.current_bucket_vol = 0
                self.current_bucket_buy = 0
                self.current_bucket_sell = 0
        
        # Multi-level Weighted OBI (Level 1 has more weight)
        w_obi_bid = 0
        w_obi_ask = 0
        total_w = 0
        
        for i in range(min(5, len(bids))):
            weight = np.exp(-0.5 * i) # Decay weight: 1.0, 0.6, 0.36...
            w_obi_bid += bids[i][1] * weight
            w_obi_ask += asks[i][1] * weight
            total_w += (bids[i][1] + asks[i][1]) * weight
            
        # Safe division
        obi = (w_obi_bid - w_obi_ask) / total_w if total_w > 1e-9 else 0
        
        # Microprice
        total_q_1 = best_bid_q + best_ask_q
        if total_q_1 > 1e-9:  # Safe threshold
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
        snapshot['vpin'] = round(vpin, 4) # Feature H (Priority #14)
        snapshot['microprice'] = round(microprice, 2)
        snapshot['divergence'] = round(divergence, 4)
        snapshot['directional_prob'] = round(directional_prob * 100, 1)
        
        # Priority #14: Add trade metrics
        if trade_volume > 0:
            snapshot['trade_side'] = trade_side
            snapshot['effective_spread'] = round(effective_spread, 4)
            snapshot['realized_spread'] = round(realized_spread, 4)
            snapshot['trade_classified'] = True
        else:
            snapshot['trade_classified'] = False
        
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
            
        # Dynamic Spread Z-Score
        self.avg_spread = (1 - self.alpha) * self.avg_spread + self.alpha * spread
        self.avg_spread_sq = (1 - self.alpha) * self.avg_spread_sq + self.alpha * (spread ** 2)
        std_spread = np.sqrt(max(0, self.avg_spread_sq - self.avg_spread**2))
        
        # Safe division with minimum threshold
        spread_z = (spread - self.avg_spread) / max(std_spread, 1e-6)
        
        # Updated Feature Vector with OFI
        feature_vector = [spread_z, abs(obi), volatility, abs(ofi_normalized)]
        self.feature_history.append(feature_vector)
        
        # Clustering
        regime = 0
        if len(self.feature_history) > 50:
            # Check if we need to retrain (every 10 seconds)
            should_retrain = (not self.is_fitted or 
                            (datetime.now() - self.last_train_time).seconds > 10)
            
            # Trigger background training if needed and not already running
            if should_retrain and not self.training_in_progress and not self.pending_training:
                self.pending_training = True
                X = np.array(list(self.feature_history))  # Copy data
                training_thread = threading.Thread(
                    target=self._train_kmeans_background,
                    args=(X,),
                    daemon=True
                )
                training_thread.start()
            
            # Use existing model for prediction (non-blocking)
            if self.is_fitted:
                with self.training_lock:
                    try:
                        raw_cluster = self.kmeans.predict([feature_vector])[0]
                        regime = self.cluster_map.get(raw_cluster, 0)
                    except Exception as e:
                        # If prediction fails, default to regime 0
                        regime = 0
            
        snapshot['regime'] = regime
        snapshot['regime_label'] = self.regime_labels.get(regime, "Unknown")

        # Anomalies
        anomalies = []
        
        # Initialize variables for metrics
        gaps = []
        gap_severity_score = 0
        spoofing_risk = 0
        volume_volatility = 0
        liquidity_gaps = []  # For detailed gap analysis
        
        # --- Feature C: Liquidity Gaps ---
        gap_levels = []
        total_gap_volume = 0
        
        for i in range(min(10, len(bids))): 
            if bids[i][1] < 50:  # Threshold for "tiny" liquidity (adjusted for realistic volumes)
                gaps.append(f"Bid L{i+1}")
                gap_levels.append(i+1)
                total_gap_volume += bids[i][1]
                # Weight gaps closer to top of book more heavily
                gap_severity_score += (10 - i) * 2
                
                # Add detailed gap info for visualization
                risk_score = min(100, (10 - i) * 15 + (50 - bids[i][1]) * 2)
                liquidity_gaps.append({
                    "price": bids[i][0],
                    "volume": bids[i][1],
                    "side": "bid",
                    "level": i + 1,
                    "risk_score": risk_score
                })
                
            if asks[i][1] < 50:
                gaps.append(f"Ask L{i+1}")
                gap_levels.append(i+1)
                total_gap_volume += asks[i][1]
                gap_severity_score += (10 - i) * 2
                
                # Add detailed gap info for visualization
                risk_score = min(100, (10 - i) * 15 + (50 - asks[i][1]) * 2)
                liquidity_gaps.append({
                    "price": asks[i][0],
                    "volume": asks[i][1],
                    "side": "ask",
                    "level": i + 1,
                    "risk_score": risk_score
                })
        
        # Track gap metrics for graphing
        gap_count = len(gaps)
        self.gap_history.append(gap_count)
        self.gap_severity_history.append(gap_severity_score)
        
        if gaps:
            severity = "critical" if len(gaps) > 6 or any(level <= 2 for level in gap_levels) else "high" if len(gaps) > 3 else "medium"
            anomalies.append({
                "type": "LIQUIDITY_GAP",
                "severity": severity,
                "message": f"Liquidity Gaps at {len(gaps)} levels: {', '.join(gaps[:5])}{'...' if len(gaps) > 5 else ''}",
                "gap_count": len(gaps),
                "affected_levels": gap_levels,
                "total_gap_volume": total_gap_volume,
                "gap_severity_score": gap_severity_score
            })

        # --- Feature E: Depth Shocks ---
        total_bid_depth = sum(b[1] for b in bids)
        total_ask_depth = sum(a[1] for a in asks)
        
        if self.prev_total_bid_depth > 1e-9:  # Safe threshold
            bid_drop = (self.prev_total_bid_depth - total_bid_depth) / self.prev_total_bid_depth
            ask_drop = (self.prev_total_ask_depth - total_ask_depth) / self.prev_total_ask_depth
            
            if bid_drop > 0.3 or ask_drop > 0.3:
                anomalies.append({
                    "type": "DEPTH_SHOCK",
                    "severity": "high",
                    "message": f"Depth Shock! (Bid: -{bid_drop:.0%}, Ask: -{ask_drop:.0%})"
                })

        # --- Feature D: Spoofing-like Behavior ---
        # Detect large orders at Top of Book (L1) that disappear without price movement
        # Update rolling average of L1 volume
        current_l1_vol = (bids[0][1] + asks[0][1]) / 2
        self.avg_l1_vol = (1 - self.alpha) * self.avg_l1_vol + self.alpha * current_l1_vol
        
        # Track volume volatility for spoofing risk calculation
        self.volume_volatility_history.append(current_l1_vol)
        volume_volatility = 0
        if len(self.volume_volatility_history) > 5:
            vol_array = np.array(list(self.volume_volatility_history))
            volume_volatility = np.std(vol_array) / (np.mean(vol_array) + 1e-6)
        
        spoofing_detected = False
        spoofing_side = None
        volume_ratio = 0
        spoofing_risk = 0
        
        if self.prev_bids and len(self.prev_bids) > 0:
            prev_L1_vol = self.prev_bids[0][1]
            curr_L1_vol = bids[0][1]
            # If volume was large (> 3x Average) and is now small (< 0.3x Average) AND price is same
            if prev_L1_vol > (3 * self.avg_l1_vol) and curr_L1_vol < (0.3 * self.avg_l1_vol) and abs(bids[0][0] - self.prev_bids[0][0]) < 0.001:
                spoofing_detected = True
                spoofing_side = "BID"
                volume_ratio = prev_L1_vol / max(curr_L1_vol, 1)
                self.spoofing_events_count += 1
                
        if self.prev_asks and len(self.prev_asks) > 0:
            prev_L1_vol = self.prev_asks[0][1]
            curr_L1_vol = asks[0][1]
            if prev_L1_vol > (3 * self.avg_l1_vol) and curr_L1_vol < (0.3 * self.avg_l1_vol) and abs(asks[0][0] - self.prev_asks[0][0]) < 0.001:
                spoofing_detected = True
                spoofing_side = "ASK"
                volume_ratio = prev_L1_vol / max(curr_L1_vol, 1)
                self.spoofing_events_count += 1
        
        # Calculate spoofing risk probability (0-100%)
        # Based on: volume volatility, recent events, order size patterns
        base_risk = min(volume_volatility * 50, 30)  # Volume volatility component
        event_risk = min(self.spoofing_events_count * 5, 40)  # Recent events component
        size_risk = 0
        
        # Check for suspicious large orders at L1
        if current_l1_vol > (4 * self.avg_l1_vol):
            size_risk = 30
        elif current_l1_vol > (2 * self.avg_l1_vol):
            size_risk = 15
            
        spoofing_risk = min(base_risk + event_risk + size_risk, 100)
        
        # Decay event count over time
        if len(self.spoofing_risk_history) % 10 == 0:
            self.spoofing_events_count = max(0, self.spoofing_events_count - 1)
        
        self.spoofing_risk_history.append(spoofing_risk)
        
        if spoofing_detected:
            anomalies.append({
                "type": "SPOOFING",
                "severity": "critical",
                "message": f"Potential Spoofing: Large {spoofing_side} order cancelled (Volume dropped {volume_ratio:.1f}x)",
                "side": spoofing_side,
                "volume_ratio": volume_ratio,
                "price_level": bids[0][0] if spoofing_side == "BID" else asks[0][0],
                "spoofing_risk": spoofing_risk
            })

        # --- Advanced Anomaly Detection (Fix #10) ---
        
        # 1. Quote Stuffing Detection
        # Rapid fire of orders (>20 updates/sec) to slow down competitors
        current_time = datetime.now()
        self.order_event_timestamps.append(current_time)
        
        # Calculate update rate over last 1 second
        one_sec_ago = current_time - timedelta(seconds=1)
        recent_updates = [t for t in self.order_event_timestamps if t > one_sec_ago]
        update_rate = len(recent_updates)
        self.quote_update_rate.append(update_rate)
        
        avg_update_rate = np.mean(list(self.quote_update_rate)) if len(self.quote_update_rate) > 0 else 0
        
        if update_rate > 20 and update_rate > avg_update_rate * 3:
            anomalies.append({
                "type": "QUOTE_STUFFING",
                "severity": "critical",
                "message": f"Quote Stuffing: {update_rate} updates/sec (avg: {avg_update_rate:.1f})",
                "update_rate": update_rate,
                "avg_rate": avg_update_rate
            })
        
        # 2. Layering Detection
        # Multiple large orders stacked at different levels on one side
        layering_score = 0
        layering_side = None
        
        # Check for bid layering (multiple large orders on bid side)
        bid_volumes = [b[1] for b in bids[:5]]
        ask_volumes = [a[1] for a in asks[:5]]
        
        # Count large orders (>2x avg) on each side
        bid_large_count = sum(1 for v in bid_volumes if v > (2 * self.avg_l1_vol))
        ask_large_count = sum(1 for v in ask_volumes if v > (2 * self.avg_l1_vol))
        
        # Layering if 3+ large orders on one side with imbalance
        if bid_large_count >= 3 and bid_large_count > ask_large_count + 2:
            layering_score = min(bid_large_count * 20, 100)
            layering_side = "BID"
            self.layering_history.append({"side": "BID", "count": bid_large_count})
        elif ask_large_count >= 3 and ask_large_count > bid_large_count + 2:
            layering_score = min(ask_large_count * 20, 100)
            layering_side = "ASK"
            self.layering_history.append({"side": "ASK", "count": ask_large_count})
        
        if layering_score > 50:
            anomalies.append({
                "type": "LAYERING",
                "severity": "critical" if layering_score > 70 else "high",
                "message": f"Layering: {bid_large_count if layering_side == 'BID' else ask_large_count} large orders on {layering_side} side",
                "side": layering_side,
                "score": layering_score,
                "large_order_count": bid_large_count if layering_side == "BID" else ask_large_count
            })
        
        # 3. Momentum Ignition Detection
        # Aggressive orders + rapid price movement to trigger algos
        price_change = 0
        if len(self.price_momentum) > 0:
            prev_mid = self.price_momentum[-1]
            price_change = (mid_price - prev_mid) / prev_mid if prev_mid > 0 else 0
        
        self.price_momentum.append(mid_price)
        
        # Check for rapid price move (>0.2% in one tick) with heavy volume
        if abs(price_change) > 0.002 and current_l1_vol > (2.5 * self.avg_l1_vol):
            # Check if price continued moving in same direction (momentum)
            if len(self.price_momentum) >= 3:
                recent_changes = [
                    (self.price_momentum[i] - self.price_momentum[i-1]) / self.price_momentum[i-1]
                    for i in range(-3, 0)
                ]
                same_direction = all(c > 0 for c in recent_changes) or all(c < 0 for c in recent_changes)
                
                if same_direction:
                    self.aggressive_order_history.append({
                        "price_change": price_change,
                        "volume": current_l1_vol,
                        "direction": "UP" if price_change > 0 else "DOWN"
                    })
                    
                    if len(self.aggressive_order_history) >= 2:
                        anomalies.append({
                            "type": "MOMENTUM_IGNITION",
                            "severity": "critical",
                            "message": f"Momentum Ignition: Rapid {'+' if price_change > 0 else ''}{price_change*100:.2f}% move with {current_l1_vol:.0f} volume",
                            "price_change_pct": price_change * 100,
                            "volume": current_l1_vol,
                            "direction": "UP" if price_change > 0 else "DOWN"
                        })
        
        # 4. Wash Trading Detection
        # Self-trading patterns (buy and sell at similar prices with similar volumes)
        # Track volume patterns at each price level
        for i in range(min(3, len(bids), len(asks))):
            bid_px, bid_vol = bids[i]
            ask_px, ask_vol = asks[i]
            
            # Check if bid/ask volumes are suspiciously similar (within 5%)
            if abs(bid_vol - ask_vol) / max(bid_vol, ask_vol) < 0.05 and bid_vol > self.avg_l1_vol:
                self.volume_clustering.append({
                    "bid_price": bid_px,
                    "ask_price": ask_px,
                    "volume": (bid_vol + ask_vol) / 2,
                    "level": i
                })
        
        # Detect repeated similar volumes (potential wash trading)
        if len(self.volume_clustering) >= 5:
            recent_vols = [v['volume'] for v in list(self.volume_clustering)[-5:]]
            vol_std = np.std(recent_vols)
            vol_mean = np.mean(recent_vols)
            
            # Low variance in volumes suggests coordinated trading
            if vol_std / vol_mean < 0.1 and vol_mean > self.avg_l1_vol * 1.5:
                anomalies.append({
                    "type": "WASH_TRADING",
                    "severity": "high",
                    "message": f"Wash Trading: Repeated similar volumes ({vol_mean:.0f} ± {vol_std:.0f})",
                    "avg_volume": vol_mean,
                    "volume_variance": vol_std,
                    "pattern_count": len(recent_vols)
                })
        
        # 5. Iceberg Order Detection
        # Hidden large orders: repeated fills at same price with consistent volume
        for i in range(min(3, len(bids))):
            price_key = f"BID_{bids[i][0]:.2f}"
            volume = bids[i][1]
            
            # Track repeated occurrences at same price level
            if price_key in self.iceberg_candidates:
                candidate = self.iceberg_candidates[price_key]
                candidate['fills'] += 1
                candidate['volume'] += volume
                
                # If we see 5+ fills at same price with consistent volume, flag as iceberg
                if candidate['fills'] >= 5:
                    avg_fill_size = candidate['volume'] / candidate['fills']
                    
                    # Check if fill sizes are consistent (low variance)
                    if 0.8 * avg_fill_size <= volume <= 1.2 * avg_fill_size:
                        self.repeated_fills_history.append({
                            "price": bids[i][0],
                            "side": "BID",
                            "fills": candidate['fills'],
                            "total_volume": candidate['volume']
                        })
                        
                        if candidate['fills'] >= 8:  # Strong signal
                            anomalies.append({
                                "type": "ICEBERG_ORDER",
                                "severity": "medium",
                                "message": f"Iceberg Order: {candidate['fills']} fills at {bids[i][0]:.2f} (BID side)",
                                "price": bids[i][0],
                                "side": "BID",
                                "fill_count": candidate['fills'],
                                "total_volume": candidate['volume'],
                                "avg_fill_size": avg_fill_size
                            })
                            # Reset after detection
                            del self.iceberg_candidates[price_key]
            else:
                self.iceberg_candidates[price_key] = {
                    'fills': 1,
                    'volume': volume,
                    'first_seen': current_time
                }
        
        # Same for asks
        for i in range(min(3, len(asks))):
            price_key = f"ASK_{asks[i][0]:.2f}"
            volume = asks[i][1]
            
            if price_key in self.iceberg_candidates:
                candidate = self.iceberg_candidates[price_key]
                candidate['fills'] += 1
                candidate['volume'] += volume
                
                if candidate['fills'] >= 5:
                    avg_fill_size = candidate['volume'] / candidate['fills']
                    
                    if 0.8 * avg_fill_size <= volume <= 1.2 * avg_fill_size:
                        self.repeated_fills_history.append({
                            "price": asks[i][0],
                            "side": "ASK",
                            "fills": candidate['fills'],
                            "total_volume": candidate['volume']
                        })
                        
                        if candidate['fills'] >= 8:
                            anomalies.append({
                                "type": "ICEBERG_ORDER",
                                "severity": "medium",
                                "message": f"Iceberg Order: {candidate['fills']} fills at {asks[i][0]:.2f} (ASK side)",
                                "price": asks[i][0],
                                "side": "ASK",
                                "fill_count": candidate['fills'],
                                "total_volume": candidate['volume'],
                                "avg_fill_size": avg_fill_size
                            })
                            del self.iceberg_candidates[price_key]
            else:
                self.iceberg_candidates[price_key] = {
                    'fills': 1,
                    'volume': volume,
                    'first_seen': current_time
                }
        
        # Cleanup old iceberg candidates (older than 5 minutes)
        five_min_ago = current_time - timedelta(minutes=5)
        old_keys = [k for k, v in self.iceberg_candidates.items() if v['first_seen'] and v['first_seen'] < five_min_ago]
        for key in old_keys:
            del self.iceberg_candidates[key]

        # Update State
        self.prev_bids = bids
        self.prev_asks = asks
        self.prev_total_bid_depth = total_bid_depth
        self.prev_total_ask_depth = total_ask_depth
        self.prev_depth_profile = {'bids': bids[:10], 'asks': asks[:10]}

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
        
        # Priority #14: Trade Anomaly Detection
        trade_anomalies = self.trade_classifier.detect_trade_anomalies()
        anomalies.extend(trade_anomalies)
        
        # Process alerts through AlertManager
        current_time = datetime.now()
        filtered_anomalies = []
        
        for alert in anomalies:
            # Check deduplication
            if not self.alert_manager.should_suppress(alert, current_time):
                # Escalate if needed
                alert = self.alert_manager.escalate_severity(alert)
                # Log to audit trail
                self.alert_manager.log_alert(alert, snapshot.get('timestamp', current_time.isoformat()))
                filtered_anomalies.append(alert)
        
        # Periodic cleanup of old deduplication entries
        if (current_time - self.last_cleanup_time).total_seconds() > 60:
            self.alert_manager.cleanup_old_deduplications(current_time)
            self.last_cleanup_time = current_time
        
        snapshot['anomalies'] = filtered_anomalies
        
        # Processing time budget check
        processing_time_ms = (time.time() - processing_start) * 1000
        if processing_time_ms > 100:  # Warn if processing takes > 100ms
            snapshot['anomalies'].append({
                'type': 'PROCESSING_SLOW',
                'severity': 'medium',
                'message': f'Slow processing: {processing_time_ms:.1f}ms'
            })
        
        # Add graphing metrics
        snapshot['gap_count'] = len(gaps)
        snapshot['gap_severity_score'] = gap_severity_score
        snapshot['spoofing_risk'] = spoofing_risk
        snapshot['volume_volatility'] = volume_volatility
        snapshot['liquidity_gaps'] = liquidity_gaps  # Add detailed gap data for visualization
        
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
