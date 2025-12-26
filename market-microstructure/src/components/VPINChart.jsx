import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

export default function VPINChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    // Filter for snapshots that have V-PIN data
    const vpinData = data.filter(d => d.vpin !== undefined);
    
    if (vpinData.length === 0) return null;
    
    const timestamps = vpinData.map(d => d.timestamp);
    const values = vpinData.map(d => d.vpin);
    
    // Color based on toxicity threshold
    // < 0.3: Low (Green)
    // 0.3 - 0.6: Medium (Yellow)
    // > 0.6: High (Red)
    const colors = values.map(v => {
      if (v >= 0.6) return '#ef4444';
      if (v >= 0.3) return '#eab308';
      return '#22c55e';
    });

    return {
      x: timestamps,
      y: values,
      marker: { color: colors }
    };
  }, [data]);

  if (!chartData) {
    return (
      <div className="panel-content empty-state">
        <div className="empty-text">Waiting for V-PIN data...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Plot
        data={[
          {
            x: chartData.x,
            y: chartData.y,
            type: 'bar',
            marker: {
              color: chartData.marker.color
            },
            name: 'V-PIN'
          }
        ]}
        layout={{
          autosize: true,
          margin: { l: 30, r: 10, t: 10, b: 30 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          xaxis: {
            showgrid: false,
            color: '#6b7280',
            tickformat: '%H:%M:%S'
          },
          yaxis: {
            showgrid: true,
            gridcolor: '#374151',
            color: '#6b7280',
            range: [0, 1],
            title: 'V-PIN Probability'
          },
          shapes: [
            {
              type: 'line',
              y0: 0.6,
              y1: 0.6,
              x0: chartData.x[0],
              x1: chartData.x[chartData.x.length - 1],
              line: {
                color: '#ef4444',
                width: 1,
                dash: 'dot'
              }
            }
          ],
          showlegend: false
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: false }}
      />
      
      <div className="vpin-legend">
        <div className="legend-item">
          <span className="dot low"></span> Low Risk
        </div>
        <div className="legend-item">
          <span className="dot medium"></span> Medium
        </div>
        <div className="legend-item">
          <span className="dot high"></span> High Risk
        </div>
      </div>

      <style jsx>{`
        .panel-content.empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }
        .vpin-legend {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(17, 24, 39, 0.8);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          display: flex;
          gap: 8px;
          pointer-events: none;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #9ca3af;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dot.low { background-color: #22c55e; }
        .dot.medium { background-color: #eab308; }
        .dot.high { background-color: #ef4444; }
      `}</style>
    </div>
  );
}
