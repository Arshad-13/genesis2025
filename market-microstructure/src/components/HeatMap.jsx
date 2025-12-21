import Plot from "react-plotly.js";
import { useMemo } from "react";

export default function Heatmap({ data = [] }) {
  // Transform data for Heatmap
  // We need to map (Time, Price) -> Volume
  // Since prices float, we bin them relative to the midprice or just plot levels.
  // For a "Tier 2" visualization, let's plot the "Depth Levels" (1-10) over time.
  // Y-axis: Level (Ask 10...Ask 1, Bid 1...Bid 10)
  // Z-axis: Volume
  
  const { zData, xData, yData } = useMemo(() => {
    if (data.length === 0) return { zData: [], xData: [], yData: [] };

    const timestamps = data.map(d => d.timestamp);
    
    // We want to visualize the book depth.
    // Rows 0-9: Asks (High to Low price, so Ask 10 down to Ask 1)
    // Rows 10-19: Bids (High to Low price, so Bid 1 down to Bid 10)
    
    // Actually, standard convention:
    // Top: High Prices (Asks)
    // Bottom: Low Prices (Bids)
    // So Y axis should be Price.
    // But since price moves, we can plot "Distance from Mid" or just "Levels".
    // Let's plot Levels: Ask 10 (Top) -> Ask 1 -> Bid 1 -> Bid 10 (Bottom)
    
    const levels = 10;
    const z = Array(levels * 2).fill(0).map(() => []);
    
    data.forEach(snapshot => {
        if (!snapshot.bids || !snapshot.asks) return;
        
        // Asks (Reverse order: Ask 10 at top, Ask 1 near mid)
        // snapshot.asks[0] is Best Ask (Ask 1)
        // snapshot.asks[9] is Ask 10
        for (let i = levels - 1; i >= 0; i--) {
            z[levels - 1 - i].push(snapshot.asks[i][1]);
        }
        
        // Bids (Bid 1 near mid, Bid 10 at bottom)
        for (let i = 0; i < levels; i++) {
            z[levels + i].push(snapshot.bids[i][1]);
        }
    });
    
    const yLabels = [
        ...Array(levels).fill(0).map((_, i) => `Ask ${levels - i}`),
        ...Array(levels).fill(0).map((_, i) => `Bid ${i + 1}`)
    ];

    return { zData: z, xData: timestamps, yData: yLabels };
  }, [data]);

  return (
    <div className="panel heatmap">
      <h4>Liquidity Heatmap (LOB Depth)</h4>
      <Plot
        data={[
          {
            z: zData,
            x: xData,
            y: yData,
            type: "heatmap",
            colorscale: "Viridis",
            showscale: true
          }
        ]}
        layout={{
          height: 300,
          margin: { t: 30, l: 60, r: 20, b: 40 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af" },
          xaxis: { showticklabels: false, title: "Time" },
          yaxis: { title: "Depth Levels", tickfont: { size: 10 } }
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
