import { useState, useEffect, useRef } from "react";
import { Loader2, Radio, Play } from 'lucide-react';
import DashboardLayout from "../layout/DashboardLayout";
import Toast from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import logger from "../utils/logger";
// import DataExport from "../components/DataExport";
import "../styles/dashboard.css";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS =
  import.meta.env.VITE_BACKEND_WS || `${BACKEND_HTTP.replace(/^http/, "ws")}/ws`;
const MAX_BUFFER = 1000; // Increased from 100 to 1000 for LIVE mode

const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' }
];

export default function Dashboard() {
  const { sessionId } = useAuth();
  const [data, setData] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [replayState, setReplayState] = useState("PLAYING"); // Track state locally
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef(null);
  const bufferRef = useRef([]);

  // Mode switching state
  const [currentMode, setCurrentMode] = useState("REPLAY"); // "LIVE" or "REPLAY"
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [isModeLoading, setIsModeLoading] = useState(false);

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  // -------------------------------
  // Mode Switching Logic
  // -------------------------------
  const switchMode = async (mode, symbol = null) => {
    setIsModeLoading(true);
    try {
      const payload = { mode };
      if (mode === "LIVE" && symbol) {
        payload.symbol = symbol;
      }

      const response = await fetch(`${BACKEND_HTTP}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        setCurrentMode(mode);
        if (mode === "LIVE" && symbol) {
          setSelectedSymbol(symbol);
        }

        // Clear existing data when switching modes
        setData([]);
        setLatestSnapshot(null);

        showToast(`Switched to ${mode} mode${mode === "LIVE" ? ` (${symbol})` : ''}`, 'success');
        return true;
      } else {
        showToast(result.message || 'Mode switch failed', 'error');
        return false;
      }
    } catch (err) {
      console.error("Mode switch error:", err);
      showToast('Failed to switch mode', 'error');
      return false;
    } finally {
      setIsModeLoading(false);
    }
  };

  const handleLiveMode = () => {
    switchMode("LIVE", selectedSymbol);
  };

  const handleReplayMode = () => {
    switchMode("REPLAY");
  };

  const handleSymbolChange = (symbol) => {
    setSelectedSymbol(symbol);
    if (currentMode === "LIVE") {
      switchMode("LIVE", symbol);
    }
  };

  // -------------------------------
  // WebSocket with Session Support
  // -------------------------------
  useEffect(() => {
    if (!sessionId) {
      logger.error('Dashboard', 'No session ID available');
      return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000;
    let reconnectTimeout = null;
    let intentionallyClosed = false;

    const connect = () => {
      // Connect to session-specific WebSocket
      const wsUrl = `${BACKEND_HTTP.replace(/^http/, "ws")}/ws/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Connected to session ${sessionId}`);
        reconnectAttempts = 0;
        
        // Auto-start replay on connection (like ModelTest)
        if (currentMode === "REPLAY") {
            fetch(`${BACKEND_HTTP}/replay/${sessionId}/start`, {
              method: 'POST',
              credentials: 'include'
            })
            .then(() => {
              console.log('✅ Replay auto-started');
              setReplayState("PLAYING");
            })
            .catch(err => console.error('Failed to auto-start replay:', err));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Initial history payload
          if (message.type === "history") {
            setData(message.data || []);
            if (message.data && message.data.length > 0) {
              setLatestSnapshot(message.data[message.data.length - 1]);
            }
            return;
          }

          // Live replay update: Buffer it instead of updating state immediately
          bufferRef.current.push(message);

        } catch (err) {
          logger.error('Dashboard', 'Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        logger.info('Dashboard', 'Disconnected from session', event.code, event.reason);

        if (!intentionallyClosed && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          logger.info('Dashboard', `Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
          reconnectTimeout = setTimeout(connect, reconnectDelay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          logger.error('Dashboard', 'Max reconnection attempts reached');
          showToast("Connection lost. Please refresh.", "error");
        }
      };

      ws.onerror = (err) => {
        logger.error('Dashboard', 'WebSocket error:', err);
      };
    };

    connect();

    // Throttled update loop
    const flushBuffer = () => {
      if (bufferRef.current.length > 0) {
        const newItems = [...bufferRef.current];
        bufferRef.current = []; // Clear buffer

        // Update latest snapshot
        setLatestSnapshot(newItems[newItems.length - 1]);

        // Batch update data
        setData((prev) => {
          let updated = [...prev, ...newItems];
          if (updated.length > MAX_BUFFER) {
            updated = updated.slice(updated.length - MAX_BUFFER);
          }
          return updated;
        });
      }
    };

    const intervalId = setInterval(flushBuffer, 10); // Reduced from 100ms to 10ms for LIVE mode

    return () => {
      clearInterval(intervalId);
      intentionallyClosed = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);


  // -------------------------------
  // Replay Controls with Session ID
  // -------------------------------
  const controlReplay = async (path, newState) => {
    if (!sessionId) {
      showToast("Session not initialized", "error");
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_HTTP}/replay/${sessionId}/${path}`, {
        method: "POST",
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'error') {
        showToast(result.message || 'Control failed', 'error');
        return false;
      }

      if (newState) setReplayState(newState);
      return true;
    } catch (err) {
      console.error("Replay control error:", err);
      showToast('Connection error', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = () => controlReplay("start", "PLAYING");
  const handlePause = () => controlReplay("pause", "PAUSED");
  const handleResume = () => controlReplay("resume", "PLAYING");
  const handleStop = () => controlReplay("stop", "STOPPED");

  const handleSpeed = (speed) => {
    setCurrentSpeed(speed);
    return controlReplay(`speed/${speed}`);
  };

  const handleGoBack = async (seconds) => {
    if (!sessionId) {
      showToast("Session not initialized", "error");
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_HTTP}/replay/${sessionId}/goback/${seconds}`, {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();

      if (result.status === 'success') {
        setData([]);
        setLatestSnapshot(null);
        return true;
      } else {
        showToast(result.message || 'Rewind failed', 'error');
        return false;
      }
    } catch (error) {
      console.error('Go back failed:', error);
      showToast('Rewind failed', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="cyber-dashboard" style={{ minHeight: '100vh', backgroundColor: '#0a0f0a' }}>
      {/* Mode Switching UI - Cyber Theme */}
      <div className="cyber-mode-switcher">
        {/* Mode Buttons */}
        <div className="cyber-mode-buttons">
          <button
            onClick={handleReplayMode}
            disabled={isModeLoading}
            className={`cyber-mode-btn ${currentMode === 'REPLAY' ? 'active' : ''}`}
          >
            <Play size={12} />
            REPLAY
          </button>

          <button
            onClick={handleLiveMode}
            disabled={isModeLoading}
            className={`cyber-mode-btn cyber-mode-btn-live ${currentMode === 'LIVE' ? 'active' : ''}`}
          >
            <Radio size={12} />
            LIVE
          </button>
        </div>

        {/* Symbol Selector (LIVE only) */}
        {currentMode === 'LIVE' && (
          <>
            <div className="cyber-divider" />
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              disabled={isModeLoading}
              className="cyber-symbol-select"
            >
              {SYMBOLS.map(symbol => (
                <option key={symbol.value} value={symbol.value}>
                  {symbol.label}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Current Mode Indicator */}
        <div className={`cyber-mode-indicator ${currentMode === 'LIVE' ? 'live' : 'replay'}`}>
          {currentMode === 'LIVE' ? (
            <>
              <div className="cyber-pulse-dot" />
              LIVE {selectedSymbol}
            </>
          ) : (
            <>REPLAY</>
          )}
        </div>

        {/* Loading indicator */}
        {isModeLoading && (
          <Loader2 size={14} className="animate-spin cyber-loader" />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="cyber-loading-overlay">
          <div className="cyber-loading-content">
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </div>
        </div>
      )}

      <DashboardLayout
        data={data}
        latestSnapshot={latestSnapshot}
        onPlay={handlePlay}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onSpeed={handleSpeed}
        onGoBack={handleGoBack}
        replayState={replayState}
        currentSpeed={currentSpeed}
        currentMode={currentMode}
        showToast={showToast}
      />
    </div>
  );
}