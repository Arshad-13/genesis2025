# Genesis 2025: Market Microstructure Simulator

## Project Overview
Genesis 2025 is a high-frequency market simulator designed to model, analyze, and visualize complex market microstructure phenomena. It simulates a Limit Order Book (LOB) in real-time, calculates institutional-grade metrics (OFI, V-PIN), and allows for interactive trading to test price impact models.

---

## 📜 Comprehensive Development Log (Start to Present)

### Phase 1: Foundation & Infrastructure
**Goal:** Establish the communication backbone and basic simulation.
1.  **Backend Setup (FastAPI):**
    *   Created `main.py` with a WebSocket endpoint (`/ws`) to stream data.
    *   Implemented a threaded `simulation_loop` to decouple data generation from API handling.
2.  **Frontend Setup (React + Vite):**
    *   Initialized the project structure.
    *   Built a `Dashboard` component to consume WebSocket data.
3.  **Basic Simulation:**
    *   Created `MarketSimulator` class in `analytics.py`.
    *   Implemented a "Random Walk" price model.
    *   Generated synthetic L2 Depth (Bids and Asks) using Gaussian distributions.

### Phase 2: Quantitative Analytics (The "Brain")
**Goal:** Implement advanced financial metrics to analyze the simulation.
1.  **OFI (Order Flow Imbalance):**
    *   Implemented logic to track changes in Best Bid/Ask and their quantities.
    *   Formula: Calculates net buying/selling pressure at the top of the book.
2.  **Microprice & OBI:**
    *   Added **Microprice** (Volume-Weighted Mid Price) to detect subtle price pressure.
    *   Added **OBI (Order Book Imbalance)** to measure depth asymmetry.
3.  **Regime Detection (Machine Learning):**
    *   Integrated `scikit-learn` KMeans clustering.
    *   The system now classifies market states into "Calm", "Stressed", or "Manipulation" based on volatility and spread.

### Phase 3: Optimization & Visualization Overhaul
**Goal:** Fix performance bottlenecks and improve visual quality.
1.  **The Plotly Problem:**
    *   Initial charts using `react-plotly.js` were too slow (laggy) for high-frequency updates (10 ticks/sec).
2.  **The Canvas Solution:**
    *   **CanvasPriceChart.jsx:** Built a custom HTML5 Canvas chart from scratch.
    *   **CanvasHeatmap.jsx:** Built a custom L2 Depth Heatmap.
    *   **Result:** Achieved smooth 60fps rendering with zero DOM overhead.
    *   **Polish:** Added DPI scaling (Retina support) and precise crosshair interactions.

### Phase 4: Advanced Features & Realism (Current State)
**Goal:** Make the simulation "real" and interactive.
1.  **Feature H: V-PIN (Toxic Flow Detection):**
    *   Implemented **Volume Bucketing** (sampling every 1000 units of volume).
    *   Calculated **V-PIN** (Volume-Synchronized Probability of Informed Trading) to detect toxic order flow.
    *   Added a visual alert panel in the frontend.
2.  **Feature I: Endogenous Price Impact:**
    *   **Major Physics Change:** Abandoned the "Random Walk".
    *   **New Logic:** Price now moves *because* of the Order Flow Imbalance (OFI).
    *   Formula: `Price_Change = Impact_Coeff * OFI + Noise`.
3.  **Feature J: Interactive Trading Desk:**
    *   Added **Buy/Sell Buttons** to the frontend `ControlsBar`.
    *   Updated Backend to accept `ORDER` messages via WebSocket.
    *   **Feedback Loop:** User orders now consume liquidity -> change OFI -> move the Price -> spike V-PIN.
4.  **System Hardening:**
    *   Added **Pydantic** validation to prevent bad data from crashing the server.
    *   Added **Error Handling** to the simulation thread to auto-recover from crashes.

---

## 🛠️ Technical Stack

### Backend (Python)
- **Framework:** FastAPI (High-performance Async API)
- **Data Processing:** NumPy, Pandas (Vectorized math)
- **Machine Learning:** Scikit-Learn (KMeans Clustering)
- **Validation:** Pydantic (Strict data schemas)

### Frontend (JavaScript)
- **Framework:** React 19 + Vite (Fast build tool)
- **Visualization:** HTML5 Canvas API (Custom high-performance charts)
- **Styling:** CSS Modules

---

## 🚀 How to Run

### 1. Start the Backend
```bash
cd backend
# Ensure virtual environment is active
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend
```bash
cd market-microstructure
npm run dev
```

### 3. Interact
- Open `http://localhost:5173`.
- Watch the **Price Chart** and **Heatmap** update in real-time.
- Use the **Buy/Sell buttons** to inject orders and watch the market react!
