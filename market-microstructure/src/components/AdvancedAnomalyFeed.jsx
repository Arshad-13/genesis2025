import React, { useMemo } from 'react';

export default function AdvancedAnomalyFeed({ data }) {
  // Extract anomalies from snapshot history
  const anomalies = useMemo(() => {
    if (!data) return [];
    
    const allAnomalies = [];
    
    data.forEach(snap => {
      if (snap.anomalies && snap.anomalies.length > 0) {
        snap.anomalies.forEach(anomaly => {
          // Filter out basic anomalies if needed, or keep all
          // We want to highlight the advanced ones
          allAnomalies.push({
            timestamp: snap.timestamp,
            ...anomaly
          });
        });
      }
    });
    
    return allAnomalies.reverse().slice(0, 50); // Newest first, limit 50
  }, [data]);

  if (anomalies.length === 0) {
    return (
      <div className="panel-content empty-state">
        <div className="empty-text">No anomalies detected</div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#ef4444'; // Red
      case 'high': return '#f97316'; // Orange
      case 'medium': return '#eab308'; // Yellow
      default: return '#3b82f6'; // Blue
    }
  };

  const getAnomalyIcon = (type) => {
    switch (type) {
      case 'QUOTE_STUFFING': return '⚡';
      case 'LAYERING': return '📚';
      case 'MOMENTUM_IGNITION': return '🚀';
      case 'WASH_TRADING': return '🔄';
      case 'ICEBERG_ORDER': return '🧊';
      case 'UNUSUAL_TRADE_SIZE': return '🐋';
      case 'RAPID_TRADING': return '🏎️';
      case 'LIQUIDITY_GAP': return '💧';
      default: return '⚠️';
    }
  };

  return (
    <div className="anomaly-feed-container">
      <div className="anomaly-list">
        {anomalies.map((anomaly, i) => (
          <div 
            key={`${anomaly.timestamp}-${i}`} 
            className="anomaly-card"
            style={{ borderLeftColor: getSeverityColor(anomaly.severity) }}
          >
            <div className="anomaly-header">
              <span className="anomaly-icon">{getAnomalyIcon(anomaly.type)}</span>
              <span className="anomaly-type">{anomaly.type.replace(/_/g, ' ')}</span>
              <span className="anomaly-time">
                {new Date(anomaly.timestamp).toLocaleTimeString([], { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </span>
            </div>
            <div className="anomaly-message">{anomaly.message}</div>
            {anomaly.details && (
              <div className="anomaly-details">
                {Object.entries(anomaly.details).map(([k, v]) => (
                  <div key={k} className="detail-item">
                    <span className="detail-key">{k}:</span>
                    <span className="detail-val">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .anomaly-feed-container {
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .anomaly-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #1f2937;
        }
        
        .anomaly-card {
          background-color: #1f2937;
          border-radius: 4px;
          padding: 8px;
          border-left: 4px solid #3b82f6;
          font-size: 0.8rem;
        }
        
        .anomaly-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        
        .anomaly-type {
          font-weight: 700;
          color: #e5e7eb;
          font-size: 0.75rem;
        }
        
        .anomaly-time {
          margin-left: auto;
          color: #6b7280;
          font-size: 0.7rem;
        }
        
        .anomaly-message {
          color: #d1d5db;
          margin-bottom: 4px;
        }
        
        .anomaly-details {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid #374151;
        }
        
        .detail-item {
          font-size: 0.7rem;
          color: #9ca3af;
        }
        
        .detail-key {
          margin-right: 4px;
          color: #6b7280;
        }
        
        .panel-content.empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
