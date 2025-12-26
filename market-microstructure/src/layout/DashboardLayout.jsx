import { useState } from "react";
import ControlsBar from "../components/ControlsBar";
import CanvasPriceChart from "../components/CanvasPriceChart";
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

export default function DashboardLayout({
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
  showToast
}) {
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeSnapshot = hoveredSnapshot || latestSnapshot;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Feature definitions
  const features = [
    {
      id: "obi",
      title: "ORDER BOOK IMBALANCE",
      component: (
        <FeaturePanel
          // title="Order Book Imbalance"
          data={data}
          dataKey="obi"
          color="#38bdf8"
          threshold={0.5}
        />
      ),
      modalComponent: (
        <FeaturePanel
          title="Order Book Imbalance"
          data={data}
          dataKey="obi"
          color="#38bdf8"
          threshold={0.5}
        />
      ),
    },
    {
      id: "spread",
      title: "SPREAD",
      component: (
        <FeaturePanel
          // title="Spread"
          data={data}
          dataKey="spread"
          color="#f472b6"
          isSpread
        />
      ),
      modalComponent: (
        <FeaturePanel
          title="Spread"
          data={data}
          dataKey="spread"
          color="#f472b6"
          isSpread
        />
      ),
    },
    {
      id: "liquidity",
      title: "LIQUIDITY GAP MONITOR",
      component: <LiquidityGapMonitor snapshot={latestSnapshot} data={data} />,
      modalComponent: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            height: "100%",
          }}
        >
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LiquidityGapMonitor snapshot={latestSnapshot} data={data} />
          </div>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              transform: "scale(0.9)",
              transformOrigin: "top left",
            }}
          >
            <LiquidityGapChart data={data} />
          </div>
        </div>
      ),
    },
    {
      id: "spoofing",
      title: "SPOOFING DETECTOR",
      component: <SpoofingDetector snapshot={latestSnapshot} data={data} />,
      modalComponent: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            height: "100%",
          }}
        >
          <div style={{ flex: 1, overflow: "hidden" }}>
            <SpoofingDetector snapshot={latestSnapshot} data={data} />
          </div>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
            }}
          >
            <SpoofingRiskChart data={data} />
          </div>
        </div>
      ),
    },
    {
      id: "trades",
      title: "TRADE FEED",
      component: <TradeFeed data={data} />,
      modalComponent: <TradeFeed data={data} />,
    },
    {
      id: "vpin",
      title: "V-PIN MONITOR",
      component: <VPINChart data={data} />,
      modalComponent: <VPINChart data={data} />,
    },
    {
      id: "anomalies",
      title: "ADVANCED ANOMALIES",
      component: <AdvancedAnomalyFeed data={data} />,
      modalComponent: <AdvancedAnomalyFeed data={data} />,
    },
  ];

  const handlePrevFeature = () => {
    setCurrentFeatureIndex((prev) =>
      prev === 0 ? features.length - 1 : prev - 1
    );
  };

  const handleNextFeature = () => {
    setCurrentFeatureIndex((prev) =>
      prev === features.length - 1 ? 0 : prev + 1
    );
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const currentFeature = features[currentFeatureIndex];

  return (
    <>
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        style={{
          position: "fixed",
          top: "50%",
          left: "0",
          transform: "translateY(-50%)",
          padding: "16px 8px",
          backgroundColor: "#334155",
          border: "1px solid #475569",
          borderLeft: "none",
          borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px",
          color: "#e2e8f0",
          cursor: "pointer",
          fontSize: "18px",
          zIndex: 998,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#475569";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#334155";
        }}
      >
        ☰
      </button>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          backgroundColor: "#0f172a",
          display: "flex",
          padding: "16px 96px",
          gap: "12px",
          boxSizing: "border-box",
          alignItems: "center",
        }}
      >
        {/* Left Column */}
        <div
          style={{
            flex: "1",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minWidth: 0,
          }}
        >
          {/* Price Action */}
          <div
            style={{
              height: "145px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              padding: "6px",
            }}
          >
            <div
              style={{
                width: "125%",
                transform: "scale(0.8)",
                transformOrigin: "top left",
              }}
            >
              <CanvasPriceChart data={data} height={150} scale={0.8} />
            </div>
          </div>

          {/* Market Depth */}
          <div
            style={{
              height: "145px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              padding: "6px",
            }}
          >
            <div
              style={{
                height: "calc(100% - 12px)",
                transform: "scale(0.8)",
                transformOrigin: "top left",
                width: "125%",
              }}
            >
              <CanvasHeatmap
                data={data}
                height={150}
                onHover={setHoveredSnapshot}
                scale={0.8}
              />
            </div>
          </div>

          {/* Active Signals */}
          <div
            style={{
              height: "116px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              padding: "6px",
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                transform: "scale(0.8)",
                transformOrigin: "top left",
                width: "111.11%",
                height: "111.11%",
              }}
            >
              <SignalMonitor snapshot={latestSnapshot} />
            </div>
          </div>

          {/* Features/Anomalies */}
          <div
            style={{
              height: "273px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "10px",
                borderBottom: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#e2e8f0",
                }}
              >
                {currentFeature.title}
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                }}
              >
                <button
                  onClick={handlePrevFeature}
                  style={{
                    padding: "3px 10px",
                    backgroundColor: "#334155",
                    border: "1px solid #475569",
                    borderRadius: "4px",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "12px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#475569")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#334155")
                  }
                >
                  ◀
                </button>
                <button
                  onClick={handleNextFeature}
                  style={{
                    padding: "3px 10px",
                    backgroundColor: "#334155",
                    border: "1px solid #475569",
                    borderRadius: "4px",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "12px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#475569")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#334155")
                  }
                >
                  ▶
                </button>
                <button
                  onClick={handleOpenModal}
                  style={{
                    padding: "3px 10px",
                    backgroundColor: "#334155",
                    border: "1px solid #475569",
                    borderRadius: "4px",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "11px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#475569")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#334155")
                  }
                >
                  ⛶
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: "10px",
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                // justifyContent: "center",
              }}
            >
              <div style={{ width: "100%" }}>{currentFeature.component}</div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div
          style={{
            width: "380px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Control Bar */}
          <div
            style={{
              flexShrink: 0,
            }}
          >
            <ControlsBar
              onPlay={onPlay}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onSpeed={onSpeed}
              onGoBack={onGoBack}
              isPlaying={replayState === "PLAYING"}
              isPaused={replayState === "PAUSED"}
              currentSpeed={currentSpeed}
              currentTimestamp={latestSnapshot?.timestamp}
              showToast={showToast}
            />
          </div>

          {/* Snapshot Inspector */}
          <div
            style={{
              height: "193px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              padding: "8px",
              fontSize: "0.8rem",
            }}
          >
            <div
              style={{
                transform: "scale(0.80)",
                transformOrigin: "top left",
                width: "117.65%",
                height: "117.65%",
              }}
            >
              <SnapshotInspector snapshot={activeSnapshot} />
            </div>
          </div>

          {/* Price Ladder */}
          <div
            style={{
              height: "450px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              border: "1px solid #334155",
              overflow: "hidden",
              minHeight: 0,
              padding: "6px",
              fontSize: "0.65rem",
            }}
          >
            <div
              style={{
                transform: "scale(0.695)",
                transformOrigin: "top left",
                width: "117.65%",
                height: "117.65%",
              }}
            >
              <PriceLadder snapshot={activeSnapshot} />
            </div>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "40px",
            }}
            onClick={handleCloseModal}
          >
            <div
              style={{
                backgroundColor: "#1e293b",
                borderRadius: "12px",
                border: "2px solid #334155",
                width: "90%",
                height: "90%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#e2e8f0",
                  }}
                >
                  {currentFeature.title} - Detailed View
                </h2>
                <button
                  onClick={handleCloseModal}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#ef4444",
                    border: "none",
                    borderRadius: "6px",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#dc2626")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#ef4444")
                  }
                >
                  ✕ Close
                </button>
              </div>

              {/* Modal Content */}
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  padding: "20px",
                }}
              >
                {currentFeature.modalComponent}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
