import React from 'react';

export default function SignalMonitor({ snapshot }) {
  if (!snapshot || !snapshot.anomalies || snapshot.anomalies.length === 0) {
    return (
      <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#4b5563' }}>No Active Signals</span>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444'; // Red
      case 'high': return '#f97316'; // Orange
      case 'medium': return '#eab308'; // Yellow
      default: return '#3b82f6'; // Blue
    }
  };

  return (
    <div style={{ height: '150px', overflowY: 'auto', marginBottom: '16px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
        🚨 Market Signals
      </h4>
      <div className="signals-list">
        {snapshot.anomalies.map((anomaly, idx) => (
          <div 
            key={idx} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '8px',
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`
            }}
          >
            <span style={{ 
              fontWeight: 'bold', 
              color: getSeverityColor(anomaly.severity),
              marginRight: '10px',
              fontSize: '0.8rem'
            }}>
              [{anomaly.type}]
            </span>
            <span style={{ fontSize: '0.9rem', color: '#d1d5db' }}>
              {anomaly.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}