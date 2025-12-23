export default function ControlsBar({ onOrder }) {
  return (
    <div className="controls-bar">
      <div className="controls-left">
        <button className="btn buy" onClick={() => onOrder?.('buy', 500)}>BUY</button>
        <button className="btn sell" onClick={() => onOrder?.('sell', 500)}>SELL</button>
      </div>

      <input type="range" className="time-slider" />

      <div className="controls-right">
        <button className="btn">▶</button>
        <button className="btn">⏸</button>
        <button className="btn">⏭</button>
      </div>
    </div>
  );
}
