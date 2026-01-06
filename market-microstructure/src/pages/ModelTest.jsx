import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowUp, ArrowDown, Minus, Activity, Server, Clock,
    Play, Square, TrendingUp, DollarSign, List, BarChart2, Zap
} from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import CanvasPriceChart from '../components/CanvasPriceChart';
import logger from '../utils/logger';

// --- Components ---

const MetricCard = ({ label, value, subValue, trend, color, icon: Icon }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between h-full relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            <Icon size={40} />
        </div>
        <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</span>
            <div className={`text-2xl font-mono font-bold text-white mt-1 tracking-tight`}>
                {value}
            </div>
        </div>
        {subValue && (
            <div className="text-xs text-slate-400 font-mono mt-1 border-t border-slate-800/50 pt-1 flex justify-between items-center">
                <span>{subValue}</span>
                {trend && <span className={trend > 0 ? 'text-green-400' : 'text-red-400'}>{trend > 0 ? '▲' : '▼'}</span>}
            </div>
        )}
    </div>
);

const OrderBookRow = ({ price, size, total, type, maxVol }) => {
    const width = Math.min((size / maxVol) * 100, 100);
    return (
        <div className="flex justify-between text-xs font-mono py-0.5 relative hover:bg-white/5 cursor-default">
            <div
                className={`absolute ${type === 'ask' ? 'right-0 bg-red-500/10' : 'right-0 bg-green-500/10'} h-full transition-all duration-300`}
                style={{ width: `${width}%` }}
            />
            <span className={`relative z-10 w-1/3 text-left pl-2 ${type === 'ask' ? 'text-red-400' : 'text-green-400'}`}>
                {price.toFixed(2)}
            </span>
            <span className="relative z-10 w-1/3 text-right text-slate-400 pr-2">
                {size.toFixed(4)}
            </span>
        </div>
    );
};

const ModelTest = () => {
    const [data, setData] = useState({
        mid_price: 0,
        bids: [], asks: [],
        prediction: { up: 0, neutral: 0, down: 0 },
        processing_time: 0
    });
    const [status, setStatus] = useState({ connected: false, active: false });
    const [stats, setStats] = useState({ realized: 0, unrealized: 0, total: 0, position: 0 });
    const [history, setHistory] = useState({ trades: [], prices: [] });
    const bufferRef = useRef([]);
    // Use crypto.randomUUID for better randomness and no collisions
    const sessionIdRef = useRef("model-test-session-" + (crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Math.random().toString(36).substr(2, 9)));
    const wsRef = useRef(null);

    // Connection & Data Logic
    useEffect(() => {
        const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
        const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || `${BACKEND_HTTP.replace(/^http/, "ws")}/ws`;
        const sessionId = sessionIdRef.current;
        
        let interval = null;
        let isMounted = true;
        
        logger.debug('ModelTest', 'Initializing WebSocket connection to:', `${BACKEND_WS}/${sessionId}`);

        const connectWebSocket = () => {
            const ws = new WebSocket(`${BACKEND_WS}/${sessionId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                logger.info('ModelTest', 'WebSocket connected');
                if (!isMounted) {
                    logger.debug('ModelTest', 'Component unmounted, closing WebSocket');
                    ws.close();
                    return;
                }
                setStatus(s => ({ ...s, connected: true }));
                fetch(`${BACKEND_HTTP}/replay/${sessionId}/start`, { method: 'POST' })
                    .then(() => logger.info('ModelTest', 'Replay started'))
                    .catch(err => logger.error('ModelTest', 'Failed to start replay:', err));
            };

            ws.onmessage = (e) => {
                if (!isMounted) return;
                const msg = JSON.parse(e.data);
                logger.debug('ModelTest', 'Received message type:', msg.type);
                if (msg.type !== 'history') bufferRef.current.push(msg);
            };

            ws.onclose = (event) => {
                logger.info('ModelTest', 'WebSocket closed:', event.code, event.reason);
                if (!isMounted) return;
                setStatus(s => ({ ...s, connected: false }));
            };
            
            ws.onerror = (err) => {
                logger.error('ModelTest', 'WebSocket error:', err);
            };

            return ws;
        };

        connectWebSocket();

        interval = setInterval(() => {
            if (bufferRef.current.length > 0) {
                const msgs = [...bufferRef.current];
                const latest = msgs[msgs.length - 1];

                setData(latest);
                if (latest.strategy) {
                    const pnlData = latest.strategy.pnl || {};
                    setStats({
                        realized: pnlData.realized || 0,
                        unrealized: pnlData.unrealized || 0,
                        total: pnlData.total || 0,
                        position: pnlData.position || 0
                    });
                    setStatus(s => ({ ...s, active: pnlData.is_active || false }));
                    if (latest.strategy.trade_event) {
                        const tradeEvent = latest.strategy.trade_event;
                        logger.debug('ModelTest', 'Trade event received:', tradeEvent);
                        setHistory(h => ({ ...h, trades: [tradeEvent, ...h.trades].slice(0, 50) }));
                    }
                }

                setHistory(h => ({
                    ...h,
                    prices: [...h.prices, ...msgs.map(m => ({
                        timestamp: m.timestamp,
                        mid_price: m.mid_price,
                        microprice: m.microprice || m.mid_price,
                        trade_volume: 0
                    }))].slice(-500) // Keep 500 points
                }));
                bufferRef.current = [];
            }
        }, 50); // High refresh rate 50ms

        return () => {
            console.log('[ModelTest] Cleanup: unmounting component');
            isMounted = false;
            if (interval) {
                clearInterval(interval);
                console.log('[ModelTest] Cleanup: cleared interval');
            }
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                    logger.debug('ModelTest', 'Cleanup: closing WebSocket');
                    wsRef.current.close();
                }
                wsRef.current = null;
            }
        };
    }, []);

    const toggleEngine = async () => {
        const endpoint = status.active ? '/strategy/stop' : '/strategy/start';
        await fetch(`${import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000"}${endpoint}`, { method: 'POST' });
    };

    const resetStrategy = async () => {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000"}/strategy/reset`, { method: 'POST' });
        const data = await response.json();
        // Update local state immediately
        setStats({ realized: 0, unrealized: 0, total: 0, position: 0 });
        setHistory({ trades: [], prices: history.prices }); // Keep price history, clear trades
        setStatus(s => ({ ...s, active: false }));
    };

    // Calculate trade statistics
    const tradeStats = React.useMemo(() => {
        const exits = history.trades.filter(t => t.type === 'EXIT' && t.pnl !== undefined);
        const wins = exits.filter(t => t.pnl > 0).length;
        const losses = exits.filter(t => t.pnl < 0).length;
        const winRate = exits.length > 0 ? (wins / exits.length) * 100 : 0;
        const avgWin = wins > 0 ? exits.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
        const avgLoss = losses > 0 ? Math.abs(exits.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losses) : 0;
        const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? 999 : 0;
        return { wins, losses, winRate, avgWin, avgLoss, profitFactor, totalTrades: exits.length };
    }, [history.trades]);

    // Calculate current signal
    const pred = data.prediction || { up: 0, neutral: 1, down: 0 };
    const maxProb = Math.max(pred.up, pred.neutral, pred.down);
    const signal = maxProb === pred.up && pred.up > 0.3 ? "LONG" : (maxProb === pred.down && pred.down > 0.3 ? "SHORT" : "HOLD");
    const sigColor = signal === "LONG" ? "text-green-500" : (signal === "SHORT" ? "text-red-500" : "text-slate-500");

    return (
        <DashboardLayout>
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '1rem', gap: '0.5rem', boxSizing: 'border-box' }}>

                {/* Header Bar */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem', padding: '0.5rem 1rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: '0.375rem', borderRadius: '0.25rem', color: '#818cf8' }}><Zap size={18} /></div>
                            <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', letterSpacing: '-0.025em' }}>DeepLOB <span style={{ color: '#64748b', fontWeight: 'normal' }}>Strategy Engine</span></h1>
                        </div>
                        <div style={{ height: '1rem', width: '1px', backgroundColor: '#334155', margin: '0 0.5rem' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            <span style={{ color: status.connected ? '#4ade80' : '#f87171' }}>● {status.connected ? "WS CONNECTED" : "WS DISCONNECTED"}</span>
                            <span style={{ color: '#64748b' }}>LATENCY: {data.processing_time?.toFixed(1)}ms</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                            <span style={{ height: '0.5rem', width: '0.5rem', borderRadius: '9999px', backgroundColor: status.active ? '#22c55e' : '#64748b', animation: status.active ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white' }}>{status.active ? "TRADING ACTIVE" : "TRADING STOPPED"}</span>
                        </div>
                        <button
                            type="button"
                            onClick={toggleEngine}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-all relative z-10 ${
                                status.active 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20' 
                                : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                            }`}
                        >
                            {status.active ? (
                                <>
                                    <Square size={14} fill="currentColor" />
                                    <span>STOP</span>
                                </>
                            ) : (
                                <>
                                    <Play size={14} fill="currentColor" />
                                    <span>START</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={resetStrategy}
                            className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold cursor-pointer transition-all bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 relative z-10"
                            title="Reset all PnL and trade history"
                        >
                            <span>RESET</span>
                        </button>
                    </div>
                </header>

                {/* Main Grid */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, width: '100%' }}>

                    {/* Left Panel: Metrics & Order Book (25%) */}
                    <div style={{ width: '25%', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                        {/* Metrics Block */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', flexShrink: 0 }}>
                            <div className="grid grid-cols-3 gap-2">
                                <MetricCard label="Realized PnL" value={(stats.realized || 0).toFixed(2)} color="text-green-400" icon={DollarSign} />
                                <MetricCard label="Unrealized" value={(stats.unrealized || 0).toFixed(2)} color="text-blue-400" icon={TrendingUp} />
                                <MetricCard label="Total PnL" value={(stats.total || 0).toFixed(2)} color="text-emerald-400" icon={DollarSign} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Position" value={stats.position || 0} subValue={tradeStats.totalTrades > 0 ? `${tradeStats.wins}W/${tradeStats.losses}L` : 'No trades'} color="text-purple-400" icon={Activity} />
                                <MetricCard label="Win Rate" value={tradeStats.totalTrades > 0 ? `${tradeStats.winRate.toFixed(1)}%` : '-'} subValue={tradeStats.totalTrades > 0 ? `PF: ${tradeStats.profitFactor.toFixed(2)}` : ''} color="text-cyan-400" icon={BarChart2} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Mid Price" value={(data.mid_price || 0).toFixed(2)} subValue={`Spr: ${((data.asks?.[0]?.[0] || 0) - (data.bids?.[0]?.[0] || 0)).toFixed(2)}`} color="text-orange-400" icon={Server} />
                                <MetricCard label="Latency" value={`${(data.processing_time || 0).toFixed(1)}ms`} subValue={status.connected ? 'Connected' : 'Disconnected'} color="text-slate-400" icon={Clock} />
                            </div>
                        </div>

                        {/* Order Book */}
                        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                                <span>Order Book</span>
                                <span>Spread</span>
                            </div>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar flex flex-col justify-center">
                                {/* Asks (Reverse) */}
                                <div className="flex flex-col-reverse justify-end pb-1 border-b border-slate-800/50">
                                    {(data.asks || []).slice(0, 12).map((ask, i) => (
                                        <OrderBookRow key={`a${i}`} price={ask[0]} size={ask[1]} type="ask" maxVol={10} />
                                    ))}
                                </div>
                                <div className="text-center py-1 text-xs font-mono text-slate-500 bg-slate-950/30">
                                    {((data.asks?.[0]?.[0] || 0) - (data.bids?.[0]?.[0] || 0)).toFixed(2)}
                                </div>
                                {/* Bids */}
                                <div className="pt-1">
                                    {(data.bids || []).slice(0, 12).map((bid, i) => (
                                        <OrderBookRow key={`b${i}`} price={bid[0]} size={bid[1]} type="bid" maxVol={10} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Panel: Chart (50%) */}
                    <div style={{ width: '50%', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem', padding: '0.25rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1 rounded border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Signal Confidence</div>
                            <div className="flex items-center gap-4 mt-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-green-400">UP</span>
                                    <span className="text-sm font-mono text-green-300">{(pred.up * 100).toFixed(0)}%</span>
                                </div>
                                <div className="w-px h-6 bg-slate-700"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400">NEUTRAL</span>
                                    <span className="text-sm font-mono text-slate-300">{(pred.neutral * 100).toFixed(0)}%</span>
                                </div>
                                <div className="w-px h-6 bg-slate-700"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-red-400">DOWN</span>
                                    <span className="text-sm font-mono text-red-300">{(pred.down * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full h-full rounded overflow-hidden">
                            <CanvasPriceChart data={history.prices} markers={history.trades} height={600} />
                        </div>
                    </div>

                    {/* Right Panel: Trade History & Signal (25%) */}
                    <div style={{ width: '25%', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                        {/* Active Signal Box */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shrink-0 text-center">
                            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Current Signal</div>
                            <div className={`text-4xl font-black ${sigColor} transition-all`}>{signal}</div>
                            <div className="flex w-full mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="bg-green-500 transition-all duration-300" style={{ width: `${pred.up * 100}%` }} />
                                <div className="bg-slate-500 transition-all duration-300" style={{ width: `${pred.neutral * 100}%` }} />
                                <div className="bg-red-500 transition-all duration-300" style={{ width: `${pred.down * 100}%` }} />
                            </div>
                        </div>

                        {/* Trade Log */}
                        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg flex flex-col min-h-0 overflow-hidden">
                            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Execution Log</span>
                                <span className="text-[10px] text-slate-500">{history.trades.length} trades</span>
                            </div>
                            <div className="overflow-auto custom-scrollbar flex-1 p-0 relative min-h-[300px]">
                                {history.trades.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                                        <div className="text-center py-8">
                                            <List className="mx-auto mb-2 opacity-30" size={32} />
                                            <p>No trades yet</p>
                                            <p className="text-xs text-slate-600 mt-1">Trades will appear here when strategy is active</p>
                                        </div>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left text-slate-400">
                                        <thead className="bg-slate-950 font-medium text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="px-2 py-2">Time</th>
                                                <th className="px-2 py-2">Type</th>
                                                <th className="px-2 py-2">Side</th>
                                                <th className="px-2 py-2 text-right">Price</th>
                                                <th className="px-2 py-2 text-right">Size</th>
                                                <th className="px-2 py-2 text-right">PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {history.trades.map((t, i) => {
                                                const isEntry = t.type === 'ENTRY';
                                                const isExit = t.type === 'EXIT';
                                                const pnlClass = isEntry ? 'text-slate-600' : 
                                                    (t.pnl > 0 ? 'text-green-400' : (t.pnl < 0 ? 'text-red-400' : 'text-slate-600'));
                                                return (
                                                    <tr key={i} className={`hover:bg-slate-800/30 font-mono ${isExit ? 'bg-slate-800/20' : ''}`}>
                                                        <td className="px-2 py-1.5 text-slate-500 text-[10px]">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
                                                        <td className="px-2 py-1.5">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${isEntry ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                                                {t.type || 'TRADE'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-2 py-1.5 font-bold ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                                                        <td className="px-2 py-1.5 text-right">{(t.price || 0).toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-right text-slate-400">{(t.size || 0).toFixed(2)}</td>
                                                        <td className={`px-2 py-1.5 text-right font-semibold ${pnlClass}`}>
                                                            {isEntry ? (
                                                                <span className="text-[10px] text-slate-500" title={`Confidence: ${((t.confidence || 0) * 100).toFixed(0)}%`}>
                                                                    {((t.confidence || 0) * 100).toFixed(0)}%
                                                                </span>
                                                            ) : (
                                                                (t.pnl !== undefined && t.pnl !== null) ? t.pnl.toFixed(2) : '0.00'
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
};

export default ModelTest;
