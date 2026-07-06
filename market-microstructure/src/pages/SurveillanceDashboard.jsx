import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertOctagon, Settings, Trash, RefreshCw, BarChart2 } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

const ORBITRON = "'Orbitron', monospace";
const ACCENT = "#00ff7f";
const RED = "#ff3232";
const AMBER = "#f59e0b";
const GLASS_BG = "rgba(0, 10, 0, 0.75)";
const BORDER = "1px solid rgba(0, 255, 127, 0.2)";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";

const METRICS_OPTIONS = [
  { value: 'vpin', label: 'VPIN (Toxic Flow)' },
  { value: 'spoofing_risk', label: 'Spoofing Risk' },
  { value: 'volatility_10s', label: '10s Realized Volatility' },
  { value: 'spread', label: 'Spread size' },
  { value: 'gap_severity_score', label: 'Liquidity Gap Severity' }
];

export default function SurveillanceDashboard() {
  const { sessionId } = useAuth();
  const [rules, setRules] = useState([]);
  const [alertsHistory, setAlertsHistory] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  
  // Alert Rule Form state
  const [newRule, setNewRule] = useState({
    metric_name: 'vpin',
    operator: '>',
    threshold_value: 0.6
  });

  // Level 2 Order Book State for Spoof Wall
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const [spoofRisk, setSpoofRisk] = useState(0.0);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    
    // Fetch active rules
    fetch(`${BACKEND_HTTP}/alerts/rules/${sessionId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.rules) setRules(data.rules);
      });

    // Fetch alert history
    fetch(`${BACKEND_HTTP}/alerts/history/${sessionId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.history) setAlertsHistory(data.history);
      });

    // Connect WebSocket
    const wsUrl = BACKEND_HTTP.replace(/^http/, "ws") + `/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") {
          setBids(msg.bids || []);
          setAsks(msg.asks || []);
          setSpoofRisk(msg.spoofing_risk || 0.0);
        }
        else if (msg.type === "custom_alerts") {
          setLiveAlerts(prev => [...msg.data, ...prev].slice(0, 30));
          setAlertsHistory(prev => [...msg.data, ...prev].slice(0, 50));
        }
      } catch (err) {
        console.error("WS surveillance error: ", err);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleAddRule = (e) => {
    e.preventDefault();
    fetch(`${BACKEND_HTTP}/alerts/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        ...newRule
      }),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        if (data.rule) {
          setRules(prev => [...prev, data.rule]);
        }
      });
  };

  const handleClearRules = () => {
    fetch(`${BACKEND_HTTP}/alerts/rules/${sessionId}`, {
      method: "DELETE",
      credentials: 'include'
    })
      .then(r => r.json())
      .then(() => setRules([]));
  };

  // Draw Level 2 order book highlighting spoof risk
  const maxVol = Math.max(
    ...bids.map(b => b[1]),
    ...asks.map(a => a[1]),
    1.0
  );

  return (
    <DashboardLayout>
      <div style={{ width: "100%", height: "100%", padding: "24px", boxSizing: "border-box", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'Rajdhani', sans-serif" }}>
        
        {/* Title */}
        <div>
          <h1 style={{ fontFamily: ORBITRON, fontSize: "24px", fontWeight: "bold", margin: 0, color: "white", letterSpacing: "2px" }}>
            SURVEILLANCE & <span style={{ color: ACCENT }}>RISK</span>
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Configure alert rules, monitor order book manipulation walls, and view triggers
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
          
          {/* Rules Panel */}
          <div style={{ background: GLASS_BG, border: BORDER, padding: "16px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Settings size={14} /> ALERT CONFIGURATION
            </h3>

            <form onSubmit={handleAddRule} style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "#94a3b8" }}>Select Metric:</span>
                <select
                  value={newRule.metric_name}
                  onChange={(e) => setNewRule({ ...newRule, metric_name: e.target.value })}
                  style={{ background: "rgba(0,0,0,0.5)", border: BORDER, color: "white", padding: "6px", fontFamily: ORBITRON }}
                >
                  {METRICS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Operator:</span>
                  <select
                    value={newRule.operator}
                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    style={{ background: "rgba(0,0,0,0.5)", border: BORDER, color: "white", padding: "6px", fontFamily: ORBITRON }}
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="==">==</option>
                  </select>
                </div>

                <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Value:</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={newRule.threshold_value}
                    onChange={(e) => setNewRule({ ...newRule, threshold_value: parseFloat(e.target.value) })}
                    style={{ background: "rgba(0,0,0,0.5)", border: BORDER, color: "white", padding: "6px", fontFamily: ORBITRON }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  background: "rgba(0, 255, 127, 0.15)",
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  padding: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: ORBITRON,
                  marginTop: "6px"
                }}
              >
                ADD ALERT RULE
              </button>
            </form>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: ORBITRON }}>ACTIVE RULES</span>
                <button
                  onClick={handleClearRules}
                  style={{ background: "none", border: "none", color: RED, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontFamily: ORBITRON }}
                >
                  <Trash size={10} /> CLEAR ALL
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto", fontSize: "11px", fontFamily: "monospace" }}>
                {rules.map((r, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.02)", padding: "6px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                    <span>{r.metric_name}</span>
                    <span style={{ color: ACCENT }}>{r.operator} {r.threshold_value}</span>
                  </div>
                ))}
                {rules.length === 0 && (
                  <div style={{ color: "#64748b", textAlign: "center", padding: "10px" }}>No alert rules configured.</div>
                )}
              </div>
            </div>
          </div>

          {/* Spoofing Wall Visualizer */}
          <div style={{ background: GLASS_BG, border: BORDER, padding: "16px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, margin: 0 }}>
                L2 ORDER DEPTH & SPOOF WALL RADAR
              </h3>
              <div style={{
                fontFamily: ORBITRON, fontSize: "10px", padding: "2px 8px",
                background: spoofRisk > 0.6 ? "rgba(239,68,68,0.2)" : "rgba(0,255,127,0.1)",
                border: `1px solid ${spoofRisk > 0.6 ? RED : ACCENT}`,
                color: spoofRisk > 0.6 ? RED : ACCENT
              }}>
                SPOOF RISK: {(spoofRisk * 100).toFixed(1)}%
              </div>
            </div>

            {/* Simulated order book visualizer */}
            <div style={{ display: "flex", gap: "20px", flex: 1, minHeight: "220px", fontSize: "11px", fontFamily: "monospace" }}>
              {/* Bids */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "3px" }}>
                <div style={{ color: ACCENT, borderBottom: "1px solid rgba(0, 255, 127, 0.2)", paddingBottom: "4px", fontWeight: "bold" }}>BIDS (BUY DEPTH)</div>
                {bids.slice(0, 8).map((b, idx) => {
                  const width = (b[1] / maxVol) * 100;
                  // If spoof risk is high and volume is unusually large, highlight wall in yellow/red
                  const isWall = b[1] > maxVol * 0.7 && spoofRisk > 0.5;
                  const barColor = isWall ? AMBER : "rgba(0, 255, 127, 0.2)";
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "2px 6px" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${width}%`, background: barColor, zIndex: 0, transition: "width 0.2s" }} />
                      <span style={{ zIndex: 1, color: isWall ? AMBER : ACCENT, fontWeight: "bold" }}>${b[0].toFixed(2)}</span>
                      <span style={{ zIndex: 1, color: "white" }}>{b[1].toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Asks */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "3px" }}>
                <div style={{ color: RED, borderBottom: "1px solid rgba(239, 68, 68, 0.2)", paddingBottom: "4px", fontWeight: "bold" }}>ASKS (SELL DEPTH)</div>
                {asks.slice(0, 8).map((a, idx) => {
                  const width = (a[1] / maxVol) * 100;
                  const isWall = a[1] > maxVol * 0.7 && spoofRisk > 0.5;
                  const barColor = isWall ? AMBER : "rgba(239, 68, 68, 0.2)";
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "2px 6px" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${width}%`, background: barColor, zIndex: 0, transition: "width 0.2s" }} />
                      <span style={{ zIndex: 1, color: "white" }}>{a[1].toFixed(1)}</span>
                      <span style={{ zIndex: 1, color: isWall ? AMBER : RED, fontWeight: "bold" }}>${a[0].toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Live Triggers Timeline */}
        <div style={{ background: GLASS_BG, border: BORDER, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "250px" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0, 255, 127, 0.1)", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: ORBITRON, fontSize: "12px", color: RED, fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldAlert size={14} /> SURVEILLANCE RADAR FEED
            </span>
            <span style={{ fontSize: "10px", color: "#64748b" }}>REALTIME TRIGGER TIMELINE</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontFamily: "monospace", fontSize: "12px" }}>
              {alertsHistory.map((a, idx) => (
                <div key={idx} style={{
                  padding: "8px 12px",
                  borderLeft: `3px solid ${RED}`,
                  background: "rgba(239, 68, 68, 0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <AlertOctagon size={14} color={RED} />
                    <span style={{ color: "white" }}>{a.message}</span>
                  </div>
                  <div style={{ display: "flex", gap: "15px", color: "#64748b" }}>
                    <span>Val: {a.actual_value.toFixed(4)}</span>
                    <span>{a.timestamp}</span>
                  </div>
                </div>
              ))}
              {alertsHistory.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Radar clear. No surveillance triggers generated.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
