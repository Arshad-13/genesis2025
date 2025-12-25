import React, { useState } from 'react';

export default function LiquidityGapMonitor({ snapshot, data = [] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get recent liquidity gap events
  const recentGaps = data
    .filter(d => d.anomalies?.some(a => a.type === 'LIQUIDITY_GAP'))
    .slice(-10);

  const currentGaps = snapshot?.anomalies?.filter(a => a.type === 'LIQUIDITY_GAP') || [];

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#3b82f6';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      default: return '🔵';
    }
  };

  // Show only top 3 recent events
  const displayedGaps = recentGaps.slice(-3).reverse();

  return (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '0.875rem', 
        fontWeight: 600, 
        color: '#e5e7eb', 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        borderBottom: '1px solid #374151',
        paddingBottom: '8px'
      }}>
        💧 Liquidity Gap Monitor
      </h4>

      {/* Current Status */}
      <div style={{ marginBottom: '12px' }}>
        {currentGaps.length > 0 ? (
          currentGaps.map((gap, idx) => (
            <div 
              key={idx}
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${getSeverityColor(gap.severity)}`,
                borderRadius: '6px',
                marginBottom: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: getSeverityColor(gap.severity), fontWeight: 'bold', fontSize: '0.8rem' }}>
                  {getSeverityIcon(gap.severity)} ACTIVE GAP
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  {gap.gap_count} levels affected
                </span>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', marginTop: '4px' }}>
                {gap.message}
              </div>
              {gap.total_gap_volume !== undefined && (
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '2px' }}>
                  Total gap volume: {gap.total_gap_volume.toFixed(0)}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ 
            padding: '12px', 
            textAlign: 'center', 
            color: '#4b5563',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px'
          }}>
            ✅ No liquidity gaps detected
          </div>
        )}
      </div>

      {/* Recent History - Top 3 */}
      {displayedGaps.length > 0 && (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h5 style={{ 
              margin: 0, 
              fontSize: '0.75rem', 
              color: '#9ca3af',
              textTransform: 'uppercase'
            }}>
              Recent Events
            </h5>
            {recentGaps.length > 3 && (
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
                  fontWeight: '500'
                }}
              >
                View All ({recentGaps.length})
              </button>
            )}
          </div>
          <div>
            {displayedGaps.map((event, idx) => {
              const gap = event.anomalies.find(a => a.type === 'LIQUIDITY_GAP');
              return (
                <div 
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderLeft: `3px solid ${getSeverityColor(gap.severity)}`,
                    marginBottom: '4px',
                    fontSize: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: getSeverityColor(gap.severity) }}>
                      {gap.gap_count} gaps
                    </span>
                    <span style={{ color: '#6b7280' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal for Full Event List */}
      {isModalOpen && (
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
            zIndex: 1000,
            padding: '40px'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              border: '2px solid #334155',
              width: '600px',
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
                💧 All Liquidity Gap Events
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
                  fontWeight: '600'
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              {recentGaps.length > 0 ? (
                recentGaps.slice().reverse().map((event, idx) => {
                  const gap = event.anomalies.find(a => a.type === 'LIQUIDITY_GAP');
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${getSeverityColor(gap.severity)}`,
                        borderLeft: `4px solid ${getSeverityColor(gap.severity)}`,
                        borderRadius: '6px',
                        marginBottom: '10px'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <span style={{ 
                          color: getSeverityColor(gap.severity),
                          fontWeight: 'bold',
                          fontSize: '0.9rem'
                        }}>
                          {getSeverityIcon(gap.severity)} {gap.severity?.toUpperCase()} - {gap.gap_count} gaps
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ color: '#d1d5db', fontSize: '0.85rem', marginBottom: '4px' }}>
                        {gap.message}
                      </div>
                      {gap.total_gap_volume !== undefined && (
                        <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                          Total gap volume: {gap.total_gap_volume.toFixed(0)}
                        </div>
                      )}
                      {gap.affected_levels && (
                        <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                          Affected levels: {gap.affected_levels.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#9ca3af',
                  padding: '40px'
                }}>
                  No liquidity gap events found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}