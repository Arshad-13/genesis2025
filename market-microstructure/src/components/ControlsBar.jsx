export default function ControlsBar() {
  return (
    <div className="controls-bar">
      <input type="range" className="time-slider" />

      <div className="controls-right">
        <button className="btn">▶</button>
        <button className="btn">⏸</button>
        <button className="btn">⏭</button>
      </div>
    </div>
  );
}
