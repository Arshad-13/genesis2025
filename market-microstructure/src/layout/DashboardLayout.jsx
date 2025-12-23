import { useState } from "react";
import ControlsBar from "../components/ControlsBar";
import CanvasPriceChart from "../components/CanvasPriceChart";
import CanvasHeatmap from "../components/CanvasHeatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";

export default function DashboardLayout({ data, latestSnapshot }) {
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);
  const activeSnapshot = hoveredSnapshot || latestSnapshot;

  return (
  <div className="dashboard-shell">
    <ControlsBar />

    <div className="dashboard-grid">
      {/* Left Column */}
      <div className="left-column">
        <div className="panel fixed price">
          <CanvasPriceChart data={data} height={220} />
        </div>

        <div className="panel fixed heatmap">
          <CanvasHeatmap data={data} height={220} onHover={setHoveredSnapshot} />
        </div>

        <div className="panel features-scroll">
          <FeaturePanel title="Order Book Imbalance" data={data} dataKey="obi" color="#38bdf8" threshold={0.5} />
          <FeaturePanel title="Spread" data={data} dataKey="spread" color="#f472b6" isSpread />
        </div>
      </div>

      {/* Right Column */}
      <div className="right-column">
        <div className="panel inspector-scroll">
          <SnapshotInspector snapshot={activeSnapshot} />
        </div>

        <div className="panel ladder-scroll">
          <PriceLadder snapshot={activeSnapshot} />
        </div>
      </div>
    </div>
  </div>
);
}
