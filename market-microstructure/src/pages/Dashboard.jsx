import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import Toast from "../components/Toast";
import DataExport from "../components/DataExport";
import "../styles/dashboard.css";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS =
  import.meta.env.VITE_BACKEND_WS || `${BACKEND_HTTP.replace(/^http/, "ws")}/ws`;
const MAX_BUFFER = 100;

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [replayState, setReplayState] = useState("PLAYING"); // Track state locally
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef(null);

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  // -------------------------------
  // WebSocket: Market Data Stream with Auto-Reconnect
  // -------------------------------
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000;
    let reconnectTimeout = null;
    let intentionallyClosed = false;

    const connect = () => {
      const ws = new WebSocket(BACKEND_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Connected to Market Replay Feed");
        reconnectAttempts = 0; // Reset on successful connection
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

          // Live replay update
          const snapshot = message;
          setLatestSnapshot(snapshot);

          setData((prev) => {
            const updated = [...prev, snapshot];
            if (updated.length > MAX_BUFFER) updated.shift();
            return updated;
          });
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("❌ Disconnected from Market Replay Feed", event.code, event.reason);
        
        // Auto-reconnect if not intentionally closed
        if (!intentionallyClosed && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`🔄 Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
          reconnectTimeout = setTimeout(connect, reconnectDelay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error("❌ Max reconnection attempts reached. Please refresh the page.");
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", {
          url: ws.url,
          readyState: ws.readyState,
          err,
        });
      };
    };

    connect();

    return () => {
      intentionallyClosed = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // -------------------------------
  // Replay Controls (REST → Backend)
  // -------------------------------
  const controlReplay = async (path, newState) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_HTTP}/replay/${path}`, {
        method: "POST",
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
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_HTTP}/replay/goback/${seconds}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        // Clear frontend data buffer
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
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            padding: '20px 40px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '2px solid #334155',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 600
          }}>
            ⏳ Processing...
          </div>
        </div>
      )}

      {/* Data Export Controls */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <DataExport data={data} showToast={showToast} />
      </div>

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
        showToast={showToast}
      />
    </div>
  );
}