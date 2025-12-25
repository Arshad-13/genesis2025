#pragma once

#include "analytics.grpc.pb.h"

using analytics::Snapshot;
using analytics::ProcessedSnapshot;

class AnalyticsEngine {
public:
    AnalyticsEngine();
    ProcessedSnapshot processSnapshot(const Snapshot& snapshot);

private:
    void detectAnomalies(const Snapshot& snapshot, ProcessedSnapshot& result, 
                        double spread, double obi, double best_bid_q, double best_ask_q);
    
    // State for OFI calculation
    double prev_best_bid;
    double prev_best_ask;
    double prev_bid_q;
    double prev_ask_q;
    
    // Dynamic baselines
    double avg_spread;
    double avg_l1_vol;
    double alpha; // EWMA smoothing factor
};