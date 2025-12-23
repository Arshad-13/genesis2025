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
          <span>OFI:</span>
          <span className={snapshot.ofi > 0 ? 'text-green' : 'text-red'}>
            {snapshot.ofi?.toFixed(4)}
          </span>
        </div>
        <div className="detail-row">
          <span>V-PIN:</span>
          <span style={{ color: snapshot.vpin > 0.4 ? '#ef4444' : '#94a3b8' }}>
            {snapshot.vpin?.toFixed(4)}
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
      </div>
    </div>
  );
}
