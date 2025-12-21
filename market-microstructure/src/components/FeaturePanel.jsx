import Plot from "react-plotly.js";

export default function FeaturePanel({ title, data = [], dataKey, color, threshold, isSpread }) {
  const xData = data.map(d => d.timestamp);
  const yData = data.map(d => d[dataKey]);

  // Identify anomalies for markers
  const anomalyX = [];
  const anomalyY = [];
  
  data.forEach(d => {
    if (d.anomalies && d.anomalies.length > 0) {
        // Check if relevant anomaly
        const relevant = d.anomalies.some(a => 
            (isSpread && a.type === "LIQUIDITY_WITHDRAWAL") || 
            (!isSpread && a.type === "HEAVY_IMBALANCE")
        );
        if (relevant) {
            anomalyX.push(d.timestamp);
            anomalyY.push(d[dataKey]);
        }
    }
  });

  const shapes = [];
  if (threshold) {
    shapes.push(
      {
        type: 'line',
        x0: 0, x1: 1, xref: 'paper',
        y0: threshold, y1: threshold,
        line: { color: 'rgba(255, 255, 255, 0.3)', width: 1, dash: 'dot' }
      },
      {
        type: 'line',
        x0: 0, x1: 1, xref: 'paper',
        y0: -threshold, y1: -threshold,
        line: { color: 'rgba(255, 255, 255, 0.3)', width: 1, dash: 'dot' }
      }
    );
  }

  return (
    <div className="panel">
      <h4>{title}</h4>
      <Plot
        data={[
          {
            x: xData,
            y: yData,
            type: "scatter",
            mode: "lines",
            line: { color: color, width: 2 },
            name: title
          },
          {
            x: anomalyX,
            y: anomalyY,
            type: "scatter",
            mode: "markers",
            marker: { color: 'red', size: 8 },
            name: 'Anomaly'
          }
        ]}
        layout={{
          height: 150,
          margin: { t: 10, l: 40, r: 20, b: 30 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af" },
          xaxis: { showgrid: false },
          yaxis: { showgrid: true, gridcolor: '#1f2937' },
          shapes: shapes,
          showlegend: false
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
