import { useState } from "react";
import ControlsBar from "../components/ControlsBar";
import PriceChart from "../components/PriceChart";
import Heatmap from "../components/Heatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";
import LiquidityGaps from "../components/LiquidityGaps";

export default function DashboardLayout({ data, latestSnapshot }) {
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);

  // If user is hovering over heatmap, show that historical snapshot.
  // Otherwise, show the latest live snapshot.
  const activeSnapshot = hoveredSnapshot || latestSnapshot;

  return (
    <div className="container">
      <ControlsBar />

      <div className="content">
        {/* LEFT 75% */}
        <div className="main">
          <PriceChart data={data} />
          <Heatmap data={data} onHover={setHoveredSnapshot} />
          <LiquidityGaps data={data} onHover={setHoveredSnapshot} />
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
