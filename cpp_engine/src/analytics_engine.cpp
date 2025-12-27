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
    spoofing_events_count = 0;
}

ProcessedSnapshot AnalyticsEngine::processSnapshot(const Snapshot& snapshot) {
    ProcessedSnapshot result;
    
    result.set_timestamp(snapshot.timestamp());
    result.set_mid_price(snapshot.mid_price());
    
    // Always set default values first
    result.set_spread(0.0);
    result.set_ofi(0.0);
    result.set_obi(20.0);
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
    
    // IMPORTANT: Declare spread at function scope so it's available throughout
    double spread = 0.0;
    
    if (best_ask_px <= best_bid_px) {
        // Invalid spread, but still try to calculate other metrics
        result.set_spread(0.0);
    } else {
        // Calculate spread
        spread = best_ask_px - best_bid_px;
        result.set_spread(spread);
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
    
    // Calculate microprice and divergence
    calculateMicroprice(snapshot, result, best_bid_px, best_ask_px, best_bid_q, best_ask_q);
    
    // Set L1 fields
    result.set_best_bid(best_bid_px);
    result.set_best_ask(best_ask_px);
    result.set_q_bid(best_bid_q);
    result.set_q_ask(best_ask_q);
    
    // Update price history for volatility calculation
    price_history.push_back(snapshot.mid_price());
    if (price_history.size() > price_history_size) {
        price_history.pop_front();
    }
    
    // Calculate volatility for regime classification
    double volatility = 0.0;
    if (price_history.size() >= 10) {
        std::vector<double> log_returns;
        for (size_t i = 1; i < price_history.size(); i++) {
            if (price_history[i-1] > 0) {
                double ret = std::log(price_history[i] / price_history[i-1]);
                log_returns.push_back(ret);
            }
        }
        
        if (!log_returns.empty()) {
            double mean = std::accumulate(log_returns.begin(), log_returns.end(), 0.0) / log_returns.size();
            double variance = 0.0;
            for (double ret : log_returns) {
                variance += (ret - mean) * (ret - mean);
            }
            volatility = std::sqrt(variance / log_returns.size()) * 1000.0;
        }
    }
    
    // Update dynamic averages for spread z-score
    // Now 'spread' is available at this scope
    avg_spread = (1 - alpha) * avg_spread + alpha * spread;
    avg_spread_sq = (1 - alpha) * avg_spread_sq + alpha * (spread * spread);
    double std_spread = std::sqrt(std::max(0.0, avg_spread_sq - avg_spread * avg_spread));
    double spread_z = (spread - avg_spread) / std::max(std_spread, 1e-6);
    
    // Normalize OFI for regime classification
    double ofi_normalized = ofi;  // Already normalized to [-1, 1] range above
    
    // Classify regime
    int regime = classifyRegime(spread_z, obi, volatility, ofi_normalized);
    result.set_regime(regime);
    
    // Set regime label
    const char* regime_labels[] = {"Calm", "Stressed", "Execution Hot", "Manipulation Suspected"};
    result.set_regime_label(regime_labels[regime]);
    
    // VPIN is set to 0 (requires trade data not available)
    result.set_vpin(0.0);
    
    // Update state for next iteration
    prev_best_bid = best_bid_px;
    prev_best_ask = best_ask_px;
    prev_bid_q = best_bid_q;
    prev_ask_q = best_ask_q;
    
    // Update dynamic averages
    double current_l1_vol = (best_bid_q + best_ask_q) / 2;
    avg_l1_vol = (1 - alpha) * avg_l1_vol + alpha * current_l1_vol;
    
    // Track volume for spoofing risk
    volume_volatility_history.push_back(current_l1_vol);
    if (volume_volatility_history.size() > vol_history_size) {
        volume_volatility_history.pop_front();
    }
    
    return result;
}

void AnalyticsEngine::calculateMicroprice(const Snapshot& snapshot, ProcessedSnapshot& result,
                                         double best_bid_px, double best_ask_px,
                                         double best_bid_q, double best_ask_q) {
    // Microprice: Volume-weighted fair price
    double total_q_1 = best_bid_q + best_ask_q;
    double microprice = snapshot.mid_price();
    
    if (total_q_1 > 1e-9) {
        microprice = (best_bid_q * best_ask_px + best_ask_q * best_bid_px) / total_q_1;
    }
    
    result.set_microprice(microprice);
    
    // Divergence: How much microprice deviates from mid_price
    double divergence = microprice - snapshot.mid_price();
    result.set_divergence(divergence);
    
    // Directional probability (sigmoid transform)
    double divergence_score = divergence / tick_size;
    double directional_prob = 100.0 / (1.0 + std::exp(-2.0 * divergence_score));
    result.set_directional_prob(directional_prob);
}

int AnalyticsEngine::classifyRegime(double spread_z, double obi, double volatility, double ofi) {
    // Simple heuristic-based regime classification
    // 0 = Calm, 1 = Stressed, 2 = Execution Hot, 3 = Manipulation Suspected
    
    double stress_score = std::abs(spread_z) + std::abs(obi) * 2.0 + volatility / 10.0 + std::abs(ofi) * 3.0;
    
    // Manipulation indicators: extreme OFI + high volatility + wide spread
    if (std::abs(ofi) > 0.7 && volatility > 5.0 && spread_z > 2.0) {
        return 3; // Manipulation Suspected
    }
    
    // Execution hot: high activity but not necessarily manipulative
    if (volatility > 4.0 || std::abs(ofi) > 0.6) {
        return 2; // Execution Hot
    }
    
    // Stressed: moderate stress indicators
    if (stress_score > 3.0) {
        return 1; // Stressed
    }
    
    // Calm: normal market conditions
    return 0;
}

void AnalyticsEngine::detectAnomalies(const Snapshot& snapshot, ProcessedSnapshot& result, 
                                     double spread, double obi, double best_bid_q, double best_ask_q) {
    
    // Liquidity gaps detection
    int gap_count = 0;
    double gap_severity_score = 0.0;
    
    for (int i = 0; i < std::min(10, std::min(snapshot.bids_size(), snapshot.asks_size())); i++) {
        if (snapshot.bids(i).volume() < 50) {
            gap_count++;
            gap_severity_score += (10 - i) * 2;
        }
        if (snapshot.asks(i).volume() < 50) {
            gap_count++;
            gap_severity_score += (10 - i) * 2;
        }
    }
    
    result.set_gap_count(gap_count);
    result.set_gap_severity_score(gap_severity_score);
    
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
    
    // Calculate spoofing risk
    double current_l1_vol = (best_bid_q + best_ask_q) / 2;
    double spoofing_risk = 0.0;
    
    // Volume volatility component
    if (volume_volatility_history.size() >= 5) {
        std::vector<double> vols(volume_volatility_history.begin(), volume_volatility_history.end());
        double mean_vol = std::accumulate(vols.begin(), vols.end(), 0.0) / vols.size();
        double variance = 0.0;
        for (double v : vols) {
            variance += (v - mean_vol) * (v - mean_vol);
        }
        double std_vol = std::sqrt(variance / vols.size());
        double volume_volatility = std_vol / std::max(mean_vol, 1e-6);
        
        double base_risk = std::min(volume_volatility * 50.0, 30.0);
        double event_risk = std::min(spoofing_events_count * 5.0, 40.0);
        double size_risk = 0.0;
        
        if (current_l1_vol > avg_l1_vol * 4) {
            size_risk = 30.0;
        } else if (current_l1_vol > avg_l1_vol * 2) {
            size_risk = 15.0;
        }
        
        spoofing_risk = std::min(base_risk + event_risk + size_risk, 100.0);
    }
    
    result.set_spoofing_risk(spoofing_risk);
    
    // Spoofing-like behavior detection
    if (current_l1_vol > avg_l1_vol * 4) {
        auto* anomaly = result.add_anomalies();
        anomaly->set_type("LARGE_ORDER");
        anomaly->set_severity("medium");
        anomaly->set_message("Unusually large L1 volume detected");
    }
}