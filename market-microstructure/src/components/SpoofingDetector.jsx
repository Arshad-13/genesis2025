import React from 'react';

export default function SpoofingDetector({ snapshot, data = [] }) {
  // Get recent spoofing events
  const recentSpoofing = data
    .filter(d => d.anomalies?.some(a => a.type === 'SPOOFING'))
    .slice(-10);

  const currentSpoofing = snapshot?.anomalies?.filter(a => a.type === 'SPOOFING') || [];

  const getSideColor = (side) => {
    return side === 'BID' ? '#22c55e' : '#ef4444'; // Green for bid, red for ask
  };

  const getSideIcon = (side) => {
    return side === 'BID' ? '📈' : '📉';
  };

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
        {/* 🎭 Spoofing Detector */}
      </h4>

      {/* Current Status */}
      <div style={{ marginBottom: '12px' }}>
        {currentSpoofing.length > 0 ? (
          currentSpoofing.map((spoof, idx) => (
            <div 
              key={idx}
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                marginBottom: '8px',
                animation: 'pulse 2s infinite'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  🚨 SPOOFING DETECTED
                </span>
                <span style={{ 
                  color: getSideColor(spoof.side), 
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
                  {getSideIcon(spoof.side)} {spoof.side}
                </span>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', marginTop: '4px' }}>
                {spoof.message}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                {spoof.price_level && (
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    Price: ${spoof.price_level.toFixed(2)}
                  </span>
                )}
                {spoof.volume_ratio && (
                  <span style={{ color: '#f97316', fontSize: '0.75rem' }}>
                    Volume drop: {spoof.volume_ratio.toFixed(1)}x
                  </span>
                )}
              </div>
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
            ✅ No spoofing activity detected
          </div>
        )}
      </div>

      {/* Recent History */}
      {recentSpoofing.length > 0 && (
        <div>
          <h5 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '0.75rem', 
            color: '#9ca3af',
            textTransform: 'uppercase'
          }}>
            Recent Events ({recentSpoofing.length})
          </h5>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {recentSpoofing.reverse().map((event, idx) => {
              const spoof = event.anomalies.find(a => a.type === 'SPOOFING');
              return (
                <div 
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderLeft: `3px solid ${getSideColor(spoof.side)}`,
                    marginBottom: '4px',
                    fontSize: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: getSideColor(spoof.side) }}>
                      {getSideIcon(spoof.side)} {spoof.side} ${spoof.price_level?.toFixed(2)}
                    </span>
                    <span style={{ color: '#6b7280' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '2px' }}>
                    Volume dropped {spoof.volume_ratio?.toFixed(1)}x
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}