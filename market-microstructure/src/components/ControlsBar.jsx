export default function ControlsBar() {
  return (
    <div className="controls">
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
