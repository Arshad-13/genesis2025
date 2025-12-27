import Plot from "react-plotly.js";
import { useMemo } from "react";
import { FaCircleCheck } from "react-icons/fa6";

export default function SpoofingRiskChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (data.length === 0) {
      return { traces: [], currentRisk: 0, riskHistory: [] };
    }

    // Get recent data for trend analysis (last 50 points)
    const recentData = data.slice(-50);
    const xData = recentData.map((d, i) => i); // Use index for x-axis
    const spoofingRiskData = recentData.map(d => d.spoofing_risk || 0);
    const volumeVolatilityData = recentData.map(d => (d.volume_volatility || 0) * 1000); // Scale for visibility

    // Identify spoofing events
    const spoofingEvents = [];
    recentData.forEach((d, i) => {
      if (d.anomalies?.some(a => a.type === 'SPOOFING')) {
        spoofingEvents.push({
          x: i,
          y: 100, // Max risk when event occurs
          timestamp: d.timestamp
        });
      }
    });

    const currentRisk = spoofingRiskData[spoofingRiskData.length - 1] || 0;

    const traces = [
      // Main risk line
      {
        x: xData,
        y: spoofingRiskData,
        type: "scatter",
        mode: "lines",
        line: { 
          color: '#ef4444', 
          width: 3,
          shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(239, 68, 68, 0.1)',
        name: 'Spoofing Risk %',
        hovertemplate: 'Risk: %{y:.1f}%<extra></extra>'
      },
      // Volume volatility indicator
      {
        x: xData,
        y: volumeVolatilityData,
        type: "scatter",
        mode: "lines",
        line: { 
          color: '#8b5cf6', 
          width: 1,
          dash: 'dot'
        },
        name: 'Volume Volatility',
        opacity: 0.6,
        yaxis: 'y2',
        hovertemplate: 'Vol Volatility: %{y:.3f}<extra></extra>'
      }
    ];

    // Add spoofing event markers
    if (spoofingEvents.length > 0) {
      traces.push({
        x: spoofingEvents.map(e => e.x),
        y: spoofingEvents.map(e => e.y),
        type: "scatter",
        mode: "markers",
        marker: { 
          color: '#dc2626', 
          size: 12,
          symbol: 'x',
          line: { color: 'white', width: 2 }
        },
        name: 'Spoofing Events',
        hovertemplate: 'Spoofing Event Detected!<extra></extra>'
      });
    }

    return { traces, currentRisk, riskHistory: spoofingRiskData };
  }, [data]);

  const getRiskLevel = (risk) => {
    if (risk >= 70) return { level: 'CRITICAL', color: '#dc2626', icon: '🚨' };
    if (risk >= 50) return { level: 'HIGH', color: '#ef4444', icon: '⚠️' };
    if (risk >= 30) return { level: 'MEDIUM', color: '#f97316', icon: '👀' };
    return { level: 'LOW', color: '#22c55e', icon: <FaCircleCheck /> };
  };

  const riskInfo = getRiskLevel(chartData.currentRisk);

  // Create risk zones as background shapes
  const shapes = [
    // Critical zone (70-100%)
    {
      type: 'rect',
      x0: 0, x1: 1, xref: 'paper',
      y0: 70, y1: 100, yref: 'y',
      fillcolor: 'rgba(220, 38, 38, 0.15)',
      line: { width: 0 }
    },
    // High zone (50-70%)
    {
      type: 'rect',
      x0: 0, x1: 1, xref: 'paper',
      y0: 50, y1: 70, yref: 'y',
      fillcolor: 'rgba(239, 68, 68, 0.1)',
      line: { width: 0 }
    },
    // Medium zone (30-50%)
    {
      type: 'rect',
      x0: 0, x1: 1, xref: 'paper',
      y0: 30, y1: 50, yref: 'y',
      fillcolor: 'rgba(249, 115, 22, 0.08)',
      line: { width: 0 }
    },
    // Current risk level line
    {
      type: 'line',
      x0: 0, x1: 1, xref: 'paper',
      y0: chartData.currentRisk, y1: chartData.currentRisk,
      line: { color: riskInfo.color, width: 2, dash: 'dash' }
    }
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '0.875rem', 
        fontWeight: 600, 
        color: '#e5e7eb', 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🎭 Spoofing Risk Analysis
        <span style={{ 
          fontSize: '0.7rem', 
          padding: '2px 8px', 
          backgroundColor: riskInfo.color,
          color: 'white',
          borderRadius: '10px',
          fontWeight: 'bold'
        }}>
          {chartData.currentRisk.toFixed(0)}% {riskInfo.level}
        </span>
      </h4>
      
      <Plot
        data={chartData.traces}
        layout={{
          height: 250,
          margin: { t: 20, l: 40, r: 40, b: 40 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af", size: 10 },
          xaxis: { 
            title: "Time (Recent)",
            showgrid: false,
            showticklabels: false
          },
          yaxis: { 
            title: 'Risk %',
            showgrid: true, 
            gridcolor: '#1f2937',
            range: [0, 100],
            ticksuffix: '%'
          },
          yaxis2: {
            title: 'Volatility',
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            range: [0, Math.max(10, Math.max(...chartData.traces[1]?.y || [0]) * 1.2)]
          },
          shapes: shapes,
          showlegend: false,
          hovermode: 'x unified'
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
      
      {/* Risk Level Indicator */}
      <div style={{ 
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: `${riskInfo.color}20`,
        border: `1px solid ${riskInfo.color}40`,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: riskInfo.color,
            animation: chartData.currentRisk > 50 ? 'pulse 2s infinite' : 'none'
          }}></div>
          <span style={{ color: riskInfo.color, fontWeight: 'bold', fontSize: '0.8rem' }}>
            Current Risk: {riskInfo.level}
          </span>
        </div>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
          {riskInfo.icon} {chartData.currentRisk >= 70 ? 'High Alert' : 
           chartData.currentRisk >= 50 ? 'Monitor Closely' : 
           chartData.currentRisk >= 30 ? 'Watch' : 'Normal'}
        </span>
      </div>

      {/* Recent Events Summary */}
      {data.length > 0 && (
        <div style={{ 
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: 'rgba(31, 41, 55, 0.6)',
          borderRadius: '4px',
          fontSize: '0.75rem',
          color: '#9ca3af'
        }}>
          Recent trend: {chartData.riskHistory.length > 10 ? 
            (chartData.riskHistory.slice(-5).reduce((a, b) => a + b, 0) / 5 > 
             chartData.riskHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5 ? 
             '📈 Increasing' : '📉 Decreasing') : 
            '📊 Monitoring'}
        </div>
      )}
    </div>
  );
}