// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home'; // Assuming you have a Home page
import ModelTest from './pages/ModelTest';

function App() {
  return (
    <ErrorBoundary fallbackMessage="The application encountered an error. Please refresh the page.">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackMessage="Error loading Home page.">
                    <Home />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

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
              path="/model-test"
              element={
                <ProtectedRoute>
                  <ErrorBoundary fallbackMessage="Error loading Model Test page.">
                    <ModelTest />
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