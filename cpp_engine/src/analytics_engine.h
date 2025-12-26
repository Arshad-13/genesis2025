#pragma once

#include "analytics.grpc.pb.h"
#include <vector>
#include <deque>
#include <cmath>

using analytics::Snapshot;
using analytics::ProcessedSnapshot;

class AnalyticsEngine {
public:
    AnalyticsEngine();
    ProcessedSnapshot processSnapshot(const Snapshot& snapshot);

private:
    void detectAnomalies(const Snapshot& snapshot, ProcessedSnapshot& result, 
                        double spread, double obi, double best_bid_q, double best_ask_q);
    
    // Calculate microprice and divergence
    void calculateMicroprice(const Snapshot& snapshot, ProcessedSnapshot& result,
                            double best_bid_px, double best_ask_px,
                            double best_bid_q, double best_ask_q);
    
    // Simple regime classification based on heuristics
    int classifyRegime(double spread_z, double obi, double volatility, double ofi);
    
    // State for OFI calculation
    double prev_best_bid;
    double prev_best_ask;
    double prev_bid_q;
    double prev_ask_q;
    
    // Dynamic baselines
    double avg_spread;
    double avg_spread_sq;
    double avg_l1_vol;
    double alpha; // EWMA smoothing factor
    
    // Price history for volatility
    std::deque<double> price_history;
    const size_t price_history_size = 20;
    
    // Constants
    const double tick_size = 0.01;
    
    // Spoofing tracking
    int spoofing_events_count;
    std::deque<double> volume_volatility_history;
    const size_t vol_history_size = 20;
};