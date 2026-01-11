import React, { useState, useEffect } from 'react';
import {
  Download, Calendar, TrendingUp, TrendingDown, BarChart3, 
  FileText, Clock, Target, DollarSign, Activity
} from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';

// --- STYLES CONSTANTS ---
const ORBITRON = "'Orbitron', monospace";
const RAJDHANI = "'Rajdhani', sans-serif";
const ACCENT = "#00ff7f";
const RED = "#ff3232";
const GLASS_BG = "rgba(0, 20, 0, 0.8)";
const BORDER = "1px solid rgba(0, 255, 127, 0.3)";

// --- COMPONENTS ---
const GenesisPanel = ({ children, style = {}, title, rightHeader }) => {
  return (
    <div style={{
      background: GLASS_BG,
      border: BORDER,
      backdropFilter: "blur(12px)",
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
          padding: "12px 16px", borderBottom: "1px solid rgba(0,255,127,0.1)",
          background: "rgba(0,0,0,0.3)", flexShrink: 0
        }}>
          {title && (
            <span style={{ fontFamily: ORBITRON, fontSize: "14px", fontWeight: "bold", color: ACCENT, letterSpacing: "1px" }}>
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

const MetricCard = ({ icon: Icon, label, value, subValue, color = ACCENT, trend }) => (
  <div style={{
    background: GLASS_BG,
    border: BORDER,
    padding: "20px",
    backdropFilter: "blur(12px)",
    position: "relative",
    overflow: "hidden"
  }}>
    {/* Background Pattern */}
    <div style={{
      position: "absolute",
      top: "-50%",
      right: "-20%",
      width: "100px",
      height: "100px",
      border: "1px solid rgba(0, 255, 127, 0.1)",
      transform: "rotate(45deg)",
      opacity: 0.3
    }} />
    
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
      <div style={{
        width: "40px", height: "40px",
        background: `${color}20`,
        border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <Icon size={20} color={color} />
      </div>
      <span style={{ fontFamily: ORBITRON, fontSize: "12px", color: "#94a3b8", letterSpacing: "1px" }}>
        {label}
      </span>
    </div>
    
    <div style={{ fontFamily: RAJDHANI, fontSize: "28px", fontWeight: "bold", color: color, marginBottom: "4px" }}>
      {value}
    </div>
    
    {subValue && (
      <div style={{ fontFamily: RAJDHANI, fontSize: "14px", color: "#6b7280" }}>
        {subValue}
      </div>
    )}
    
    {trend && (
      <div style={{ 
        display: "flex", alignItems: "center", gap: "4px", marginTop: "8px",
        color: trend > 0 ? ACCENT : RED, fontSize: "12px", fontFamily: ORBITRON
      }}>
        {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {Math.abs(trend)}%
      </div>
    )}
  </div>
);

const ReportRow = ({ report, onDownload }) => {
  const pnlColor = (report.totalPnl || 0) >= 0 ? ACCENT : RED;
  const winRate = report.winRate !== undefined ? `${report.winRate}%` : 'N/A';
  const fileSize = report.fileSize ? `${(report.fileSize / 1024).toFixed(1)}KB` : 'N/A';
  
  return (
    <tr style={{ borderBottom: "1px solid rgba(0, 255, 127, 0.1)" }}>
      <td style={{ padding: "16px 12px", fontFamily: RAJDHANI, fontSize: "14px", color: "#e2e8f0" }}>
        <div>{new Date(report.timestamp).toLocaleDateString()}</div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          {new Date(report.timestamp).toLocaleTimeString()}
        </div>
      </td>
      <td style={{ padding: "16px 12px", fontFamily: ORBITRON, fontSize: "14px", fontWeight: "bold", color: pnlColor }}>
        {report.totalPnl !== undefined ? `$${report.totalPnl.toFixed(2)}` : 'N/A'}
      </td>
      <td style={{ padding: "16px 12px", fontFamily: RAJDHANI, fontSize: "14px", color: "#e2e8f0" }}>
        {report.totalTrades || 0}
      </td>
      <td style={{ padding: "16px 12px", fontFamily: RAJDHANI, fontSize: "14px", color: "#e2e8f0" }}>
        {winRate}
      </td>
      <td style={{ padding: "16px 12px", fontFamily: RAJDHANI, fontSize: "14px", color: "#6b7280" }}>
        <div>{report.duration || 'N/A'}</div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>{fileSize}</div>
      </td>
      <td style={{ padding: "16px 12px" }}>
        <button
          onClick={() => onDownload(report)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 16px",
            background: `${ACCENT}20`,
            border: `1px solid ${ACCENT}40`,
            color: ACCENT,
            fontFamily: ORBITRON,
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "1px",
            cursor: "pointer",
            transition: "all 0.2s",
            textTransform: "uppercase"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${ACCENT}30`;
            e.currentTarget.style.borderColor = ACCENT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${ACCENT}20`;
            e.currentTarget.style.borderColor = `${ACCENT}40`;
          }}
        >
          <Download size={14} />
          Download
        </button>
      </td>
    </tr>
  );
};

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalPnl: 0,
    totalTrades: 0,
    winRate: 0,
    avgSessionDuration: 0
  });

  // Fetch reports from backend API
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
        const response = await fetch(`${BACKEND_HTTP}/reports`);
        const data = await response.json();
        
        if (data.reports) {
          // Transform backend data to frontend format
          const transformedReports = data.reports.map(report => ({
            id: report.filename,
            timestamp: new Date(report.created_at),
            totalPnl: report.stats.total_pnl,
            totalTrades: report.stats.total_trades,
            winningTrades: report.stats.winning_trades,
            duration: report.duration,
            filename: report.filename,
            sessionId: report.session_id,
            downloadUrl: report.download_url,
            fileSize: report.file_size,
            winRate: report.stats.win_rate
          }));
          
          setReports(transformedReports);
          
          // Calculate aggregate stats from all reports
          const totalSessions = transformedReports.length;
          const totalPnl = transformedReports.reduce((sum, r) => sum + (r.totalPnl || 0), 0);
          const totalTrades = transformedReports.reduce((sum, r) => sum + (r.totalTrades || 0), 0);
          const totalWinning = transformedReports.reduce((sum, r) => sum + (r.winningTrades || 0), 0);
          const overallWinRate = totalTrades > 0 ? (totalWinning / totalTrades) * 100 : 0;
          
          // Calculate average session duration
          const validDurations = transformedReports.filter(r => r.duration && r.duration !== 'N/A');
          let avgDuration = 'N/A';
          if (validDurations.length > 0) {
            const totalMinutes = validDurations.reduce((sum, r) => {
              const match = r.duration.match(/(\d+)h\s*(\d+)m|(\d+)m/);
              if (match) {
                const hours = parseInt(match[1] || 0);
                const minutes = parseInt(match[2] || match[3] || 0);
                return sum + (hours * 60) + minutes;
              }
              return sum;
            }, 0);
            const avgMinutes = Math.round(totalMinutes / validDurations.length);
            const avgHours = Math.floor(avgMinutes / 60);
            const remainingMinutes = avgMinutes % 60;
            avgDuration = avgHours > 0 ? `${avgHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
          }
          
          setStats({
            totalSessions,
            totalPnl,
            totalTrades,
            winRate: overallWinRate,
            avgSessionDuration: avgDuration
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const handleDownload = async (report) => {
    try {
      const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
      const response = await fetch(`${BACKEND_HTTP}${report.downloadUrl}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download report');
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ 
          display: "flex", alignItems: "center", justifyContent: "center", 
          height: "100%", fontFamily: ORBITRON, color: ACCENT 
        }}>
          <Activity size={24} style={{ marginRight: "12px", animation: "spin 1s linear infinite" }} />
          Loading Reports...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ 
        width: "100%", height: "100%", display: "flex", flexDirection: "column", 
        gap: "20px", padding: "24px", boxSizing: "border-box", color: "#e5e7eb",
        fontFamily: RAJDHANI
      }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
          <div style={{
            width: "50px", height: "50px",
            background: `${ACCENT}20`,
            border: `1px solid ${ACCENT}40`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <FileText size={24} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ 
              fontFamily: ORBITRON, fontSize: "28px", fontWeight: "bold", 
              color: "white", margin: 0, letterSpacing: "2px" 
            }}>
              TRADING <span style={{ color: ACCENT }}>REPORTS</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0 0" }}>
              Download and analyze your trading session data
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <MetricCard
            icon={BarChart3}
            label="TOTAL SESSIONS"
            value={stats.totalSessions}
            color={ACCENT}
          />
          <MetricCard
            icon={DollarSign}
            label="TOTAL P&L"
            value={`$${stats.totalPnl.toFixed(2)}`}
            color={stats.totalPnl >= 0 ? ACCENT : RED}
            trend={stats.totalPnl >= 0 ? 12.5 : -8.3}
          />
          <MetricCard
            icon={Target}
            label="TOTAL TRADES"
            value={stats.totalTrades}
            subValue={`${stats.winRate.toFixed(1)}% Win Rate`}
            color={ACCENT}
          />
          <MetricCard
            icon={Clock}
            label="AVG DURATION"
            value={stats.avgSessionDuration}
            subValue="Per Session"
            color={ACCENT}
          />
        </div>

        {/* Reports Table */}
        <GenesisPanel title="SESSION REPORTS" style={{ flex: 1 }}>
          <div style={{ padding: "0", height: "100%", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ 
                position: "sticky", top: 0, 
                background: "rgba(0, 10, 0, 0.95)", 
                borderBottom: "2px solid rgba(0, 255, 127, 0.3)" 
              }}>
                <tr>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    TIMESTAMP
                  </th>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    TOTAL P&L
                  </th>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    TRADES
                  </th>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    WIN RATE
                  </th>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    DURATION
                  </th>
                  <th style={{ 
                    padding: "16px 12px", textAlign: "left", 
                    fontFamily: ORBITRON, fontSize: "12px", fontWeight: "bold", 
                    color: ACCENT, letterSpacing: "1px" 
                  }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <ReportRow 
                    key={report.id} 
                    report={report} 
                    onDownload={handleDownload}
                  />
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ 
                      padding: "40px", textAlign: "center", 
                      color: "#6b7280", fontFamily: RAJDHANI, fontSize: "16px" 
                    }}>
                      No trading sessions found. Start the prediction engine to generate reports.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GenesisPanel>
      </div>
    </DashboardLayout>
  );
};

export default Reports;