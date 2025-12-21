import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Market Microstructure Analyzer</h1>
      <p>L2 Order Book Anomaly Detection Dashboard</p>

      <Link to="/dashboard">
        <button>Open Dashboard</button>
      </Link>
    </div>
  );
}
