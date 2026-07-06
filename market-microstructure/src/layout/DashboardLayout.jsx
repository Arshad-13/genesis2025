import React, { useState } from "react";
import { Menu, ChevronLeft, ChevronRight, Maximize2, X, Activity, Radio, Play } from 'lucide-react';
import ControlsBar from "../components/ControlsBar";
import { TradingViewChart } from "../components/TradingViewChart";
import CanvasHeatmap from "../components/CanvasHeatmap";
import FeaturePanel from "../components/FeaturePanel";
import SnapshotInspector from "../components/SnapshotInspector";
import PriceLadder from "../components/PriceLadder";
import SignalMonitor from "../components/SignalMonitor";
import LiquidityGapMonitor from "../components/LiquidityGapMonitor";
import SpoofingDetector from "../components/SpoofingDetector";
import LiquidityGapChart from "../components/LiquidityGapChart";
import SpoofingRiskChart from "../components/SpoofingRiskChart";
import Sidebar from "../components/Sidebar";
import TradeFeed from "../components/TradeFeed";
import VPINChart from "../components/VPINChart";
import AdvancedAnomalyFeed from "../components/AdvancedAnomalyFeed";

// --- GENESIS DESIGN SYSTEM ---
const ORBITRON = "'Orbitron', monospace";
const MONO = "monospace";
const ACCENT = "#00ff7f";
const GLASS_BG = "rgba(0, 10, 0, 0.7)";
const BORDER = "1px solid rgba(0, 255, 127, 0.2)";

const GenesisPanel = ({ children, style = {}, title, rightHeader, noPadding = false }) => {
  return (
    <div style={{
      background: GLASS_BG,
      border: BORDER,
      backdropFilter: "blur(10px)",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      ...style
    }}>
      {/* Top Laser */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
        opacity: 0.5, zIndex: 10
      }} />

      {/* Header */}
      {(title || rightHeader) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", borderBottom: "1px solid rgba(0,255,127,0.1)",
          background: "rgba(0,0,0,0.3)", flexShrink: 0
        }}>
          {title && (
            <span style={{ fontFamily: ORBITRON, fontSize: "11px", fontWeight: "bold", color: ACCENT, letterSpacing: "1px", textTransform: "uppercase" }}>
              {title}
            </span>
          )}
          {rightHeader}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", padding: noPadding ? 0 : "8px" }}>
        {children}
      </div>
    </div>
  );
};

const DashboardLayout = React.memo(function DashboardLayout({
  data,
  latestSnapshot,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSpeed,
  onGoBack,
  replayState = "STOPPED",
  currentSpeed = 1,
  currentMode = "REPLAY",
  showToast,
  children
}) {
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeSnapshot = hoveredSnapshot || latestSnapshot;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- FEATURES ---
  const features = [
    {
      id: "obi", title: "ORDER BOOK IMBALANCE",
      component: <FeaturePanel data={data} dataKey="obi" color="#38bdf8" threshold={0.5} />,
      modalComponent: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
          <div style={{ flex: 1, overflow: "hidden" }}><FeaturePanel title="Order Book Imbalance" data={data} dataKey="obi" color="#38bdf8" threshold={0.5} /></div>
          <div style={{ flex: 1, overflow: "hidden" }}><FeaturePanel title="Spread" data={data} dataKey="spread" color="#f472b6" isSpread /></div>
        </div>
      ),
    },
    {
      id: "spread", title: "SPREAD MONITOR",
      component: <FeaturePanel data={data} dataKey="spread" color="#f472b6" isSpread />,
      modalComponent: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
          <div style={{ flex: 1, overflow: "hidden" }}><FeaturePanel title="Spread" data={data} dataKey="spread" color="#f472b6" isSpread /></div>
          <div style={{ flex: 1, overflow: "hidden" }}><FeaturePanel title="Order Book Imsbalance" data={data} dataKey="obi" color="#38bdf8" threshold={0.5} /></div>
        </div>
      ),
    },
    {
      id: "liquidity", title: "LIQUIDITY GAPS",
      component: <LiquidityGapMonitor snapshot={latestSnapshot} data={data} />,
      modalComponent: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
          <div style={{ flex: 1, overflow: "hidden" }}><LiquidityGapMonitor snapshot={latestSnapshot} data={data} /></div>
          <div style={{ flex: 1, overflow: "hidden" }}><LiquidityGapChart data={data} /></div>
        </div>
      ),
    },
    {
      id: "spoofing", title: "SPOOFING DETECTION",
      component: <SpoofingDetector snapshot={latestSnapshot} data={data} />,
      modalComponent: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
          <div style={{ flex: 1, overflow: "hidden" }}><SpoofingDetector snapshot={latestSnapshot} data={data} /></div>
          <div style={{ flex: 1, overflow: "hidden" }}><SpoofingRiskChart data={data} /></div>
        </div>
      ),
    },
    { id: "trades", title: "MARKET TRADES", component: <TradeFeed data={data} /> },
    { id: "vpin", title: "VPIN TOXICITY", component: <VPINChart data={data} /> },
    { id: "anomalies", title: "ADVANCED ANOMALIES", component: <AdvancedAnomalyFeed data={data} /> },
  ];

  const handlePrevFeature = () => setCurrentFeatureIndex((prev) => prev === 0 ? features.length - 1 : prev - 1);
  const handleNextFeature = () => setCurrentFeatureIndex((prev) => prev === features.length - 1 ? 0 : prev + 1);
  const currentFeature = features[currentFeatureIndex];
  const btnStyle = { padding: "4px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: ACCENT, cursor: "pointer", fontFamily: ORBITRON, fontSize: "10px" };

  return (
    <>
      {/* Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        style={{
          position: "fixed", top: "50%", left: "0", transform: "translateY(-50%)",
          padding: "12px 6px", background: `${ACCENT}10`, border: `1px solid ${ACCENT}40`, borderLeft: "none",
          color: ACCENT, cursor: "pointer", zIndex: 998, backdropFilter: "blur(4px)"
        }}
      >
        <Menu size={16} />
      </button>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} activePage="dashboard" />

      {/* Main Container */}
      <div style={{
        width: "100vw", height: "100vh", overflow: "hidden", background: "#050a05",
        display: "flex", padding: children ? 0 : "16px 24px 16px 48px", boxSizing: "border-box", gap: "12px"
      }}>
        {children ? children : (
          <>
            {/* LEFT COLUMN (Charts & Analytics) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", minWidth: 0, marginTop: "65px"}}>

              {/* TOP: Price Action (40%) */}
              <GenesisPanel title="TOKEN PRICE ACTION" style={{ flex: "0 0 32vh" }} noPadding>
                <div style={{ width: "100%", height: "100%" }}>
                  <TradingViewChart data={data} />
                </div>
              </GenesisPanel>

              {/* MIDDLE: Heatmap/Depth (25%) */}
              <GenesisPanel title="MARKET DEPTH HEATMAP" style={{ flex: "0 0 22vh" }} noPadding>
                <CanvasHeatmap data={data} height={180} onHover={setHoveredSnapshot} scale={1} />
              </GenesisPanel>

              {/* BOTTOM SPLIT: Signals & Features (Remaining) */}
              <div style={{ flex: 1, display: "flex", gap: "12px", minHeight: 0 }}>
                {/* Signal Monitor */}
                <GenesisPanel title="ACTIVE SIGNALS" style={{ width: "35vh" }} noPadding>
                  <div style={{ width: "100%", height: "100%", transform: "scale(0.9)", transformOrigin: "top left" }}>
                    <SignalMonitor snapshot={latestSnapshot} />
                  </div>
                </GenesisPanel>

                {/* Feature Carousel */}
                <GenesisPanel
                  title={currentFeature.title}
                  style={{ flex: 1 }}
                  rightHeader={
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={handlePrevFeature} style={btnStyle}><ChevronLeft size={10} /></button>
                      <button onClick={handleNextFeature} style={btnStyle}><ChevronRight size={10} /></button>
                      <button onClick={() => setIsModalOpen(true)} style={btnStyle}><Maximize2 size={10} /></button>
                    </div>
                  }
                >
                  <div style={{ width: "100%", height: "100%", position: "relative" }}>
                    {currentFeature.component}
                  </div>
                </GenesisPanel>
              </div>
            </div>

            {/* RIGHT COLUMN (Controls & Level 2) */}
            <div style={{ width: "360px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
              {/* Controls */}
              <GenesisPanel style={{ flexShrink: 0 }}>
                <ControlsBar
                  onPlay={onPlay} onPause={onPause} onResume={onResume} onStop={onStop}
                  onSpeed={onSpeed} onGoBack={onGoBack}
                  isPlaying={replayState === "PLAYING"} isPaused={replayState === "PAUSED"}
                  currentSpeed={currentSpeed} currentTimestamp={latestSnapshot?.timestamp}
                  currentMode={currentMode} showToast={showToast} data={data}
                />
              </GenesisPanel>

              {/* Snapshot Inspector */}
              <GenesisPanel title="SNAPSHOT INSPECTOR" style={{ height: "200px", flexShrink: 0 }}>
                <div style={{ fontSize: "11px", height: "100%", overflow: "auto" }}>
                  <SnapshotInspector snapshot={activeSnapshot} />
                </div>
              </GenesisPanel>

              {/* Price Ladder */}
              <GenesisPanel title="PRICE LADDER" style={{ flex: 1 }} noPadding>
                <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                  <PriceLadder snapshot={activeSnapshot} />
                </div>
              </GenesisPanel>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "40px"
        }} onClick={() => setIsModalOpen(false)}>
          <div style={{ width: "90%", height: "90%", onClick: e => e.stopPropagation() }}>
            <GenesisPanel
              title={`${currentFeature.title} - DETAIL`}
              style={{ height: "100%" }}
              rightHeader={
                <button onClick={() => setIsModalOpen(false)} style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", fontFamily: ORBITRON }}>
                  <X size={14} /> CLOSE
                </button>
              }
            >
              {currentFeature.modalComponent || currentFeature.component}
            </GenesisPanel>
          </div>
        </div>
      )}
    </>
  );
});

export default DashboardLayout;
