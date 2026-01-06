import React, { useRef, useEffect, useState } from "react";

export default function CanvasHeatmap({
  data,
  width = "100%",
  height = 250,
  onHover,
  scale = 1,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState(null);
  const [dimensions, setDimensions] = useState({ w: 600, h: 250 });

  // Layout constants
  const PADDING = { left: 10, right: 10, top: 10, bottom: 10 };

  // Handle Resize with ResizeObserver for better responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        // Make canvas wider to compensate for scale, keep height unchanged
        const adjustedWidth = clientWidth / (scale || 1);
        setDimensions({ w: adjustedWidth, h: height });
      }
    };

    // Use ResizeObserver for more efficient resizing
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    handleResize(); // Init

    return () => {
      resizeObserver.disconnect();
    };
  }, [height, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { w, h } = dimensions;

    // DPI Scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    if (!data || data.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText("Waiting for data...", w / 2 - 40, h / 2);
      return;
    }

    const CHART_WIDTH = w - PADDING.left - PADDING.right;
    const CHART_HEIGHT = h - PADDING.top - PADDING.bottom;

    const levels = 10;
    const totalRows = levels * 2; // 10 Asks + 10 Bids
    const cellHeight = CHART_HEIGHT / totalRows;
    const cellWidth = CHART_WIDTH / data.length;

    // Find max volume for normalization
    let maxVol = 0;
    data.forEach((snap) => {
      if (snap.bids)
        snap.bids.forEach((b) => (maxVol = Math.max(maxVol, b[1])));
      if (snap.asks)
        snap.asks.forEach((a) => (maxVol = Math.max(maxVol, a[1])));
    });
    if (maxVol === 0) maxVol = 1;

    // --- Draw Heatmap Cells ---
    data.forEach((snapshot, timeIndex) => {
      if (!snapshot.bids || !snapshot.asks) return;

      const x = PADDING.left + timeIndex * cellWidth;

      // Draw Asks (Top half)
      for (let i = 0; i < levels; i++) {
        const rowIndex = levels - 1 - i;
        const vol = snapshot.asks[i][1];
        const intensity = Math.min(1, vol / (maxVol * 0.8));

        ctx.fillStyle = `rgba(239, 68, 68, ${intensity})`;
        ctx.fillRect(
          x,
          PADDING.top + rowIndex * cellHeight,
          cellWidth + 0.5,
          cellHeight + 0.5
        );
      }

      // Draw Bids (Bottom half)
      for (let i = 0; i < levels; i++) {
        const rowIndex = levels + i;
        const vol = snapshot.bids[i][1];
        const intensity = Math.min(1, vol / (maxVol * 0.8));

        ctx.fillStyle = `rgba(34, 197, 94, ${intensity})`;
        ctx.fillRect(
          x,
          PADDING.top + rowIndex * cellHeight,
          cellWidth + 0.5,
          cellHeight + 0.5
        );
      }
    });

    // --- Draw Midline ---
    ctx.beginPath();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.moveTo(PADDING.left, PADDING.top + CHART_HEIGHT / 2);
    ctx.lineTo(w - PADDING.right, PADDING.top + CHART_HEIGHT / 2);
    ctx.stroke();

    // --- Draw Y-Axis Labels ---
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(PADDING.left, PADDING.top, 45, 12);
    ctx.fillRect(PADDING.left, PADDING.top + CHART_HEIGHT / 2 - 6, 45, 12);
    ctx.fillRect(PADDING.left, PADDING.top + CHART_HEIGHT - 12, 45, 12);

    ctx.fillStyle = "#e5e7eb";
    // Top Label (Ask 10)
    ctx.fillText("Ask 10", PADDING.left + 3, PADDING.top + 10);
    // Mid Label (Spread)
    ctx.fillText(
      "Spread",
      PADDING.left + 3,
      PADDING.top + CHART_HEIGHT / 2 + 3
    );
    // Bottom Label (Bid 10)
    ctx.fillText("Bid 10", PADDING.left + 3, PADDING.top + CHART_HEIGHT - 2);

    // --- Draw Hover Effect ---
    if (mousePos) {
      const { x } = mousePos;
      if (x >= PADDING.left && x <= w - PADDING.right) {
        const ratio = (x - PADDING.left) / CHART_WIDTH;
        const index = Math.floor(ratio * data.length);
        const safeIndex = Math.max(0, Math.min(index, data.length - 1));

        // Highlight Column
        const colX = PADDING.left + safeIndex * cellWidth;

        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(colX, PADDING.top, cellWidth, CHART_HEIGHT);

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(colX, PADDING.top, cellWidth, CHART_HEIGHT);

        // Trigger Callback
        if (onHover) {
          onHover(data[safeIndex]);
        }
      } else {
        if (onHover) onHover(null);
      }
    }
  }, [data, dimensions, mousePos, onHover]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Account for scale transform
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    if (onHover) onHover(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", overflow: "hidden", width: '100%' }}
    >
      <h4
        style={{
          margin: "0 0 12px 0",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#e5e7eb",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Market Depth L2
      </h4>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block", cursor: "crosshair", width: '100%' }}
      />
    </div>
  );
}