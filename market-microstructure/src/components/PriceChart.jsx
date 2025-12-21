import Plot from "react-plotly.js";

export default function PriceChart({ data = [] }) {
  const xData = data.map(d => d.timestamp);
  const yData = data.map(d => d.mid_price);
  const microData = data.map(d => d.microprice);
  const divergenceData = data.map(d => d.divergence || 0);

  // Determine background color based on latest regime
  const latestRegime = data.length > 0 ? data[data.length - 1].regime : 0;
  let bgColor = "rgba(0,0,0,0)";
  if (latestRegime === 1) bgColor = "rgba(255, 0, 0, 0.1)"; // Stressed
  if (latestRegime === 2) bgColor = "rgba(255, 165, 0, 0.1)"; // Execution Hot
  if (latestRegime === 3) bgColor = "rgba(255, 0, 0, 0.2)"; // Crisis

  return (
    <div className="panel" style={{ backgroundColor: bgColor, transition: "background-color 0.5s" }}>
      <Plot
        data={[
          {
            x: xData,
            y: yData,
            type: "scatter",
            mode: "lines",
            line: { color: "#5fd3bc", width: 1 },
            name: "Midprice",
            xaxis: 'x',
            yaxis: 'y'
          },
          {
            x: xData,
            y: microData,
            type: "scatter",
            mode: "lines",
            line: { color: "#facc15", width: 1, dash: 'dot' },
            name: "Microprice",
            xaxis: 'x',
            yaxis: 'y'
          },
          // Divergence Oscillator (Sub-chart)
          {
            x: xData,
            y: divergenceData,
            type: "scatter",
            mode: "lines",
            line: { color: "#a78bfa", width: 1 },
            name: "Divergence",
            xaxis: 'x',
            yaxis: 'y2',
            fill: 'tozeroy'
          }
        ]}
        layout={{
          height: 300,
          margin: { t: 20, l: 40, r: 20, b: 30 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af" },
          grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
          xaxis: { showgrid: false, showticklabels: false },
          yaxis: { showgrid: true, gridcolor: '#1f2937', domain: [0.3, 1] }, // Main chart takes top 70%
          yaxis2: { showgrid: true, gridcolor: '#1f2937', domain: [0, 0.2], title: 'Div' }, // Oscillator takes bottom 20%
          legend: { orientation: "h", y: 1.1 },
          showlegend: true
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
