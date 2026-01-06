// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);

  // Initialize: Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    const storedSessionId = localStorage.getItem('session_id');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setSessionId(storedSessionId || generateSessionId());
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('session_id');
      }
    } else {
      // Generate session ID for unauthenticated users too (optional)
      setSessionId(generateSessionId());
    }
    
    setLoading(false);
  }, []);

  // Generate unique session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Login function
  const login = async (email, password) => {
    try {
      const API_URL = import.meta.env.VITE_BACKEND_HTTP || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      
      // Store token and user data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      // Generate new session ID on login
      const newSessionId = generateSessionId();
      localStorage.setItem('session_id', newSessionId);
      
      setUser(data.user);
      setSessionId(newSessionId);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // Register function
  const register = async (name, email, password) => {
    try {
      const API_URL = import.meta.env.VITE_BACKEND_HTTP || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      
      // Store token and user data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      // Generate new session ID on registration
      const newSessionId = generateSessionId();
      localStorage.setItem('session_id', newSessionId);
      
      setUser(data.user);
      setSessionId(newSessionId);
      
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('session_id');
    setUser(null);
    // Generate new session ID after logout (optional)
    setSessionId(generateSessionId());
  };

  // Get auth token
  const getToken = () => {
    return localStorage.getItem('auth_token');
  };

  const value = {
    user,
    sessionId,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};