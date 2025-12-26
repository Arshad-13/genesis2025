#include "analytics_engine.h"
#include <cmath>
#include <algorithm>
#include <numeric>

AnalyticsEngine::AnalyticsEngine() {
    prev_best_bid = 0.0;
    prev_best_ask = 0.0;
    prev_bid_q = 0.0;
    prev_ask_q = 0.0;
    avg_spread = 0.05;
    avg_spread_sq = 0.0025;
    avg_l1_vol = 10.0;
    alpha = 0.05;
}

ProcessedSnapshot AnalyticsEngine::processSnapshot(const Snapshot& snapshot) {
    ProcessedSnapshot result;
    
    result.set_timestamp(snapshot.timestamp());
    result.set_mid_price(snapshot.mid_price());
    
    // Always set default values first
    result.set_spread(0.0);
    result.set_ofi(0.0);
    result.set_obi(0.0);
    result.set_microprice(snapshot.mid_price());
    result.set_divergence(0.0);
    result.set_directional_prob(50.0);
    result.set_regime(0);
    result.set_regime_label("Calm");
    result.set_vpin(0.0);
    
    if (snapshot.bids_size() == 0 || snapshot.asks_size() == 0) {
        return result;
    }
    
    // Extract L1 data with validation
    double best_bid_px = snapshot.bids(0).price();
    double best_ask_px = snapshot.asks(0).price();
    double best_bid_q = snapshot.bids(0).volume();
    double best_ask_q = snapshot.asks(0).volume();
    
    // Validate data - if invalid, return defaults but don't crash
    if (best_bid_px <= 0 || best_ask_px <= 0 || best_bid_q < 0 || best_ask_q < 0) {
        return result;
    }
    
    if (best_ask_px <= best_bid_px) {
        // Invalid spread, but still try to calculate other metrics
        result.set_spread(0.0);
    } else {
        // Calculate spread
        double spread = best_ask_px - best_bid_px;
        result.set_spread(spread);
        
        // Update dynamic spread statistics
        avg_spread = (1 - alpha) * avg_spread + alpha * spread;
        avg_spread_sq = (1 - alpha) * avg_spread_sq + alpha * (spread * spread);
    }
    
    // Calculate OFI (Order Flow Imbalance) - simplified
    double ofi = 0.0;
    if (prev_best_bid > 0 && prev_best_ask > 0) {
        // Simple OFI calculation
        double bid_change = best_bid_q - prev_bid_q;
        double ask_change = best_ask_q - prev_ask_q;
        ofi = (bid_change - ask_change) / 1000.0; // Normalize
        ofi = std::max(-1.0, std::min(1.0, ofi)); // Clamp to [-1, 1]
        result.set_ofi(ofi);
    }
    
    // Calculate OBI (Order Book Imbalance) - simplified
    double total_vol = best_bid_q + best_ask_q;
    double obi = 0.0;
    if (total_vol > 1e-9) {
        obi = (best_bid_q - best_ask_q) / total_vol;
        result.set_obi(obi);
    }
    
    // Calculate microprice - simplified
    double microprice = snapshot.mid_price();
    if (total_vol > 1e-9) {
        microprice = (best_bid_q * best_ask_px + best_ask_q * best_bid_px) / total_vol;
    }
    result.set_microprice(microprice);
    
    // Calculate divergence
    double divergence = microprice - snapshot.mid_price();
    result.set_divergence(divergence);
    
    // Calculate directional probability - simplified
    double directional_prob = 50.0; // Default neutral
    if (std::abs(divergence) > 0.01) {
        directional_prob = divergence > 0 ? 60.0 : 40.0; // Simple bias
    }
    result.set_directional_prob(directional_prob);
    
    // Simple regime classification
    if (result.spread() > avg_spread * 2) {
        result.set_regime(1);
        result.set_regime_label("Stressed");
    } else {
        result.set_regime(0);
        result.set_regime_label("Calm");
    }
    
    // Update state for next iteration
    prev_best_bid = best_bid_px;
    prev_best_ask = best_ask_px;
    prev_bid_q = best_bid_q;
    prev_ask_q = best_ask_q;
    
    // Update dynamic averages
    double current_l1_vol = (best_bid_q + best_ask_q) / 2;
    avg_l1_vol = (1 - alpha) * avg_l1_vol + alpha * current_l1_vol;
    
    return result;
}

void AnalyticsEngine::detectAnomalies(const Snapshot& snapshot, ProcessedSnapshot& result, 
                                     double spread, double obi, double best_bid_q, double best_ask_q) {
    
    // Liquidity gaps detection
    int gap_count = 0;
    for (int i = 0; i < std::min(10, std::min(snapshot.bids_size(), snapshot.asks_size())); i++) {
        if (snapshot.bids(i).volume() < 50 || snapshot.asks(i).volume() < 50) {
            gap_count++;
        }
    }
    
    if (gap_count > 3) {
        auto* anomaly = result.add_anomalies();
        anomaly->set_type("LIQUIDITY_GAP");
        anomaly->set_severity(gap_count > 6 ? "critical" : "high");
        anomaly->set_message("Liquidity gaps detected at " + std::to_string(gap_count) + " levels");
    }
    
    // Heavy imbalance detection
    if (std::abs(obi) > 0.5) {
        auto* anomaly = result.add_anomalies();
        anomaly->set_type("HEAVY_IMBALANCE");
        anomaly->set_severity("high");
        anomaly->set_message(obi > 0 ? "Heavy BUY pressure" : "Heavy SELL pressure");
    }
    
    // Spread shock detection
    if (spread > 0 && spread > avg_spread * 3) {
        auto* anomaly = result.add_anomalies();
        anomaly->set_type("SPREAD_SHOCK");
        anomaly->set_severity("medium");
        anomaly->set_message("Wide spread detected: " + std::to_string(spread));
    }
    
    // Spoofing-like behavior (simplified)
    double current_l1_vol = (best_bid_q + best_ask_q) / 2;
    if (current_l1_vol > avg_l1_vol * 4) {
        auto* anomaly = result.add_anomalies();
        anomaly->set_type("LARGE_ORDER");
        anomaly->set_severity("medium");
        anomaly->set_message("Unusually large L1 volume detected");
    }
}