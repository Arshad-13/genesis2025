import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function SignalMonitor({ snapshot }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!snapshot || !snapshot.anomalies || snapshot.anomalies.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ color: '#4b5563' }}>No Active Signals</span>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#3b82f6';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'LIQUIDITY_GAP': return '💧';
      case 'SPOOFING': return '🎭';
      case 'DEPTH_SHOCK': return '💥';
      case 'HEAVY_IMBALANCE': return '⚖️';
      case 'REGIME_STRESS': return '📊';
      case 'REGIME_CRISIS': return '🚨';
      case 'LARGE_ORDER': return '📦';
      case 'SPREAD_SHOCK': return '📈';
      default: return '⚠️';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'LIQUIDITY_GAP': return '#06b6d4';
      case 'SPOOFING': return '#ef4444';
      case 'DEPTH_SHOCK': return '#f97316';
      case 'HEAVY_IMBALANCE': return '#8b5cf6';
      case 'REGIME_STRESS': return '#eab308';
      case 'REGIME_CRISIS': return '#dc2626';
      default: return '#6b7280';
    }
  };

  // Sort anomalies by severity (critical first)
  const sortedAnomalies = [...snapshot.anomalies].sort((a, b) => {
    const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Show only top 1 signal
  const displayedSignals = sortedAnomalies.slice(0, 1);

  const renderSignal = (anomaly, idx) => (
    <div 
      key={idx} 
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        marginBottom: '8px',
        padding: '10px',
        backgroundColor: anomaly.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
        borderRadius: '6px',
        borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`,
        border: anomaly.severity === 'critical' ? `1px solid ${getSeverityColor(anomaly.severity)}` : 'none'
      }}
    >
      <div style={{ marginRight: '8px', fontSize: '1rem' }}>
        {getTypeIcon(anomaly.type)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ 
            fontWeight: 'bold', 
            color: getTypeColor(anomaly.type),
            marginRight: '8px',
            fontSize: '0.75rem'
          }}>
            {anomaly.type.replace('_', ' ')}
          </span>
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: getSeverityColor(anomaly.severity),
            color: 'white',
            textTransform: 'uppercase'
          }}>
            {anomaly.severity}
          </span>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#d1d5db', lineHeight: '1.3' }}>
          {anomaly.message}
        </div>
        {anomaly.type === 'LIQUIDITY_GAP' && anomaly.gap_count && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
            {anomaly.gap_count} levels affected
          </div>
        )}
        {anomaly.type === 'SPOOFING' && anomaly.volume_ratio && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
            Volume dropped {anomaly.volume_ratio.toFixed(1)}x at ${anomaly.price_level?.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );

  const modalContent = isModalOpen && createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '40px'
      }}
      onClick={() => setIsModalOpen(false)}
    >
      <div 
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '2px solid #334155',
          width: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#e2e8f0'
          }}>
            🚨 All Market Signals ({sortedAnomalies.length})
          </h2>
          <button 
            onClick={() => setIsModalOpen(false)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ef4444',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            × Close
          </button>
        </div>

        {/* Modal Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          {sortedAnomalies.map((anomaly, idx) => renderSignal(anomaly, idx))}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: '0.875rem', 
          fontWeight: 600, 
          color: '#e5e7eb', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          borderBottom: '1px solid #374151',
          paddingBottom: '8px',
          flex: 1
        }}>
           Market Signals
        </h4>
        {sortedAnomalies.length > 1 && (
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '2px 8px',
              fontSize: '0.7rem',
              backgroundColor: '#334155',
              color: '#3b82f6',
              border: '1px solid #475569',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              marginLeft: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#475569';
              e.currentTarget.style.color = '#60a5fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.color = '#3b82f6';
            }}
          >
            View All ({sortedAnomalies.length})
          </button>
        )}
      </div>
      
      <div className="signals-list">
        {displayedSignals.map((anomaly, idx) => renderSignal(anomaly, idx))}
      </div>

      {/* Render modal via portal */}
      {modalContent}
    </div>
  );
}