import ControlsBar from "../components/ControlsBar";
import PriceChart from "../components/PriceChart";
import Heatmap from "../components/Heatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";

export default function DashboardLayout({ data, latestSnapshot }) {
  return (
    <div className="container">
      <ControlsBar />

      <div className="content">
        {/* LEFT 75% */}
        <div className="main">
          <PriceChart data={data} />
          <Heatmap data={data} />
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
          <SnapshotInspector snapshot={latestSnapshot} />
          <PriceLadder snapshot={latestSnapshot} />
        </div>
      </div>
    </div>
  );
}
