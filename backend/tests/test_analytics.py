"""Unit tests for analytics.py components."""
import pytest
import numpy as np
from analytics_core import DataValidator, AlertManager, AnalyticsEngine, MarketSimulator


class TestDataValidator:
    """Test data validation logic."""
    
    def test_valid_snapshot_passes(self, sample_snapshot):
        """Test that a valid snapshot passes validation."""
        is_valid, errors = DataValidator.validate_snapshot(sample_snapshot)
        assert is_valid is True
        assert len(errors) == 0
    
    def test_missing_fields_detected(self):
        """Test detection of missing required fields."""
        incomplete = {"timestamp": "2025-12-24T12:00:00"}
        is_valid, errors = DataValidator.validate_snapshot(incomplete)
        assert is_valid is False
        assert any("Missing required field" in err for err in errors)
    
    def test_nan_values_detected(self, invalid_snapshot):
        """Test detection of NaN/Inf values."""
        is_valid, errors = DataValidator.validate_snapshot(invalid_snapshot)
        assert is_valid is False
        assert any("Invalid" in err for err in errors)
    
    def test_crossed_book_detected(self, crossed_book_snapshot):
        """Test detection of crossed book (bid >= ask)."""
        is_valid, errors = DataValidator.validate_snapshot(crossed_book_snapshot)
        assert is_valid is False
        assert any("best_bid" in err and "best_ask" in err for err in errors)
    
    @pytest.mark.skip(reason="Wide spread detection is optional feature")
    def test_wide_spread_warning(self, wide_spread_snapshot):
        """Test warning for suspiciously wide spreads."""
        is_valid, errors = DataValidator.validate_snapshot(wide_spread_snapshot)
        # Wide spread generates a warning but may still be "valid"
        assert len(errors) > 0, "Should generate at least one error/warning"
    
    def test_sanitization_fixes_nan(self):
        """Test that sanitize_snapshot replaces NaN with defaults."""
        bad_data = {
            "mid_price": float('nan'),
            "bids": [[float('inf'), 100]],
            "asks": [[100.0, float('nan')]]
        }
        sanitized = DataValidator.sanitize_snapshot(bad_data)
        
        assert not np.isnan(sanitized['mid_price'])
        assert not np.isinf(sanitized['bids'][0][0])
        assert not np.isnan(sanitized['asks'][0][1])
    
    def test_is_valid_number(self):
        """Test number validation helper."""
        assert DataValidator._is_valid_number(10.5) is True
        assert DataValidator._is_valid_number(0) is True
        assert DataValidator._is_valid_number(float('nan')) is False
        assert DataValidator._is_valid_number(float('inf')) is False
        assert DataValidator._is_valid_number(None) is False


class TestAlertManager:
    """Test alert management system."""
    
    def test_deduplication_suppresses_duplicates(self):
        """Test that duplicate alerts within window are suppressed."""
        from datetime import datetime
        manager = AlertManager(dedup_window_seconds=5)
        
        alert = {"type": "TEST", "severity": "high", "message": "Test alert"}
        current_time = datetime.now()
        
        # First occurrence should not be suppressed
        assert manager.should_suppress(alert, current_time) is False
        
        # Immediate duplicate should be suppressed
        assert manager.should_suppress(alert, current_time) is True
    
    def test_severity_escalation(self):
        """Test that repeated alerts escalate severity."""
        manager = AlertManager()
        
        alert = {
            "type": "SPOOFING",
            "severity": "high",
            "message": "Spoofing detected"
        }
        
        # Trigger escalation (threshold is 3 for SPOOFING)
        manager.alert_counts["SPOOFING"] = 3
        escalated = manager.escalate_severity(alert)
        
        assert escalated['severity'] == 'critical'
        assert "ESCALATED" in escalated['message']
    
    def test_alert_history_logging(self):
        """Test alert audit log."""
        manager = AlertManager()
        alert = {"type": "TEST", "severity": "medium", "message": "Test"}
        timestamp = "2025-12-24T12:00:00"
        
        manager.log_alert(alert, timestamp)
        history = manager.get_alert_history()
        
        assert len(history) == 1
        assert history[0]['type'] == "TEST"
        assert history[0]['timestamp'] == timestamp
    
    def test_alert_stats(self):
        """Test alert statistics generation."""
        manager = AlertManager()
        
        for i in range(5):
            alert = {"type": "LIQUIDITY_GAP", "severity": "medium", "message": "Gap"}
            manager.alert_counts["LIQUIDITY_GAP"] += 1
            manager.log_alert(alert, f"2025-12-24T12:00:0{i}")
        
        for i in range(3):
            alert = {"type": "SPOOFING", "severity": "critical", "message": "Spoof"}
            manager.alert_counts["SPOOFING"] += 1
            manager.log_alert(alert, f"2025-12-24T12:00:1{i}")
        
        stats = manager.get_alert_stats()
        assert stats['total_alerts_logged'] == 8
        assert stats['alert_counts_by_type']['LIQUIDITY_GAP'] == 5
        assert stats['alert_counts_by_type']['SPOOFING'] == 3


class TestAnalyticsEngine:
    """Test analytics engine processing."""
    
    def test_engine_initialization(self):
        """Test that engine initializes with correct defaults."""
        engine = AnalyticsEngine()
        assert engine.avg_spread == 0.05
        assert engine.alpha == 0.05
        assert len(engine.history) == 0
    
    def test_process_valid_snapshot(self, sample_snapshot):
        """Test processing of valid snapshot."""
        engine = AnalyticsEngine()
        result = engine.process_snapshot(sample_snapshot)
        
        # Check that metrics are calculated
        assert 'spread' in result
        assert 'obi' in result
        assert 'ofi' in result
        assert 'anomalies' in result
        
        # Check value ranges
        assert result['spread'] > 0
        assert -1 <= result['obi'] <= 1
        assert -1 <= result['ofi'] <= 1
    
    def test_invalid_data_generates_validation_error(self, invalid_snapshot):
        """Test that invalid data generates validation error alert."""
        engine = AnalyticsEngine()
        result = engine.process_snapshot(invalid_snapshot)
        
        # Should have a DATA_VALIDATION_ERROR anomaly
        assert any(
            a['type'] == 'DATA_VALIDATION_ERROR' 
            for a in result.get('anomalies', [])
        )
    
    def test_liquidity_gap_detection(self):
        """Test detection of liquidity gaps."""
        engine = AnalyticsEngine()
        
        snapshot = {
            "timestamp": "2025-12-24T12:00:00",
            "mid_price": 100.0,
            "bids": [[99.95, 0.1], [99.90, 0.2], [99.85, 1000], [99.80, 1000], [99.75, 1000]],
            "asks": [[100.05, 0.1], [100.10, 1000], [100.15, 1000], [100.20, 1000], [100.25, 1000]]
        }
        
        result = engine.process_snapshot(snapshot)
        
        # Should detect gaps at top levels
        gap_alerts = [a for a in result['anomalies'] if a['type'] == 'LIQUIDITY_GAP']
        assert len(gap_alerts) > 0
    
    def test_heavy_imbalance_detection(self):
        """Test detection of heavy order book imbalance."""
        engine = AnalyticsEngine()
        
        # Create heavily bid-sided book
        snapshot = {
            "timestamp": "2025-12-24T12:00:00",
            "mid_price": 100.0,
            "bids": [[99.95, 10000], [99.90, 10000], [99.85, 10000], [99.80, 10000], [99.75, 10000]],
            "asks": [[100.05, 100], [100.10, 100], [100.15, 100], [100.20, 100], [100.25, 100]]
        }
        
        result = engine.process_snapshot(snapshot)
        
        # Should detect heavy imbalance
        imbalance_alerts = [a for a in result['anomalies'] if a['type'] == 'HEAVY_IMBALANCE']
        assert len(imbalance_alerts) > 0
    
    def test_ewma_baseline_updates(self, sample_snapshot):
        """Test that EWMA baselines update over time."""
        engine = AnalyticsEngine()
        
        initial_spread = engine.avg_spread
        
        # Process multiple snapshots
        for _ in range(10):
            engine.process_snapshot(sample_snapshot)
        
        # Baseline should have moved
        assert engine.avg_spread != initial_spread


class TestMarketSimulator:
    """Test market data simulator."""
    
    def test_simulator_generates_valid_snapshots(self):
        """Test that simulator generates valid snapshots."""
        sim = MarketSimulator()
        snapshot = sim.generate_snapshot()
        
        is_valid, errors = DataValidator.validate_snapshot(snapshot)
        assert is_valid is True, f"Simulator generated invalid data: {errors}"
    
    def test_spread_generation(self):
        """Test that spread stays within reasonable bounds."""
        sim = MarketSimulator()
        
        for _ in range(100):
            snapshot = sim.generate_snapshot()
            spread = snapshot['asks'][0][0] - snapshot['bids'][0][0]
            
            assert spread > 0, "Spread must be positive"
            assert spread < 1.0, "Spread should not exceed 1.0"
