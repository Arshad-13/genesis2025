import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, Grid, Sparkles, HelpCircle } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

const ORBITRON = "'Orbitron', monospace";
const ACCENT = "#00ff7f";
const GLASS_BG = "rgba(0, 10, 0, 0.75)";
const BORDER = "1px solid rgba(0, 255, 127, 0.2)";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";

export default function MicrostructureLab() {
  const { sessionId } = useAuth();
  const [correlations, setCorrelations] = useState([]);
  const [featureNames, setFeatureNames] = useState([]);
  const [topFeatures, setTopFeatures] = useState([]);
  const [scatterPoints, setScatterPoints] = useState([]);
  const [vpinHistory, setVpinHistory] = useState([]);

  const wsRef = useRef(null);

  // Poll correlations
  useEffect(() => {
    const fetchCorrelations = () => {
      fetch(`${BACKEND_HTTP}/lab/correlations`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.correlations) {
            setCorrelations(data.correlations);
            setFeatureNames(data.features);
          }
        })
        .catch(console.error);
    };

    fetchCorrelations();
    const interval = setInterval(fetchCorrelations, 5000); // 5s refresh

    return () => clearInterval(interval);
  }, []);

  // Connect WebSocket for saliency and real-time scatter plot
  useEffect(() => {
    const wsUrl = BACKEND_HTTP.replace(/^http/, "ws") + `/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") {
          // Model Saliency (Top Features)
          if (msg.prediction && msg.prediction.top_features) {
            setTopFeatures(msg.prediction.top_features);
          }

          // Build scatter plot: OFI vs Price Change
          const ofi = msg.obi || 0;
          const returnVal = msg.divergence || 0;  // divergence between microprice and mid-price
          if (ofi !== 0 && returnVal !== 0) {
            setScatterPoints(prev => [...prev, { x: ofi, y: returnVal }].slice(-50));
          }

          // VPIN history
          if (msg.vpin) {
            setVpinHistory(prev => [...prev, msg.vpin].slice(-30));
          }
        }
      } catch (err) {
        console.error("WS Lab error: ", err);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  // Color mapping helper for correlation matrix (-1 to 1)
  const getCellColor = (val) => {
    if (val > 0) {
      return `rgba(0, 255, 127, ${val})`; // green for positive
    } else {
      return `rgba(239, 68, 68, ${Math.abs(val)})`; // red for negative
    }
  };

  return (
    <DashboardLayout>
      <div style={{ width: "100%", height: "100%", padding: "24px", boxSizing: "border-box", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'Rajdhani', sans-serif" }}>
        
        {/* Title */}
        <div>
          <h1 style={{ fontFamily: ORBITRON, fontSize: "24px", fontWeight: "bold", margin: 0, color: "white", letterSpacing: "2px" }}>
            MICROSTRUCTURE <span style={{ color: ACCENT }}>LAB</span>
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Interactive features workbench: saliency gradient maps, scatter plots, and rolling correlations
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px" }}>
          
          {/* Feature Saliency (Inference Saliency Maps) */}
          <div style={{ background: GLASS_BG, border: BORDER, padding: "16px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} /> DEEPLOB GRADIENT SALIENCY (INPUT IMPORTANCE)
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              Live backpropagation weights representing which L2 Order Book levels most heavily drive predictions on this tick.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              {topFeatures.map((f, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ fontWeight: "bold" }}>{f.name}</span>
                    <span style={{ color: ACCENT, fontFamily: ORBITRON }}>{(f.weight * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${f.weight * 100}%`, background: ACCENT, transition: "width 0.3s" }} />
                  </div>
                </div>
              ))}
              {topFeatures.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                  Awaiting inference sequences (needs 100 consecutive snapshots)
                </div>
              )}
            </div>
          </div>

          {/* Real-time scatter plot OFI vs Microprice Divergence */}
          <div style={{ background: GLASS_BG, border: BORDER, padding: "16px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={14} /> SIGNAL RELATION: OFI VS MICROPRICE DIVERGENCE
            </h3>
            
            {/* SVG scatter plot */}
            <div style={{ flex: 1, minHeight: "220px", display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
              <svg width="100%" height="220" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Crosshairs */}
                <line x1="0" y1="110" x2="100%" y2="110" stroke="rgba(255,255,255,0.1)" strokeDasharray="3" />
                <line x1="50%" y1="0" x2="50%" y2="220" stroke="rgba(255,255,255,0.1)" strokeDasharray="3" />
                
                {/* Plot points */}
                {scatterPoints.map((pt, idx) => {
                  // Normalize coordinate limits
                  const cx = 50 + (pt.x / 500) * 50;  // OFI range ~ -500 to 500
                  const cy = 50 - (pt.y / 2) * 50;    // Return range ~ -2 to 2
                  return (
                    <circle
                      key={idx}
                      cx={`${Math.min(95, Math.max(5, cx))}%`}
                      cy={`${Math.min(95, Math.max(5, cy))}%`}
                      r="4"
                      fill={ACCENT}
                      opacity={0.7}
                    />
                  );
                })}
              </svg>
              <div style={{ position: "absolute", bottom: "4px", fontSize: "10px", color: "#64748b" }}>Order Flow Imbalance (OFI)</div>
              <div style={{ position: "absolute", left: "4px", transform: "rotate(-90deg)", transformOrigin: "left bottom", fontSize: "10px", color: "#64748b", bottom: "40px" }}>Microprice Div</div>
            </div>
          </div>

        </div>

        {/* Feature Correlation Matrix */}
        <div style={{ background: GLASS_BG, border: BORDER, padding: "16px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Grid size={14} /> ROLLING 100-TICK FEATURE CORRELATION MATRIX
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", margin: "10px auto", fontSize: "11px", fontFamily: "monospace" }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px", color: "#64748b" }}>FEATURE</th>
                  {featureNames.map((name, i) => (
                    <th key={i} style={{ padding: "6px", color: "#64748b", transform: "rotate(-30deg)", whiteSpace: "nowrap", height: "40px" }}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlations.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ padding: "6px", color: "white", fontWeight: "bold", borderRight: "1px solid rgba(255,255,255,0.05)" }}>{featureNames[rIdx]}</td>
                    {row.map((val, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          width: "36px",
                          height: "36px",
                          background: getCellColor(val),
                          textAlign: "center",
                          color: Math.abs(val) > 0.5 ? "black" : "white",
                          fontWeight: "bold",
                          fontSize: "9px",
                          border: "1px solid rgba(0,0,0,0.2)"
                        }}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {correlations.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                Generating correlation statistics...
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
