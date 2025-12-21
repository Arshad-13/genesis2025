import Plot from "react-plotly.js";

export default function Heatmap() {
  return (
    <div className="panel heatmap">
      <Plot
        data={[
          {
            z: Array.from({ length: 30 }, () =>
              Array.from({ length: 200 }, () => Math.random() * 10)
            ),
            type: "heatmap",
            colorscale: "Portland",
          }
        ]}
        layout={{
          height: 350,
          margin: { t: 30, l: 50, r: 20, b: 40 },
          paper_bgcolor: "#0b1220",
          plot_bgcolor: "#0b1220",
          font: { color: "#9ca3af" },
          xaxis: { title: "Time" },
          yaxis: { title: "Price Levels" }
        }}
      />
    </div>
  );
}
