import { Link } from "react-router-dom";
import "../styles/home.css";

export default function Home() {
  return (
    <div className="home-shell">
      <div className="home-card">
        <h1 className="home-title">Market Microstructure Analyzer</h1>
        <p className="home-subtitle">
          L2 Order Book · Liquidity · Anomaly Detection
        </p>

        <Link to="/dashboard">
          <button className="home-cta">Open Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
