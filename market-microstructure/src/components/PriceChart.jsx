import Plot from "react-plotly.js";

export default function PriceChart() {
  return (
    <div className="panel">
      <Plot
        data={[
          {
            x: [...Array(100).keys()],
            y: [...Array(100).keys()].map(v => v + Math.random()),
            type: "scatter",
            mode: "lines",
            line: { color: "#5fd3bc" },
            name: "Midprice"
          }
        ]}
        layout={{
          height: 200,
          margin: { t: 20, l: 40, r: 20, b: 30 },
          paper_bgcolor: "#0b1220",
          plot_bgcolor: "#0b1220",
          font: { color: "#9ca3af" }
        }}
      />
    </div>
  );
}
