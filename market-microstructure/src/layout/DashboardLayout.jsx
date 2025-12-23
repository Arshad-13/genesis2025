import { useState } from "react";
import ControlsBar from "../components/ControlsBar";
import CanvasPriceChart from "../components/CanvasPriceChart";
import CanvasHeatmap from "../components/CanvasHeatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";

export default function DashboardLayout({ data, latestSnapshot, onOrder }) {
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);

  // If user is hovering over heatmap, show that historical snapshot.
  // Otherwise, show the latest live snapshot.
  const activeSnapshot = hoveredSnapshot || latestSnapshot;

  return (
    <div className="container">
      <ControlsBar onOrder={onOrder} />

      <div className="content">
        {/* LEFT 75% */}
        <div className="main">
          <CanvasPriceChart data={data} height={250} />
          <CanvasHeatmap data={data} height={250} onHover={setHoveredSnapshot} />
          <FeaturePanel 
            title="Order Book Imbalance" 
            data={data} 
            dataKey="obi" 
            color="#38bdf8" 
            threshold={0.5}
          />
          <FeaturePanel 
            title="Spread" 
            data={data} 
            dataKey="spread" 
            color="#f472b6" 
            isSpread={true}
          />
          <FeaturePanel 
            title="V-PIN (Toxic Flow)" 
            data={data} 
            dataKey="vpin" 
            color="#ef4444" 
            threshold={0.4}
          />
        </div>

        {/* RIGHT 25% */}
        <div className="sidebar">
          <SnapshotInspector snapshot={activeSnapshot} />
          <PriceLadder snapshot={activeSnapshot} />
        </div>
      </div>
    </div>
  );
}
