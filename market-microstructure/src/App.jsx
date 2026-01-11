// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home'; // Assuming you have a Home page
import MarketPredict from './pages/MarketPredict';
import Reports from './pages/Reports';

function App() {
  return (
    <ErrorBoundary fallbackMessage="The application encountered an error. Please refresh the page.">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <ErrorBoundary fallbackMessage="Error loading Home page.">
                  <Home />
                </ErrorBoundary>
              } 
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackMessage="Error loading Dashboard.">
                    <Dashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route
              path="/market-predict"
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackMessage="Error loading Market Predict page.">
                    <MarketPredict />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackMessage="Error loading Reports page.">
                    <Reports />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;