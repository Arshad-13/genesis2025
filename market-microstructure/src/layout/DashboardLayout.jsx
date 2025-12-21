import ControlsBar from "../components/ControlsBar";
import PriceChart from "../components/PriceChart";
import Heatmap from "../components/Heatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";

export default function DashboardLayout() {
  return (
    <div className="container">
      <ControlsBar />

      <div className="content">
        {/* LEFT 75% */}
        <div className="main">
          <PriceChart />
          <Heatmap />
          <FeaturePanel title="Order Book Imbalance" />
          <FeaturePanel title="Spread" />
        </div>

        {/* RIGHT 25% */}
        <div className="sidebar">
          <SnapshotInspector />
          <PriceLadder />
        </div>
      </div>
    </div>
  );
}
