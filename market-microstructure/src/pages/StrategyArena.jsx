import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Sliders, Shield, RefreshCw, BarChart2, Activity, Save, Upload } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

const ORBITRON = "'Orbitron', monospace";
const ACCENT = "#00ff7f";
const RED = "#ff3232";
const BLUE = "#3b82f6";
const YELLOW = "#eab308";
const GLASS_BG = "rgba(0, 10, 0, 0.75)";
const BORDER = "1px solid rgba(0, 255, 127, 0.2)";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";

const StrategyCard = ({ name, keyName, stats, config, onConfigChange, onToggle }) => {
  const pnl = stats?.total || 0;
  const isUp = pnl >= 0;
  const pnlColor = isUp ? ACCENT : RED;
  
  return (
    <div style={{
      background: "rgba(0, 255, 127, 0.03)",
      border: BORDER,
      padding: "16px",
      borderRadius: "4px",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontFamily: ORBITRON, fontSize: "14px", color: "white", margin: 0, letterSpacing: "1px" }}>
          {name}
        </h3>
        <button
          onClick={() => onToggle(keyName)}
          style={{
            background: stats?.is_active ? "rgba(239, 68, 68, 0.15)" : "rgba(0, 255, 127, 0.15)",
            border: `1px solid ${stats?.is_active ? RED : ACCENT}`,
            color: stats?.is_active ? RED : ACCENT,
            padding: "4px 10px",
            fontSize: "10px",
            fontFamily: ORBITRON,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {stats?.is_active ? "DEACTIVATE" : "ACTIVATE"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase" }}>PnL</span>
          <span style={{ fontFamily: ORBITRON, fontSize: "16px", color: pnlColor, fontWeight: "bold" }}>
            ${pnl.toFixed(2)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase" }}>Position</span>
          <span style={{ fontFamily: ORBITRON, fontSize: "16px", color: stats?.position !== 0 ? YELLOW : "white", fontWeight: "bold" }}>
            {stats?.position || "FLAT"}
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "10px", fontFamily: ORBITRON, color: ACCENT }}>
          <Sliders size={12} /> PARAMETERS
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>Size:</span>
              <span>{config?.position_size || 0.5} units</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={config?.position_size || 0.5}
              onChange={(e) => onConfigChange(keyName, { position_size: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: ACCENT }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>Stop Loss %:</span>
              <span>{((config?.stop_loss_pct || 0.01) * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.005"
              max="0.05"
              step="0.005"
              value={config?.stop_loss_pct || 0.015}
              onChange={(e) => onConfigChange(keyName, { stop_loss_pct: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: ACCENT }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>Take Profit %:</span>
              <span>{((config?.take_profit_pct || 0.03) * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.1"
              step="0.01"
              value={config?.take_profit_pct || 0.03}
              onChange={(e) => onConfigChange(keyName, { take_profit_pct: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: ACCENT }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function StrategyArena() {
  const { sessionId } = useAuth();
  const [portfolioStats, setPortfolioStats] = useState({
    realized: 0, unrealized: 0, total: 0, position: 0, is_active: false, circuit_tripped: false,
    strategies: {}
  });
  const [configs, setConfigs] = useState({});
  const [profileName, setProfileName] = useState("default");
  const [trades, setTrades] = useState([]);
  const [message, setMessage] = useState("");
  const wsRef = useRef(null);

  useEffect(() => {
    // Fetch configs
    if (sessionId) {
      fetch(`${BACKEND_HTTP}/strategy/${sessionId}/config`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.config) setConfigs(data.config);
        });
    }

    // Connect WebSocket
    const wsUrl = BACKEND_HTTP.replace(/^http/, "ws") + `/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot" && msg.strategy) {
          setPortfolioStats(msg.strategy.pnl);
          if (msg.strategy.trade_event) {
            setTrades(prev => [msg.strategy.trade_event, ...prev].slice(0, 50));
          }
        }
      } catch (err) {
        console.error("WS error: ", err);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleConfigChange = (stratKey, newParam) => {
    const updated = {
      ...configs,
      [stratKey]: {
        ...configs[stratKey],
        ...newParam
      }
    };
    setConfigs(updated);

    // Push to backend
    fetch(`${BACKEND_HTTP}/strategy/${sessionId}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [stratKey]: newParam }),
      credentials: 'include'
    }).catch(console.error);
  };

  const handleToggle = (stratKey) => {
    const isCurrentlyActive = portfolioStats.strategies?.[stratKey]?.is_active;
    handleConfigChange(stratKey, { is_active: !isCurrentlyActive });
  };

  const handleSaveProfile = () => {
    fetch(`${BACKEND_HTTP}/strategy/${sessionId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", name: profileName }),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => setMessage(data.message));
  };

  const handleLoadProfile = () => {
    fetch(`${BACKEND_HTTP}/strategy/${sessionId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", name: profileName }),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        setMessage(data.message);
        // Refresh configs
        fetch(`${BACKEND_HTTP}/strategy/${sessionId}/config`, { credentials: 'include' })
          .then(r => r.json())
          .then(cData => {
            if (cData.config) setConfigs(cData.config);
          });
      });
  };

  return (
    <DashboardLayout>
      <div style={{ width: "100%", height: "100%", padding: "24px", boxSizing: "border-box", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'Rajdhani', sans-serif" }}>
        
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontFamily: ORBITRON, fontSize: "24px", fontWeight: "bold", margin: 0, color: "white", letterSpacing: "2px" }}>
              STRATEGY <span style={{ color: ACCENT }}>ARENA</span>
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
              Manage, tune, and test quantitative algorithmic strategies side-by-side
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.5)",
                border: BORDER,
                color: "white",
                padding: "6px 12px",
                fontFamily: ORBITRON,
                fontSize: "11px",
                width: "120px"
              }}
            />
            <button onClick={handleSaveProfile} style={{ background: "rgba(0,255,127,0.1)", border: BORDER, color: ACCENT, padding: "6px 12px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              <Save size={12} /> Save
            </button>
            <button onClick={handleLoadProfile} style={{ background: "rgba(0,255,127,0.1)", border: BORDER, color: ACCENT, padding: "6px 12px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              <Upload size={12} /> Load
            </button>
          </div>
        </div>

        {message && <div style={{ color: ACCENT, fontSize: "12px", fontFamily: ORBITRON }}>{message}</div>}

        {/* Portfolio Stats Panel */}
        <div style={{
          background: GLASS_BG,
          border: BORDER,
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px"
        }}>
          <div>
            <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontFamily: ORBITRON }}>PORTFOLIO PNL</span>
            <h2 style={{ fontFamily: ORBITRON, fontSize: "28px", color: portfolioStats.total >= 0 ? ACCENT : RED, margin: "4px 0 0 0" }}>
              ${(portfolioStats.total || 0).toFixed(2)}
            </h2>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontFamily: ORBITRON }}>AGGREGATE POSITION</span>
            <h2 style={{ fontFamily: ORBITRON, fontSize: "28px", color: portfolioStats.position !== 0 ? YELLOW : "white", margin: "4px 0 0 0" }}>
              {portfolioStats.position || "FLAT"}
            </h2>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontFamily: ORBITRON }}>RISK GUARD STATUS</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
              <Shield size={16} color={portfolioStats.circuit_tripped ? RED : ACCENT} />
              <span style={{ fontFamily: ORBITRON, fontSize: "14px", fontWeight: "bold", color: portfolioStats.circuit_tripped ? RED : ACCENT }}>
                {portfolioStats.circuit_tripped ? "TRIPPED" : "NOMINAL"}
              </span>
            </div>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontFamily: ORBITRON }}>ENGINE STATUS</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
              <Activity size={16} color={portfolioStats.is_active ? ACCENT : "#64748b"} />
              <span style={{ fontFamily: ORBITRON, fontSize: "14px", fontWeight: "bold", color: portfolioStats.is_active ? ACCENT : "#64748b" }}>
                {portfolioStats.is_active ? "RUNNING" : "STOPPED"}
              </span>
            </div>
          </div>
        </div>

        {/* Strategy Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <StrategyCard
            name="Momentum Breakout"
            keyName="momentum"
            stats={portfolioStats.strategies?.momentum}
            config={configs.momentum}
            onConfigChange={handleConfigChange}
            onToggle={handleToggle}
          />
          <StrategyCard
            name="Mean Reversion"
            keyName="mean_reversion"
            stats={portfolioStats.strategies?.mean_reversion}
            config={configs.mean_reversion}
            onConfigChange={handleConfigChange}
            onToggle={handleToggle}
          />
          <StrategyCard
            name="Spoofing Counter"
            keyName="spoofing_counter"
            stats={portfolioStats.strategies?.spoofing_counter}
            config={configs.spoofing_counter}
            onConfigChange={handleConfigChange}
            onToggle={handleToggle}
          />
          <StrategyCard
            name="Market Making"
            keyName="market_making"
            stats={portfolioStats.strategies?.market_making}
            config={configs.market_making}
            onConfigChange={handleConfigChange}
            onToggle={handleToggle}
          />
        </div>

        {/* Execution Log */}
        <div style={{ background: GLASS_BG, border: BORDER, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0, 255, 127, 0.1)", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: ORBITRON, fontSize: "12px", color: ACCENT, fontWeight: "bold" }}>EXECUTION HISTORY</span>
            <span style={{ fontSize: "10px", color: "#64748b" }}>LIMIT 50 EVENTS</span>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "monospace" }}>
              <thead>
                <tr style={{ color: "#64748b", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
                  <th style={{ padding: "6px" }}>TIMESTAMP</th>
                  <th style={{ padding: "6px" }}>STRATEGY</th>
                  <th style={{ padding: "6px" }}>SIDE</th>
                  <th style={{ padding: "6px" }}>PRICE</th>
                  <th style={{ padding: "6px" }}>TYPE</th>
                  <th style={{ padding: "6px", textAlign: "right" }}>PNL</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: "6px", color: "#94a3b8" }}>{t.timestamp}</td>
                    <td style={{ padding: "6px", color: "white", fontWeight: "bold" }}>{t.strategy}</td>
                    <td style={{ padding: "6px", color: t.side === "BUY" ? ACCENT : RED, fontWeight: "bold" }}>{t.side}</td>
                    <td style={{ padding: "6px", color: "white" }}>${t.price.toFixed(2)}</td>
                    <td style={{ padding: "6px", color: t.type === "ENTRY" ? BLUE : YELLOW }}>{t.type}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: t.pnl >= 0 ? ACCENT : RED, fontWeight: "bold" }}>
                      {t.pnl !== 0 ? `$${t.pnl.toFixed(2)}` : "-"}
                    </td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                      No trade executions captured for this session
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
