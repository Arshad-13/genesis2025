import Plot from "react-plotly.js";

export default function PriceChart({ data = [] }) {
  const xData = data.map(d => d.timestamp);
  const yData = data.map(d => d.mid_price);
  const microData = data.map(d => d.microprice);

  return (
    <div className="panel">
      <Plot
        data={[
          {
            x: xData,
            y: yData,
            type: "scatter",
            mode: "lines",
            line: { color: "#5fd3bc", width: 1 },
            name: "Midprice"
          },
          {
            x: xData,
            y: microData,
            type: "scatter",
            mode: "lines",
            line: { color: "#facc15", width: 1, dash: 'dot' },
            name: "Microprice"
          }
        ]}
        layout={{
          height: 200,
          margin: { t: 20, l: 40, r: 20, b: 30 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#9ca3af" },
          xaxis: { showgrid: false },
          yaxis: { showgrid: true, gridcolor: '#1f2937' },
          legend: { orientation: "h", y: 1.1 }
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
