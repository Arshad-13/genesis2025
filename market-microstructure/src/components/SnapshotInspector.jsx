export default function SnapshotInspector({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="panel snapshot">
        <h4>Snapshot Inspector</h4>
        <div className="loading">Waiting for data...</div>
      </div>
    );
  }

  const anomalies = snapshot.anomalies || [];
  const hasHighSeverity = anomalies.some(a => a.severity === 'critical' || a.severity === 'high');
  const hoveredGap = snapshot.hoveredGap;
  const liquidityGaps = snapshot.liquidity_gaps || [];

  return (
    <div className="panel snapshot">
      <h4>Snapshot Inspector</h4>
      
      {anomalies.length > 0 && (
        <div className={`alert ${hasHighSeverity ? 'critical' : 'warning'}`}>
          {anomalies.map((a, i) => (
            <div key={i}>DETECTED ANOMALY: {a.message}</div>
          ))}
        </div>
      )}

      {hoveredGap && (
        <div className="alert" style={{ 
          borderColor: '#f59e0b', 
          color: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          marginTop: '10px',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #f59e0b'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
            🔍 LIQUIDITY GAP ANALYSIS
          </div>
          <div style={{ fontSize: '11px', marginBottom: '2px' }}>
            Price: ${hoveredGap.price.toFixed(2)} ({hoveredGap.side.toUpperCase()} Level {hoveredGap.level})
          </div>
          <div style={{ fontSize: '11px', marginBottom: '2px' }}>
            Volume: {hoveredGap.volume} units | Risk Score: {hoveredGap.risk_score}%
          </div>
          <div style={{ fontSize: '11px' }}>
            Distance from Mid: {hoveredGap.distance_from_mid.toFixed(4)}
          </div>
        </div>
      )}

      <div className="snapshot-details">
        <div className="detail-row">
          <span>Time:</span>
          <span>{new Date(snapshot.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="detail-row">
          <span>Mid Price:</span>
          <span>{snapshot.mid_price?.toFixed(2)}</span>
        </div>
        <div className="detail-row">
          <span>Spread:</span>
          <span>{snapshot.spread?.toFixed(4)}</span>
        </div>
        <div className="detail-row">
          <span>Regime:</span>
          <span style={{ fontWeight: 'bold', color: snapshot.regime === 0 ? '#4ade80' : '#f87171' }}>
            {snapshot.regime_label || "Unknown"}
          </span>
        </div>
        <div className="detail-row">
          <span>OBI:</span>
          <span className={snapshot.obi > 0 ? 'text-green' : 'text-red'}>
            {snapshot.obi?.toFixed(4)}
          </span>
        </div>
        <div className="detail-row">
          <span>Divergence:</span>
          <span className={snapshot.divergence > 0 ? 'text-green' : 'text-red'}>
            {snapshot.divergence?.toFixed(4)}
          </span>
        </div>
        <div className="detail-row">
          <span>Dir. Prob:</span>
          <span>{snapshot.directional_prob}%</span>
        </div>
        <div className="detail-row">
          <span>Best Bid Q:</span>
          <span>{snapshot.q_bid}</span>
        </div>
        <div className="detail-row">
          <span>Best Ask Q:</span>
          <span>{snapshot.q_ask}</span>
        </div>
        {liquidityGaps.length > 0 && (
          <div className="detail-row" style={{ 
            marginTop: '8px', 
            borderTop: '1px solid #374151', 
            paddingTop: '8px' 
          }}>
            <span>Liquidity Gaps:</span>
            <span style={{ 
              color: liquidityGaps.length > 2 ? '#ef4444' : '#f59e0b', 
              fontWeight: 'bold' 
            }}>
              {liquidityGaps.length} detected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
