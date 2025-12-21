import Plot from "react-plotly.js";

export default function FeaturePanel({ title }) {
  return (
    <div className="panel">
      <h4>{title}</h4>
      <Plot
        data={[
          {
            x: [...Array(100).keys()],
            y: [...Array(100).keys()].map(() => Math.random()),
            type: "scatter",
            mode: "lines",
            line: { color: "#38bdf8" }
          }
        ]}
        layout={{
          height: 150,
          margin: { t: 10, l: 40, r: 20, b: 30 },
          paper_bgcolor: "#0b1220",
          plot_bgcolor: "#0b1220",
          font: { color: "#9ca3af" }
        }}
      />
    </div>
  );
}
