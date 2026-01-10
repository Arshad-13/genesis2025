import React, { useState, useEffect, useRef } from 'react';
import {
    Activity, Server, Clock, Play, Square, TrendingUp, DollarSign,
    BarChart2, Zap, RefreshCw, Triangle
} from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import { TradingViewChart } from '../components/TradingViewChart';
import logger from '../utils/logger';

// --- STYLES CONSTANTS ---
const ORBITRON = "'Orbitron', monospace";
const MONO = "monospace";
const ACCENT = "#00ff7f";
const GLASS_BG = "rgba(0, 10, 0, 0.7)";
const BORDER = "1px solid rgba(0, 255, 127, 0.2)";

// --- COMPONENTS ---

const GenesisPanel = ({ children, style = {}, title, rightHeader }) => {
    return (
        <div style={{
            background: GLASS_BG,
            border: BORDER,
            backdropFilter: "blur(10px)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...style
        }}>
            {/* Top Laser */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                opacity: 0.5
            }} />

            {/* Header */}
            {(title || rightHeader) && (
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", borderBottom: "1px solid rgba(0,255,127,0.1)",
                    background: "rgba(0,0,0,0.3)", flexShrink: 0
                }}>
                    {title && (
                        <span style={{ fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", color: ACCENT, letterSpacing: "1px" }}>
                            {title}
                        </span>
                    )}
                    {rightHeader}
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
                {children}
            </div>
        </div>
    );
};

const MetricBox = ({ label, value, sub, color = "white" }) => (
    <div style={{
        display: "flex", flexDirection: "column", padding: "10px",
        background: "rgba(0,255,127,0.05)", border: "1px solid rgba(0,255,127,0.1)", borderRadius: "2px"
    }}>
        <span style={{ fontFamily: ORBITRON, fontSize: "9px", color: "rgba(0,255,127,0.7)", letterSpacing: "1px", textTransform: "uppercase" }}>
            {label}
        </span>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "20px", fontWeight: "bold", color: color, lineHeight: 1, marginTop: "4px" }}>
            {value}
        </span>
        {sub && <span style={{ fontFamily: MONO, fontSize: "9px", color: "#6b7280", marginTop: "4px" }}>{sub}</span>}
    </div>
);

const OrderBookRow = ({ price, size, type, maxVol }) => {
    const safePrice = price || 0;
    const safeSize = size || 0;
    const barWidth = Math.min((safeSize / maxVol) * 100, 100);
    const isAsk = type === 'ask';
    const color = isAsk ? '#f87171' : '#4ade80';

    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: MONO, padding: "2px 0", position: "relative" }}>
            <div style={{
                position: "absolute", top: 0, bottom: 0, right: 0, width: `${barWidth}%`,
                background: isAsk ? 'rgba(248, 113, 113, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                transition: "width 0.2s"
            }} />
            <span style={{ position: "relative", zIndex: 1, color: color, fontWeight: "bold", paddingLeft: "4px" }}>
                {safePrice.toFixed(2)}
            </span>
            <span style={{ position: "relative", zIndex: 1, color: "#9ca3af", paddingRight: "4px" }}>
                {safeSize.toFixed(4)}
            </span>
        </div>
    );
};

// --- MAIN PAGE ---

const MarketPredict = () => {
    // STATE
    const [data, setData] = useState({
        mid_price: 0, bids: [], asks: [], prediction: { up: 0, neutral: 0, down: 0 }, processing_time: 0
    });
    const [status, setStatus] = useState({ connected: false, active: false });
    const [stats, setStats] = useState({ realized: 0, unrealized: 0, total: 0, position: 0 });
    const [history, setHistory] = useState({ trades: [] });
    const [throttle, setThrottle] = useState(false);
    const [mode, setMode] = useState("UNKNOWN");

    // REFS
    const chartRef = useRef(null);
    const bufferRef = useRef([]);
    const wsRef = useRef(null);
    const sessionIdRef = useRef("model-test-" + Math.random().toString(36).substr(2, 9));

    // WEBSOCKET LOGIC
    useEffect(() => {
        const BACKEND_WS = (import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000").replace(/^http/, "ws") + "/ws";
        const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
        let isMounted = true;
        let interval = null;

        const connect = () => {
            if (!isMounted) return;
            const ws = new WebSocket(`${BACKEND_WS}/${sessionIdRef.current}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus(s => ({ ...s, connected: true }));
                fetch(`${BACKEND_HTTP}/replay/${sessionIdRef.current}/start`, { method: 'POST' }).catch(console.error);
                fetch(`${BACKEND_HTTP}/metrics`).then(r => r.json()).then(d => setMode(d.mode || "UNKNOWN")).catch(console.error);
            };

            ws.onmessage = (e) => {
                if (!isMounted) return;
                const msg = JSON.parse(e.data);
                if (msg.type === 'snapshot') bufferRef.current.push(msg);
                else if (msg.type === 'trade_event') setHistory(h => ({ ...h, trades: [msg.data, ...h.trades].slice(0, 50) }));
                else if (msg.type === 'history') {
                    if (chartRef.current) chartRef.current.setData(msg.data);

                    // Recover past trades from history snapshots
                    const pastTrades = msg.data
                        .filter(snap => snap.strategy?.trade_event)
                        .map(snap => snap.strategy.trade_event);
                    //.reverse(); // Don't reverse yet, let dedup sort handle it

                    if (pastTrades.length > 0) {
                        setHistory(h => {
                            const allTrades = [...pastTrades, ...h.trades];
                            // Dedup by ID and Sort Newest First
                            const uniqueTrades = Array.from(new Map(allTrades.map(t => [t.id, t])).values())
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                .slice(0, 50);
                            return { ...h, trades: uniqueTrades };
                        });
                    }
                }
            };

            ws.onclose = () => { if (isMounted) { setStatus(s => ({ ...s, connected: false })); setTimeout(connect, 2000); } };
        };

        connect();

        interval = setInterval(() => {
            if (bufferRef.current.length > 0) {
                const latest = bufferRef.current[bufferRef.current.length - 1];
                if (chartRef.current) {
                    if (throttle) chartRef.current.update(latest);
                    else bufferRef.current.forEach(pt => chartRef.current.update(pt));
                }

                // Safe Data Update
                setData(d => ({
                    ...d, ...latest,
                    prediction: latest.prediction || d.prediction || { up: 0, neutral: 0, down: 0 }
                }));

                if (latest.strategy?.pnl) {
                    setStats(s => ({
                        ...s,
                        realized: latest.strategy.pnl.realized || 0,
                        unrealized: latest.strategy.pnl.unrealized || 0,
                        total: latest.strategy.pnl.total || 0,
                        position: latest.strategy.pnl.position || 0
                    }));
                    setStatus(st => ({ ...st, active: latest.strategy.pnl.is_active }));
                }
                bufferRef.current = [];
            }
        }, 66);

        return () => { isMounted = false; clearInterval(interval); wsRef.current?.close(); };
    }, []);

    // ACTIONS
    const toggleEngine = async () => {
        const ep = status.active ? '/strategy/stop' : '/strategy/start';
        await fetch(`${import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000"}${ep}`, { method: 'POST' });
    };
    const reset = async () => {
        await fetch(`${import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000"}/strategy/reset`, { method: 'POST' });
        setStats({ realized: 0, unrealized: 0, total: 0, position: 0 });
        setHistory({ trades: [] });
        chartRef.current?.reset();
    };

    // HELPERS
    const pred = data.prediction || { up: 0, neutral: 0, down: 0 };
    const signal = pred.up > 0.35 && pred.up > pred.down ? "LONG" : (pred.down > 0.35 && pred.down > pred.up ? "SHORT" : "HOLD");
    const sigColor = signal === "LONG" ? ACCENT : (signal === "SHORT" ? "#ef4444" : "#6b7280");
    const safeMid = data.mid_price || 0;
    const safeSpread = ((data.asks?.[0]?.[0] || 0) - (data.bids?.[0]?.[0] || 0));

    // STYLES
    const btnStyle = (active, color) => ({
        display: "flex", alignItems: "center", gap: "6px",
        padding: "6px 16px", borderRadius: "2px",
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.2)'}`,
        background: active ? `${color}20` : 'rgba(0,0,0,0.4)',
        color: active ? color : '#9ca3af',
        fontFamily: ORBITRON, fontSize: "11px", fontWeight: "bold",
        cursor: "pointer", transition: "all 0.2s"
    });

    return (
        <DashboardLayout>
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "12px", padding: "16px", boxSizing: "border-box", color: "#e5e7eb" }}>

                {/* HEADER */}
                <GenesisPanel style={{ height: "60px", flexShrink: 0, overflow: "visible" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", padding: "0 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: ACCENT }}>
                                <Zap size={20} fill={ACCENT} />
                                <h1 style={{ fontFamily: ORBITRON, fontSize: "18px", fontWeight: "bold", letterSpacing: "2px", color: "white", margin: 0 }}>
                                    DeepLOB <span style={{ color: ACCENT, fontWeight: "normal", opacity: 0.8 }}>ENGINE</span>
                                </h1>
                            </div>
                            <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />
                            <div style={{
                                display: "flex", alignItems: "center", gap: "8px", padding: "4px 10px",
                                border: `1px solid ${mode === 'LIVE' ? ACCENT : '#f97316'}40`,
                                background: `${mode === 'LIVE' ? ACCENT : '#f97316'}10`,
                                borderRadius: "2px"
                            }}>
                                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: mode === 'LIVE' ? ACCENT : '#f97316' }} />
                                <span style={{ fontFamily: ORBITRON, fontSize: "10px", fontWeight: "bold", color: mode === 'LIVE' ? ACCENT : '#f97316' }}>
                                    {mode === 'LIVE' ? 'LIVE FEED' : 'REPLAY MODE'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontFamily: MONO, color: "#6b7280", marginRight: "12px" }}>
                                <span>LATENCY: {(data.processing_time || 0).toFixed(1)}ms</span>
                                <span style={{ color: status.connected ? ACCENT : "#ef4444" }}>● {status.connected ? "CNX" : "DIS"}</span>
                            </div>
                            <button onClick={toggleEngine} style={btnStyle(status.active, status.active ? '#ef4444' : ACCENT)}>
                                {status.active ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                {status.active ? "STOP ENGINE" : "START ENGINE"}
                            </button>
                            <button onClick={reset} style={{ padding: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.4)", color: "#9ca3af", borderRadius: "2px", cursor: "pointer" }}>
                                <RefreshCw size={16} />
                            </button>
                            <button onClick={() => setThrottle(!throttle)} style={btnStyle(throttle, '#22d3ee')}>
                                <Activity size={14} /> {throttle ? "HUMAN" : "MACHINE"}
                            </button>
                        </div>
                    </div>
                </GenesisPanel>

                {/* MAIN GRID - Using Flexbox because Grid might be tricky without CSS classes */}
                <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "12px" }}>

                    {/* LEFT COL (25%) */}
                    <div style={{ width: "25%", display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
                        <GenesisPanel title="PERFORMANCE" style={{ flexShrink: 0 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "8px" }}>
                                <MetricBox label="REALIZED" value={(stats.realized || 0).toFixed(2)} color={stats.realized >= 0 ? "#4ade80" : "#f87171"} sub="$ USD" />
                                <MetricBox label="UNREALIZED" value={(stats.unrealized || 0).toFixed(2)} color={stats.unrealized >= 0 ? "#60a5fa" : "#f87171"} sub="$ USD" />
                                <MetricBox label="TOTAL PNL" value={(stats.total || 0).toFixed(2)} color={stats.total >= 0 ? ACCENT : "#ef4444"} />
                                <MetricBox label="POSITION" value={stats.position} color="#facc15" sub="Contracts" />
                            </div>
                        </GenesisPanel>

                        <GenesisPanel title="LIVE BOOK" style={{ flex: 1 }} rightHeader={<span style={{ fontFamily: MONO, fontSize: "10px", color: "#6b7280" }}>SPREAD: {safeSpread.toFixed(2)}</span>}>
                            <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "0 8px" }}>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "4px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    {(data.asks || []).slice(0, 15).reverse().map((a, i) => <OrderBookRow key={i} price={a[0]} size={a[1]} type="ask" maxVol={5} />)}
                                </div>
                                <div style={{ textAlign: "center", padding: "4px 0", fontFamily: MONO, fontSize: "14px", fontWeight: "bold", color: "white", letterSpacing: "1px" }}>
                                    {safeMid.toFixed(2)}
                                </div>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: "4px" }}>
                                    {(data.bids || []).slice(0, 15).map((b, i) => <OrderBookRow key={i} price={b[0]} size={b[1]} type="bid" maxVol={5} />)}
                                </div>
                            </div>
                        </GenesisPanel>
                    </div>

                    {/* CENTER COL (50%) */}
                    <div style={{ width: "50%", display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
                        <GenesisPanel style={{ flex: 1, position: "relative" }}>
                            {/* Floating Badge */}
                            <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 10, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", padding: "8px", borderRadius: "4px" }}>
                                <div style={{ fontSize: "10px", fontFamily: MONO, color: "#6b7280", marginBottom: "4px" }}>CONFIDENCE</div>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "30px" }}>
                                    <div style={{ width: "10px", background: "#4ade80", height: `${Math.max((pred.up || 0) * 100, 5)}%`, opacity: pred.up }} />
                                    <div style={{ width: "10px", background: "#6b7280", height: `${Math.max((pred.neutral || 0) * 100, 5)}%`, opacity: pred.neutral }} />
                                    <div style={{ width: "10px", background: "#f87171", height: `${Math.max((pred.down || 0) * 100, 5)}%`, opacity: pred.down }} />
                                </div>
                            </div>
                            <div style={{ width: "100%", height: "100%" }}>
                                <TradingViewChart ref={chartRef} />
                            </div>
                        </GenesisPanel>

                        <GenesisPanel style={{ height: "80px", flexShrink: 0 }}>
                            <div style={{ display: "flex", height: "100%", alignItems: "center" }}>
                                <div style={{ width: "120px", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                                    <span style={{ fontSize: "9px", color: "#6b7280", marginBottom: "4px" }}>ANALYSIS</span>
                                    <span style={{ fontFamily: ORBITRON, fontSize: "24px", fontWeight: "900", color: sigColor }}>{signal}</span>
                                </div>
                                <div style={{ flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: MONO, color: "#9ca3af" }}>
                                        <span>PROBABILITY DISTRIBUTION</span>
                                        <span>{(Math.max(pred.up, pred.neutral, pred.down) * 100).toFixed(1)}% CONFIDENCE</span>
                                    </div>
                                    <div style={{ height: "8px", borderRadius: "4px", overflow: "hidden", display: "flex", background: "#1f2937" }}>
                                        <div style={{ background: "#4ade80", width: `${(pred.up || 0) * 100}%`, transition: "all 0.3s" }} />
                                        <div style={{ background: "#6b7280", width: `${(pred.neutral || 0) * 100}%`, transition: "all 0.3s" }} />
                                        <div style={{ background: "#f87171", width: `${(pred.down || 0) * 100}%`, transition: "all 0.3s" }} />
                                    </div>
                                </div>
                            </div>
                        </GenesisPanel>
                    </div>

                    {/* RIGHT COL (25%) */}
                    <div style={{ width: "25%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                        <GenesisPanel title="EXECUTION LOG" style={{ flex: 1 }}>
                            <div style={{ flex: 1, overflowY: "auto", fontFamily: MONO, fontSize: "10px" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead style={{ position: "sticky", top: 0, background: "#050a05", color: "#6b7280", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                        <tr>
                                            <th style={{ padding: "8px", textAlign: "left" }}>TIME</th>
                                            <th style={{ padding: "8px", textAlign: "left" }}>SIDE</th>
                                            <th style={{ padding: "8px", textAlign: "right" }}>PX</th>
                                            <th style={{ padding: "8px", textAlign: "right" }}>PNL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(history.trades || []).map((t, i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                <td style={{ padding: "6px 8px", color: "#9ca3af" }}>{new Date(t.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' })}</td>
                                                <td style={{ padding: "6px 8px", fontWeight: "bold", color: t.side === 'BUY' ? "#4ade80" : "#f87171" }}>{t.side}</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{(t.price || 0).toFixed(2)}</td>
                                                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold", color: t.pnl > 0 ? "#4ade80" : t.pnl < 0 ? "#f87171" : "#6b7280" }}>
                                                    {t.pnl ? t.pnl.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {(history.trades || []).length === 0 && (
                                            <tr><td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "#4b5563" }}>No trades executed</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </GenesisPanel>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default MarketPredict;
