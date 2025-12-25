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
    avg_l1_vol = 10.0;
    alpha = 0.05;
}

ProcessedSnapshot AnalyticsEngine::processSnapshot(const Snapshot& snapshot) {
    ProcessedSnapshot result;
    
    result.set_timestamp(snapshot.timestamp());
    result.set_mid_price(snapshot.mid_price());
    
    if (snapshot.bids_size() == 0 || snapshot.asks_size() == 0) {
        return result;
    }
    
    // Extract L1 data
    double best_bid_px = snapshot.bids(0).price();
    double best_ask_px = snapshot.asks(0).price();
    double best_bid_q = snapshot.bids(0).volume();
    double best_ask_q = snapshot.asks(0).volume();
    
    // Calculate spread
    double spread = best_ask_px - best_bid_px;
    result.set_spread(spread);
    
    // Calculate OFI (Order Flow Imbalance)
    double ofi = 0.0;
    if (prev_best_bid > 0) {
        // Bid OFI
        if (best_bid_px > prev_best_bid) {
            ofi += best_bid_q;
        } else if (best_bid_px < prev_best_bid) {
            ofi -= prev_bid_q;
        } else {
            ofi += (best_bid_q - prev_bid_q);
        }
        
        // Ask OFI
        if (best_ask_px > prev_best_ask) {
            ofi += prev_ask_q;
        } else if (best_ask_px < prev_best_ask) {
            ofi -= best_ask_q;
        } else {
            ofi -= (best_ask_q - prev_ask_q);
        }
    }
    
    // Normalize OFI
    double ofi_normalized = std::max(-1.0, std::min(1.0, ofi / 500.0));
    result.set_ofi(ofi_normalized);
    
    // Calculate OBI (Order Book Imbalance) - weighted multi-level
    double w_obi_bid = 0.0;
    double w_obi_ask = 0.0;
    double total_w = 0.0;
    
    int levels = std::min(5, std::min(snapshot.bids_size(), snapshot.asks_size()));
    for (int i = 0; i < levels; i++) {
        double weight = std::exp(-0.5 * i);
        double bid_vol = snapshot.bids(i).volume();
        double ask_vol = snapshot.asks(i).volume();
        
        w_obi_bid += bid_vol * weight;
        w_obi_ask += ask_vol * weight;
        total_w += (bid_vol + ask_vol) * weight;
    }
    
    double obi = (total_w > 1e-9) ? (w_obi_bid - w_obi_ask) / total_w : 0.0;
    result.set_obi(obi);
    
    // Detect anomalies
    detectAnomalies(snapshot, result, spread, obi, best_bid_q, best_ask_q);
    
    // Update state for next iteration
    prev_best_bid = best_bid_px;
    prev_best_ask = best_ask_px;
    prev_bid_q = best_bid_q;
    prev_ask_q = best_ask_q;
    
    // Update dynamic averages
    avg_spread = (1 - alpha) * avg_spread + alpha * spread;
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
    if (spread > avg_spread * 3) {
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