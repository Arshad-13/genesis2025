import Plot from "react-plotly.js";
import { useMemo, useRef } from "react";

export default function LiquidityGaps({ data = [], onHover }) {
  const lastMidPriceRef = useRef(100);
  
  const chartData = useMemo(() => {
    if (data.length === 0) return { 
      traces: [], 
      midPrice: 100, 
      priceRange: { min: 99, max: 101 },
      volumeRange: { min: -3000, max: 3000 } // Hardcoded for stability
    };

    // Get the latest snapshot for current analysis
    const latestSnapshot = data[data.length - 1];
    if (!latestSnapshot || !latestSnapshot.bids || !latestSnapshot.asks) {
      return { 
        traces: [], 
        midPrice: lastMidPriceRef.current,
        priceRange: { min: lastMidPriceRef.current - 1, max: lastMidPriceRef.current + 1 },
        volumeRange: { min: -3000, max: 3000 } // Hardcoded for stability
      };
    }

    const bids = latestSnapshot.bids || [];
    const asks = latestSnapshot.asks || [];
    const midPrice = latestSnapshot.mid_price || lastMidPriceRef.current;
    const gaps = latestSnapshot.liquidity_gaps || [];

    // Update the reference for next render
    lastMidPriceRef.current = midPrice;

    // Calculate stable price range (±$1 from mid-price)
    const priceRange = {
      min: Math.round((midPrice - 1.0) * 100) / 100,
      max: Math.round((midPrice + 1.0) * 100) / 100
    };

    // TODO: Make volume range dynamic later - currently hardcoded for stability
    // Calculate stable volume range - HARDCODED to ±3000 for now
    const volumeRange = {
      min: -3000, // Hardcoded for stability
      max: 3000   // Hardcoded for stability
    };

    const traces = [];

    // Create bid volume bars (negative x for left side)
    if (bids.length > 0) {
      const bidPrices = bids.map(b => b[0]);
      const bidVolumes = bids.map(b => -b[1]); // Negative for left side
      
      traces.push({
        x: bidVolumes,
        y: bidPrices,
        type: 'bar',
        orientation: 'h',
        name: 'Bid Volume',
        marker: { 
          color: bidVolumes.map(v => Math.abs(v) < 50 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.7)')
        },
        hovertemplate: 'Price: $%{y:.2f}<br>Bid Volume: %{customdata}<extra></extra>',
        customdata: bids.map(b => b[1]),
        showlegend: false
      });
    }

    // Create ask volume bars (positive x for right side)
    if (asks.length > 0) {
      const askPrices = asks.map(a => a[0]);
      const askVolumes = asks.map(a => a[1]);
      
      traces.push({
        x: askVolumes,
        y: askPrices,
        type: 'bar',
        orientation: 'h',
        name: 'Ask Volume',
        marker: { 
          color: askVolumes.map(v => v < 50 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.7)')
        },
        hovertemplate: 'Price: $%{y:.2f}<br>Ask Volume: %{x}<extra></extra>',
        showlegend: false
      });
    }

    // Add liquidity gap markers with stable colorscale
    if (gaps.length > 0) {
      const gapPrices = gaps.map(g => g.price);
      const gapRisks = gaps.map(g => g.risk_score);
      const gapSides = gaps.map(g => g.side);
      const gapVolumes = gaps.map(g => g.volume);
      
      traces.push({
        x: gaps.map(g => g.side === 'bid' ? volumeRange.min * 0.1 : volumeRange.max * 0.1), // Position markers consistently
        y: gapPrices,
        mode: 'markers',
        type: 'scatter',
        name: 'Liquidity Gaps',
        marker: {
          color: gapRisks,
          // Fixed colorscale - same colors, stable range
          colorscale: [
            [0, 'rgba(16, 185, 129, 0.8)'],    // Green for low risk
            [0.5, 'rgba(245, 158, 11, 0.8)'],  // Orange for medium risk  
            [1, 'rgba(239, 68, 68, 0.8)']      // Red for high risk
          ],
          // Fixed color range to prevent colorbar dancing
          cmin: 0,
          cmax: 100,
          size: gapRisks.map(r => Math.max(10, Math.min(16, 8 + r / 10))), // More consistent sizing
          symbol: 'diamond',
          line: { color: 'white', width: 1 },
          colorbar: {
            title: 'Risk %',
            titleside: 'right',
            len: 0.4,
            thickness: 10,
            // Fixed colorbar properties to prevent layout shifts
            x: 1.02,
            xanchor: 'left',
            y: 0.5,
            yanchor: 'middle'
          }
        },
        hovertemplate: 
          'Price: $%{y:.2f}<br>' +
          'Risk Score: %{marker.color:.1f}%<br>' +
          'Side: %{text}<br>' +
          'Volume: %{customdata}<extra></extra>',
        text: gapSides,
        customdata: gapVolumes,
        showlegend: false
      });
    } else {
      // Add invisible trace to maintain colorbar even when no gaps exist
      traces.push({
        x: [0],
        y: [midPrice],
        mode: 'markers',
        type: 'scatter',
        name: 'Liquidity Gaps',
        marker: {
          color: [0], // Minimum value to maintain colorscale
          colorscale: [
            [0, 'rgba(16, 185, 129, 0.8)'],    // Green for low risk
            [0.5, 'rgba(245, 158, 11, 0.8)'],  // Orange for medium risk  
            [1, 'rgba(239, 68, 68, 0.8)']      // Red for high risk
          ],
          cmin: 0,
          cmax: 100,
          size: [0], // Invisible marker
          opacity: 0, // Make it invisible
          colorbar: {
            title: 'Risk %',
            titleside: 'right',
            len: 0.4,
            thickness: 10,
            x: 1.02,
            xanchor: 'left',
            y: 0.5,
            yanchor: 'middle'
          }
        },
        hoverinfo: 'skip', // Don't show hover for invisible trace
        showlegend: false
      });
    }

    return { traces, midPrice, priceRange, volumeRange };
  }, [data]);

  const handleHover = (event) => {
    if (onHover && event.points && event.points[0]) {
      const point = event.points[0];
      const latestSnapshot = data[data.length - 1];
      
      if (latestSnapshot && latestSnapshot.liquidity_gaps && point.curveNumber === 2) {
        // Find the gap that matches the hovered point
        const hoveredPrice = point.y;
        const gap = latestSnapshot.liquidity_gaps.find(g => 
          Math.abs(g.price - hoveredPrice) < 0.01
        );
        
        if (gap) {
          onHover({
            ...latestSnapshot,
            hoveredGap: gap
          });
          return;
        }
      }
      
      onHover(latestSnapshot);
    }
  };

  const handleUnhover = () => {
    if (onHover) {
      const latestSnapshot = data[data.length - 1];
      onHover(latestSnapshot);
    }
  };

  // Create stable mid-price line shape
  const shapes = [{
    type: 'line',
    x0: chartData.volumeRange.min, 
    x1: chartData.volumeRange.max,
    y0: chartData.midPrice, 
    y1: chartData.midPrice,
    line: {
      color: 'rgba(255, 255, 255, 0.6)',
      width: 1,
      dash: 'dash'
    }
  }];

  return (
    <div className="panel">
      <h4>Liquidity Gaps Analysis</h4>
      <Plot
        data={chartData.traces}
        layout={{
          height: 350,
          margin: { t: 30, l: 60, r: 80, b: 40 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af", size: 11 },
          xaxis: { 
            title: "Volume",
            showgrid: true,
            gridcolor: '#1f2937',
            zeroline: true,
            zerolinecolor: 'rgba(255, 255, 255, 0.3)',
            range: [chartData.volumeRange.min, chartData.volumeRange.max], // Fixed range
            fixedrange: true // Prevent zooming/panning
          },
          yaxis: { 
            title: "Price ($)",
            showgrid: true,
            gridcolor: '#1f2937',
            range: [chartData.priceRange.min, chartData.priceRange.max], // Fixed range
            fixedrange: true, // Prevent zooming/panning
            tickformat: '.2f'
          },
          shapes: shapes,
          hovermode: 'closest',
          showlegend: false,
          dragmode: false, // Disable dragging
          scrollZoom: false // Disable scroll zoom
        }}
        config={{ 
          displayModeBar: false,
          staticPlot: false,
          responsive: true
        }}
        style={{ width: "100%" }}
        onHover={handleHover}
        onUnhover={handleUnhover}
      />
      
      {/* Critical Gaps Box - Always visible to prevent layout shifts */}
      <div style={{ 
        marginTop: '12px', 
        padding: '10px', 
        background: 'rgba(31, 41, 55, 0.6)', 
        borderRadius: '6px',
        border: '1px solid #374151',
        minHeight: '60px' // Ensure consistent height
      }}>
        {data.length > 0 && data[data.length - 1]?.liquidity_gaps && data[data.length - 1].liquidity_gaps.length > 0 ? (
          <>
            <div style={{ 
              fontWeight: 'bold', 
              color: '#f59e0b', 
              marginBottom: '8px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚠️</span>
              <span>Critical Gaps Detected: {data[data.length - 1].liquidity_gaps.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {data[data.length - 1].liquidity_gaps.slice(0, 3).map((gap, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '4px 6px',
                  background: 'rgba(17, 24, 39, 0.5)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      background: gap.side === 'bid' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: gap.side === 'bid' ? '#22c55e' : '#ef4444',
                      minWidth: '32px',
                      textAlign: 'center'
                    }}>
                      {gap.side.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e5e7eb' }}>
                      ${gap.price.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '10px' }}>
                      Vol: {gap.volume}
                    </span>
                    <span style={{
                      fontWeight: 'bold',
                      color: gap.risk_score > 50 ? '#ef4444' : gap.risk_score > 25 ? '#f59e0b' : '#10b981',
                      minWidth: '40px',
                      textAlign: 'right'
                    }}>
                      {gap.risk_score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '40px',
            color: '#6b7280',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            <span>✓</span>
            <span style={{ marginLeft: '6px' }}>No critical liquidity gaps detected</span>
          </div>
        )}
      </div>
    </div>
  );
}