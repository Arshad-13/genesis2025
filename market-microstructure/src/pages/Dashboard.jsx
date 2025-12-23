import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import "../styles/dashboard.css";

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS =
  import.meta.env.VITE_BACKEND_WS || `${BACKEND_HTTP.replace(/^http/, "ws")}/ws`;
const MAX_BUFFER = 100;

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const wsRef = useRef(null);

  // -------------------------------
  // WebSocket: Market Data Stream
  // -------------------------------
  useEffect(() => {
    const ws = new WebSocket(BACKEND_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ Connected to Market Replay Feed");
    };

    ws.onmessage = (event) => {
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
    };

    ws.onclose = () => {
      console.log(" Disconnected from Market Replay Feed");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", {
        url: ws.url,
        readyState: ws.readyState,
        err,
      });
    };

    return () => {
      ws.close();
    };
  }, []);

  // -------------------------------
  // Replay Controls (REST → Backend)
  // -------------------------------
  const controlReplay = (path) => {
    fetch(`${BACKEND_HTTP}/replay/${path}`, {
      method: "POST",
    }).catch((err) => {
      console.error("Replay control error:", err);
    });
  };

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <DashboardLayout
      data={data}
      latestSnapshot={latestSnapshot}
      onPlay={() => controlReplay("start")}
      onPause={() => controlReplay("pause")}
      onResume={() => controlReplay("resume")}
      onStop={() => controlReplay("stop")}
      onSpeed={(v) => controlReplay(`speed/${v}`)}
    />
  );
}
