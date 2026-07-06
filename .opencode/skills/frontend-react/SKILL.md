# Frontend React Skill — Dashboard / Charts / WebSocket

You are working on a **React 18 + Vite** frontend for a trading dashboard. Follow these conventions.

## Tech Stack
- **React 18**, **Vite 4**, **Tailwind CSS 3**, **Lucide React** icons
- **Canvas API** for custom charts (60 FPS, 300+ data points)
- **WebSocket** for real-time data streaming

## Code Conventions
- Functional components with hooks only
- Custom hooks for reusable logic (e.g., `useWebSocket`, `useAuth`)
- Use `useRef` for mutable values that shouldn't trigger re-renders (WebSocket refs, buffers)
- Component files: one component per file, PascalCase naming
- Page components in `src/pages/`, shared components in `src/components/`, layouts in `src/layout/`
- Context providers in `src/contexts/`

## State Management
- `AuthContext` for user/session state (currently uses localStorage — see issues)
- Local state via `useState` for component-specific data
- Buffer patterns: use `useRef([])` + `setInterval` for batched state updates
- Avoid deep prop drilling — lift state or use context

## WebSocket Patterns
1. Connect in `useEffect` with session-specific URL: `ws://host/ws/{sessionId}`
2. Store WebSocket in `useRef` (not state — it's mutable, not reactive)
3. Buffer incoming messages, flush at interval (10-100ms) to avoid excessive re-renders
4. Implement reconnect with exponential backoff (max 10 attempts)
5. Clean up on unmount: `clearInterval`, `clearTimeout`, `ws.close()`

## When Adding Charts
1. Use the **Canvas API directly** (not chart libraries) for performance at 60 FPS
2. Draw in `useEffect` with `requestAnimationFrame` loop
3. Keep canvas element via `useRef`, update only changed data points
4. Handle resize with `ResizeObserver`

## When Adding UI Components
1. Follow the existing cyber-dashboard theme (className prefixes like `cyber-*`)
2. Use Tailwind utility classes for layout/spacing, custom CSS for theme
3. Use Lucide React icons (consistent size: `size={14}` for inline, `size={20}` for standalone)
4. Toast notifications: use the existing `Toast` component with `showToast()` pattern

## Security Rules (Frontend)
1. **NEVER** store auth tokens in `localStorage` — use httpOnly cookies
2. Sanitize data before rendering (anomaly messages, trade data)
3. Escape user-generated content (report names, session IDs) in JSX
4. Validate WebSocket message structure before processing
5. Use `import.meta.env.VITE_*` for environment variables (never hardcode URLs)
6. Always use `credentials: 'include'` for cookie-based auth

## Performance Rules
1. Buffer WebSocket messages — don't `setState` on every message
2. Use `React.memo` for expensive components (charts, order books)
3. `useCallback` for event handlers passed to child components
4. `useMemo` for derived data (filtered anomalies, computed metrics)
5. Limit re-renders: move state down, use selectors, batch updates

## File Map
| File | When to Edit |
|---|---|
| `src/pages/Dashboard.jsx` | Main monitoring page, mode switching, replay controls, WebSocket |
| `src/pages/ModelTest.jsx` | Strategy control page |
| `src/pages/Reports.jsx` | Report listing and download |
| `src/pages/Auth.jsx` | Login/register forms |
| `src/pages/MarketPredict.jsx` | Market prediction view |
| `src/contexts/AuthContext.jsx` | Auth state, login/register/logout |
| `src/components/SignalMonitor.jsx` | Anomaly signal display |
| `src/components/CanvasPriceChart.jsx` | Real-time price chart (Canvas) |
| `src/components/OrderBook.jsx` | Level 2 order book visualization |
| `src/components/LiquidityGapMonitor.jsx` | Gap detection visualization |
| `src/components/SpoofingDetector.jsx` | Spoofing detection display |
| `src/components/RiskDashboard.jsx` | Risk metrics dashboard |
| `src/components/ErrorBoundary.jsx` | React error boundary |
| `src/components/Sidebar.jsx` | Navigation sidebar |
| `src/components/Toast.jsx` | Toast notification system |
| `src/components/ProtectedRoute.jsx` | Auth-gated route wrapper |
| `src/layout/DashboardLayout.jsx` | Dashboard layout grid |
