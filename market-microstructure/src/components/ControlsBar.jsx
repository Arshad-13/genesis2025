import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, SkipBack, FastForward, Pause, Settings, Clock, FileText, FileJson, Play } from 'lucide-react';

export default function ControlsBar({
  onPlay,
  onPause,
  onResume,
  onStop,
  onSpeed,
  onGoBack,
  isPlaying = false,
  isPaused = false,
  currentSpeed = 1,
  currentTimestamp = null,
  currentMode = "REPLAY",
  showToast,
  data = []
}) {
  const [speed, setSpeed] = useState(currentSpeed);
  const [speedUpValue, setSpeedUpValue] = useState(2);
  const [goBackSeconds, setGoBackSeconds] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [tempSpeedUp, setTempSpeedUp] = useState(2);
  const [tempGoBack, setTempGoBack] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handlePlayPause = async () => {
    setIsLoading(true);
    try {
      if (isPlaying) {
        if (onPause) await onPause();
        if (showToast) showToast('Replay paused', 'info');
      } else if (isPaused) {
        if (onResume) await onResume();
        if (showToast) showToast('Replay resumed', 'success');
      } else {
        if (onPlay) await onPlay();
        if (showToast) showToast('Replay started', 'success');
      }
    } catch (error) {
      if (showToast) showToast('Control action failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeedToggle = async () => {
    const newSpeed = speed === 1 ? speedUpValue : 1;
    setIsLoading(true);
    try {
      setSpeed(newSpeed);
      if (onSpeed) await onSpeed(newSpeed);
      if (showToast) showToast(`Speed set to ${newSpeed}x`, 'info');
    } catch (error) {
      if (showToast) showToast('Speed change failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = async () => {
    setIsLoading(true);
    try {
      if (onGoBack) await onGoBack(goBackSeconds);
      if (showToast) showToast(`Rewound ${goBackSeconds}s`, 'success');
    } catch (error) {
      if (showToast) showToast('Rewind failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySettings = () => {
    setSpeedUpValue(tempSpeedUp);
    setGoBackSeconds(tempGoBack);
    setShowModal(false);
  };

  const handleDownloadCSV = () => {
    if (!data || data.length === 0) {
      if (showToast) showToast("No data available to download", "error");
      return;
    }

    try {
      const allKeys = new Set();
      data.forEach(snapshot => {
        Object.keys(snapshot).forEach(key => {
          if (typeof snapshot[key] !== 'object' || snapshot[key] === null) {
            allKeys.add(key);
          }
        });
      });

      const headers = Array.from(allKeys).sort();
      let csv = headers.join(",") + "\n";

      data.forEach(snapshot => {
        const row = headers.map(header => {
          const value = snapshot[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "string" && value.includes(",")) return `"${value}"`;
          return value;
        });
        csv += row.join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `market_data_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (showToast) showToast("CSV downloaded successfully", "success");
      setShowDownloadMenu(false);
    } catch (error) {
      if (showToast) showToast("Failed to download CSV", "error");
      console.error("CSV download error:", error);
    }
  };

  const handleDownloadJSON = () => {
    if (!data || data.length === 0) {
      if (showToast) showToast("No data available to download", "error");
      return;
    }

    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `market_data_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (showToast) showToast("JSON downloaded successfully", "success");
      setShowDownloadMenu(false);
    } catch (error) {
      if (showToast) showToast("Failed to download JSON", "error");
      console.error("JSON download error:", error);
    }
  };

  const buttonStyle = {
    padding: '8px',
    fontSize: '16px',
    backgroundColor: 'rgba(0, 255, 127, 0.1)',
    color: '#00ff7f',
    border: '1px solid rgba(0, 255, 127, 0.3)',
    borderRadius: '0',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    boxShadow: '0 0 10px rgba(0, 255, 127, 0.2)',
    fontFamily: "'Orbitron', monospace",
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    position: 'relative',
    overflow: 'hidden'
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'No data';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <>
      <div style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Current Timestamp Display */}
        {currentTimestamp && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 10px',
            backgroundColor: 'rgba(0, 255, 127, 0.1)',
            border: '1px solid rgba(0, 255, 127, 0.3)',
            color: '#00ff7f',
            fontFamily: "'Orbitron', monospace",
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            boxShadow: '0 0 10px rgba(0, 255, 127, 0.2)'
          }}>
            <Clock size={14} />
            {formatTimestamp(currentTimestamp)}
          </div>
        )}

        {/* Replay Controls - Only show in REPLAY mode */}
        {currentMode === "REPLAY" && (
          <>
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              style={{
                ...buttonStyle,
                opacity: isLoading ? 0.5 : 1
              }}
              title={isPlaying ? "Pause" : isPaused ? "Resume" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Speed Toggle Button */}
            <button
              onClick={handleSpeedToggle}
              disabled={isLoading}
              style={{
                ...buttonStyle,
                backgroundColor: speed > 1 ? 'rgba(0, 255, 127, 0.3)' : 'rgba(0, 255, 127, 0.1)',
                borderColor: speed > 1 ? '#00ff7f' : 'rgba(0, 255, 127, 0.3)',
                boxShadow: speed > 1 ? '0 0 20px rgba(0, 255, 127, 0.4)' : '0 0 10px rgba(0, 255, 127, 0.2)',
                opacity: isLoading ? 0.5 : 1
              }}
              title={`Speed: ${speed}x (Toggle to ${speed === 1 ? speedUpValue : 1}x)`}
            >
              <FastForward size={18} />
            </button>

            {/* Go Back Button */}
            <button
              onClick={handleGoBack}
              disabled={isLoading}
              style={{
                ...buttonStyle,
                opacity: isLoading ? 0.5 : 1
              }}
              title={`Go back ${goBackSeconds}s`}
            >
              <SkipBack size={18} />
            </button>
          </>
        )}

        {/* LIVE Mode Indicator */}
        {currentMode === "LIVE" && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 12px',
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            color: '#ff0000',
            fontFamily: "'Orbitron', monospace",
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '1px',
            boxShadow: '0 0 15px rgba(255, 0, 0, 0.3)',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ff0000',
              boxShadow: '0 0 10px rgba(255, 0, 0, 0.8)',
              animation: 'blink 1s ease-in-out infinite'
            }} />
            LIVE STREAMING
          </div>
        )}

        {/* Download Button with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            style={{
              ...buttonStyle,
              backgroundColor: showDownloadMenu ? 'rgba(0, 255, 127, 0.3)' : 'rgba(0, 255, 127, 0.1)',
              borderColor: showDownloadMenu ? '#00ff7f' : 'rgba(0, 255, 127, 0.3)',
              boxShadow: showDownloadMenu ? '0 0 20px rgba(0, 255, 127, 0.4)' : '0 0 10px rgba(0, 255, 127, 0.2)'
            }}
            title="Download data"
          >
            <Download size={18} />
          </button>

          {/* Download Dropdown Menu - Using Portal */}
          {showDownloadMenu && createPortal(
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999
            }}
            onClick={() => setShowDownloadMenu(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '120px', // Adjust based on where your download button is
                  right: '24px', // Adjust based on where your download button is
                  backgroundColor: 'rgba(0, 20, 0, 0.95)',
                  border: '1px solid rgba(0, 255, 127, 0.5)',
                  boxShadow: '0 0 30px rgba(0, 255, 127, 0.3)',
                  backdropFilter: 'blur(10px)',
                  minWidth: '150px',
                  zIndex: 10000
                }}
              >
                <button
                  onClick={handleDownloadCSV}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    color: '#00ff7f',
                    border: 'none',
                    borderBottom: '1px solid rgba(0, 255, 127, 0.2)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: '600',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 255, 127, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileText size={14} />
                  CSV
                </button>
                <button
                  onClick={handleDownloadJSON}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    color: '#00ff7f',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: '600',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 255, 127, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileJson size={14} />
                  JSON
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Settings Button - Only show in REPLAY mode */}
        {currentMode === "REPLAY" && (
          <button
            onClick={() => setShowModal(true)}
            style={buttonStyle}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Settings Modal - Using Portal */}
      {showModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(0, 20, 0, 0.95)',
              border: '2px solid rgba(0, 255, 127, 0.5)',
              boxShadow: '0 0 50px rgba(0, 255, 127, 0.3)',
              backdropFilter: 'blur(10px)',
              padding: '24px',
              maxWidth: '500px',
              width: '100%'
            }}
          >
            <h2 style={{
              margin: '0 0 20px 0',
              color: '#00ff7f',
              fontFamily: "'Orbitron', monospace",
              fontSize: '18px',
              fontWeight: '700',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              borderBottom: '2px solid rgba(0, 255, 127, 0.3)',
              paddingBottom: '10px'
            }}>
              Settings
            </h2>

            {/* Speed Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#00ff7f',
                fontFamily: "'Orbitron', monospace",
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.5px'
              }}>
                Speed Up Value
              </label>
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                {[0.5, 1, 2, 3, 5, 10].map(val => (
                  <button
                    key={val}
                    onClick={() => setTempSpeedUp(val)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: tempSpeedUp === val ? 'rgba(0, 255, 127, 0.3)' : 'rgba(0, 255, 127, 0.1)',
                      color: tempSpeedUp === val ? '#000000' : '#00ff7f',
                      border: tempSpeedUp === val ? '1px solid #00ff7f' : '1px solid rgba(0, 255, 127, 0.3)',
                      borderRadius: '0',
                      cursor: 'pointer',
                      fontFamily: "'Orbitron', monospace",
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: tempSpeedUp === val ? '0 0 15px rgba(0, 255, 127, 0.3)' : 'none'
                    }}
                  >
                    {val}x
                  </button>
                ))}
              </div>
            </div>

            {/* Go Back Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#00ff7f',
                fontFamily: "'Orbitron', monospace",
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.5px'
              }}>
                Go Back (seconds)
              </label>
              <input
                type="number"
                min="0.25"
                max="100"
                step="0.25"
                value={tempGoBack}
                onChange={(e) => setTempGoBack(Math.min(100, Math.max(0.25, parseFloat(e.target.value) || 0.25)))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 20, 0, 0.8)',
                  color: '#00ff7f',
                  border: '1px solid rgba(0, 255, 127, 0.3)',
                  borderRadius: '0',
                  fontSize: '13px',
                  fontFamily: "'Orbitron', monospace",
                  fontWeight: '600'
                }}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplySettings}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                backgroundColor: 'rgba(0, 255, 127, 0.2)',
                color: '#00ff7f',
                border: '1px solid #00ff7f',
                borderRadius: '0',
                cursor: 'pointer',
                fontFamily: "'Orbitron', monospace",
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 20px rgba(0, 255, 127, 0.3)'
              }}
            >
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
