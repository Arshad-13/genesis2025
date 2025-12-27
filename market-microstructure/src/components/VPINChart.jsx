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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        Waiting for V-PIN data...
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
            name: 'V-PIN',
            hovertemplate: '<b>%{y:.3f}</b><br>%{x}<extra></extra>'
          }
        ]}
        layout={{
          autosize: true,
          margin: { l: 35, r: 10, t: 20, b: 30 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          xaxis: {
            showgrid: false,
            color: '#6b7280',
            tickformat: '%H:%M',
            tickangle: -45,
            nticks: 6,
            tickfont: {
              size: 9
            }
          },
          yaxis: {
            showgrid: true,
            gridcolor: '#374151',
            color: '#6b7280',
            range: [0, 1],
            title: {
              text: 'V-PIN',
              font: {
                size: 10
              }
            },
            tickfont: {
              size: 9
            },
            dtick: 0.2
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
          showlegend: false,
          bargap: 0.2
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ 
          displayModeBar: false,
          responsive: true
        }}
      />
      
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '10px',
        background: 'rgba(17, 24, 39, 0.9)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.65rem',
        display: 'flex',
        gap: '8px',
        pointerEvents: 'none',
        border: '1px solid #374151'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          color: '#9ca3af',
          whiteSpace: 'nowrap'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            display: 'inline-block'
          }}></span>
          <span>Low</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          color: '#9ca3af',
          whiteSpace: 'nowrap'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#eab308',
            display: 'inline-block'
          }}></span>
          <span>Med</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          color: '#9ca3af',
          whiteSpace: 'nowrap'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            display: 'inline-block'
          }}></span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}