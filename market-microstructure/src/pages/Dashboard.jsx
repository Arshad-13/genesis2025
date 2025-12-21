import { useState, useEffect } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);

  useEffect(() => {
    // WebSocket Connection
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onopen = () => {
      console.log("Connected to Market Data Feed");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "history") {
        // Initial load
        setData(message.data);
        if (message.data.length > 0) {
            setLatestSnapshot(message.data[message.data.length - 1]);
        }
      } else {
        // Real-time update
        const newSnapshot = message;
        setLatestSnapshot(newSnapshot);
        setData(prevData => {
            const newData = [...prevData, newSnapshot];
            if (newData.length > 100) newData.shift(); // Keep buffer size managed
            return newData;
        });
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from Market Data Feed");
    };

    return () => {
      ws.close();
    };
  }, []);

  return <DashboardLayout data={data} latestSnapshot={latestSnapshot} />;
}
