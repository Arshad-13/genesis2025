#!/usr/bin/env python3
"""
Test script to verify Liquidity Gaps and Spoofing Detection features with graphing metrics
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from analytics_core import AnalyticsEngine

def test_liquidity_gaps_with_metrics():
    """Test liquidity gap detection with graphing metrics"""
    print("🧪 Testing Liquidity Gap Detection with Metrics...")
    
    engine = AnalyticsEngine()
    
    # Create a snapshot with liquidity gaps
    test_snapshot = {
        "timestamp": "2024-12-24T10:00:00",
        "mid_price": 100.0,
        "bids": [
            [99.95, 1000],  # L1 - normal
            [99.94, 20],    # L2 - gap (< 50)
            [99.93, 15],    # L3 - gap (< 50)
            [99.92, 800],   # L4 - normal
            [99.91, 5],     # L5 - gap (< 50)
        ],
        "asks": [
            [100.05, 1200], # L1 - normal
            [100.06, 30],   # L2 - gap (< 50)
            [100.07, 900],  # L3 - normal
            [100.08, 10],   # L4 - gap (< 50)
            [100.09, 600],  # L5 - normal
        ]
    }
    
    result = engine.process_snapshot(test_snapshot)
    
    # Check for liquidity gap anomalies
    gap_anomalies = [a for a in result.get('anomalies', []) if a['type'] == 'LIQUIDITY_GAP']
    assert len(gap_anomalies) > 0, "Expected at least one liquidity gap anomaly"

def test_spoofing_with_risk_metrics():
    """Test spoofing detection with risk probability"""
    print("\n🧪 Testing Spoofing Detection with Risk Metrics...")
    
    engine = AnalyticsEngine()
    
    # First snapshot with large bid
    snapshot1 = {
        "timestamp": "2024-12-24T10:00:00",
        "mid_price": 100.0,
        "bids": [[99.95, 5000]],  # Large bid
        "asks": [[100.05, 1000]]
    }
    
    # Process first snapshot to set up state
    result1 = engine.process_snapshot(snapshot1)
    print(f"   - Initial spoofing risk: {result1.get('spoofing_risk', 0):.1f}%")
    
    # Second snapshot with same price but tiny volume (spoofing pattern)
    snapshot2 = {
        "timestamp": "2024-12-24T10:00:01",
        "mid_price": 100.0,
        "bids": [[99.95, 50]],   # Same price, tiny volume
        "asks": [[100.05, 1000]]
    }
    
    result2 = engine.process_snapshot(snapshot2)
    
    # Check for spoofing anomalies
    spoof_anomalies = [a for a in result2.get('anomalies', []) if a['type'] == 'SPOOFING']
    assert len(spoof_anomalies) > 0, "Expected at least one spoofing anomaly"

def test_risk_progression():
    """Test risk metrics over multiple snapshots"""
    print("\n🧪 Testing Risk Progression Over Time...")
    
    engine = AnalyticsEngine()
    
    # Simulate a sequence of snapshots with increasing risk
    snapshots = [
        # Normal market
        {"timestamp": "10:00:00", "mid_price": 100.0, "bids": [[99.95, 1000]], "asks": [[100.05, 1000]]},
        # Large order appears (risk increases)
        {"timestamp": "10:00:01", "mid_price": 100.0, "bids": [[99.95, 8000]], "asks": [[100.05, 1000]]},
        # Order disappears (spoofing event)
        {"timestamp": "10:00:02", "mid_price": 100.0, "bids": [[99.95, 100]], "asks": [[100.05, 1000]]},
        # Liquidity gaps appear
        {"timestamp": "10:00:03", "mid_price": 100.0, "bids": [[99.95, 10], [99.94, 5]], "asks": [[100.05, 15], [100.06, 8]]},
    ]
    
    risks = []
    gaps = []
    
    for snapshot in snapshots:
        result = engine.process_snapshot(snapshot)
        risks.append(result.get('spoofing_risk', 0))
        gaps.append(result.get('gap_count', 0))

    assert len(risks) == 4, "Should track risk for all 4 snapshots"
    assert len(set(risks)) >= 2, f"Risk values should vary across snapshots, got: {risks}"
    assert gaps[-1] > gaps[0], f"Expected gap count to increase, got: {gaps}"

def main():
    print("🚀 Testing Enhanced Market Microstructure Features")
    print("=" * 60)
    
    gap_working = test_liquidity_gaps_with_metrics()
    spoof_working = test_spoofing_with_risk_metrics()
    progression_working = test_risk_progression()
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    print(f"   Liquidity Gaps + Metrics: {'✅ PASS' if gap_working else '❌ FAIL'}")
    print(f"   Spoofing Detection + Risk: {'✅ PASS' if spoof_working else '❌ FAIL'}")
    print(f"   Risk Progression: {'✅ PASS' if progression_working else '❌ FAIL'}")
    
    if gap_working and spoof_working and progression_working:
        print("\n🎉 All enhanced features are working correctly!")
        print("📈 Graphical components ready for visualization!")
        return 0
    else:
        print("\n⚠️  Some features need attention.")
        return 1

if __name__ == "__main__":
    sys.exit(main())