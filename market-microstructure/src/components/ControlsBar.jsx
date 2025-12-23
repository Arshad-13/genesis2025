export default function ControlsBar({ onOrder }) {
  return (
    <div className="controls">
      <div className="trading-desk" style={{ marginRight: '20px', display: 'flex', gap: '10px' }}>
        <button 
            onClick={() => onOrder && onOrder('buy', 500)}
            style={{ backgroundColor: '#22c55e', color: 'white', fontWeight: 'bold', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
        >
            BUY
        </button>
        <button 
            onClick={() => onOrder && onOrder('sell', 500)}
            style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
        >
            SELL
        </button>
      </div>

      <input type="range" className="time-slider" />

      <div className="buttons">
        <button>▶</button>
        <button>⏸</button>
        <button>⏭</button>
      </div>

      <div className="toggles">
        <label><input type="checkbox" defaultChecked /> Spoofing</label>
        <label><input type="checkbox" defaultChecked /> Gaps</label>
        <label><input type="checkbox" defaultChecked /> Depth Shocks</label>
      </div>
    </div>
  );
}
