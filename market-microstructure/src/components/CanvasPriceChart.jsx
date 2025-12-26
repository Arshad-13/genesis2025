import React, { useRef, useEffect, useState } from "react";

export default function CanvasPriceChart({
  data,
  width = "100%",
  height = 250,
  scale = 1,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState(null);
  const [dimensions, setDimensions] = useState({ w: 600, h: 250 });

  // Constants for layout - reduced padding for full width
  const PADDING = { top: 20, right: 50, bottom: 20, left: 10 };

  // Helper to format price
  const formatPrice = (p) => p.toFixed(2);
  const formatTime = (iso) => {
    const d = new Date(iso);
    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
  };

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        setDimensions({ w: clientWidth, h: height });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Init

    return () => window.removeEventListener("resize", handleResize);
  }, [height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { w, h } = dimensions;

    // DPI Scaling for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas (using logical coords)
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    if (!data || data.length < 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText("Waiting for data...", w / 2 - 40, h / 2);
      return;
    }

    const CHART_WIDTH = w - PADDING.left - PADDING.right;
    const CHART_HEIGHT = h - PADDING.top - PADDING.bottom;

    // Calculate scales
    const prices = data.map((d) => d.mid_price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const yMin = minPrice - priceRange * 0.1;
    const yMax = maxPrice + priceRange * 0.1;
    const yRange = yMax - yMin;

    const getX = (index) =>
      PADDING.left + (index / (data.length - 1)) * CHART_WIDTH;
    const getY = (price) =>
      PADDING.top + CHART_HEIGHT - ((price - yMin) / yRange) * CHART_HEIGHT;

    // --- Draw Grid with Axis Labels ---
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = PADDING.top + (CHART_HEIGHT * i) / 4;
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(w - PADDING.right, y);

      // Y-Axis Price Labels on right side
      const priceLabel = yMax - i * (yRange / 4);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(formatPrice(priceLabel), w - PADDING.right + 5, y + 3);
    }
    ctx.stroke();

    // X-Axis Time Labels
    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    const timeLabels = [0, Math.floor(data.length / 2), data.length - 1];
    timeLabels.forEach(idx => {
      if (idx >= 0 && idx < data.length) {
        const x = getX(idx);
        const time = formatTime(data[idx].timestamp);
        ctx.fillText(time, x, h - 5);
      }
    });

    // --- Draw Area Gradient ---
    const gradient = ctx.createLinearGradient(
      0,
      PADDING.top,
      0,
      h - PADDING.bottom
    );
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.15)"); // Cyan-500 low opacity
    gradient.addColorStop(1, "rgba(6, 182, 212, 0.0)");

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(prices[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(prices[i]));
    }
    ctx.lineTo(getX(data.length - 1), h - PADDING.bottom);
    ctx.lineTo(getX(0), h - PADDING.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // --- Draw Mid Price Line ---
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4"; // Cyan-500
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.moveTo(getX(0), getY(prices[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(prices[i]));
    }
    ctx.stroke();

    // --- Draw Microprice ---
    ctx.beginPath();
    ctx.strokeStyle = "#d946ef"; // Fuchsia-500
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const microprices = data.map((d) => d.microprice);
    ctx.moveTo(getX(0), getY(microprices[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(microprices[i]));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Draw Trade Markers ---
    data.forEach((d, i) => {
      if (d.trade_volume > 0) {
        const x = getX(i);
        const y = getY(d.last_trade_price || d.mid_price);
        // Scale radius by volume
        const radius = Math.min(Math.max(Math.log10(d.trade_volume || 10), 2), 6); 
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        let color = '#fbbf24'; // Yellow default
        if (d.trade_side === 'buy') color = '#4ade80';
        else if (d.trade_side === 'sell') color = '#f87171';
        
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // --- Draw Crosshair & Tooltip ---
    if (mousePos) {
      const { x } = mousePos;

      if (x >= PADDING.left && x <= w - PADDING.right) {
        const ratio = (x - PADDING.left) / CHART_WIDTH;
        const index = Math.round(ratio * (data.length - 1));
        const safeIndex = Math.max(0, Math.min(index, data.length - 1));
        const point = data[safeIndex];

        const pointX = getX(safeIndex);
        const pointY = getY(point.mid_price);

        // Vertical Line
        ctx.beginPath();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.moveTo(pointX, PADDING.top);
        ctx.lineTo(pointX, h - PADDING.bottom);
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(pointX, pointY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Compact Tooltip
        const tooltipW = 100;
        const tooltipH = 45;
        let tooltipX = pointX + 10;
        let tooltipY = pointY - 50;

        if (tooltipX + tooltipW > w) tooltipX = pointX - tooltipW - 10;
        if (tooltipY < 0) tooltipY = pointY + 10;

        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
          `${point.mid_price.toFixed(2)}`,
          tooltipX + 8,
          tooltipY + 16
        );
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText(formatTime(point.timestamp), tooltipX + 8, tooltipY + 32);
      }
    }
  }, [data, dimensions, mousePos]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Account for scale transform
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 600, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price Action</h4>
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', cursor: 'crosshair', width: '100%' }}
      />
    </div>
  );
}