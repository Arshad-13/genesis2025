import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);

  const API_URL = import.meta.env.VITE_BACKEND_HTTP || 'http://localhost:8000';

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  };

  const getOrCreateSessionId = () => {
    let sid = localStorage.getItem('session_id');
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem('session_id', sid);
    }
    return sid;
  };

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setSessionId(getOrCreateSessionId());
        } else {
          setSessionId(generateSessionId());
          localStorage.setItem('session_id', sessionId);
        }
      } catch {
        const sid = getOrCreateSessionId();
        setSessionId(sid);
      }
      setLoading(false);
    };

    verifyAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();

      const newSessionId = generateSessionId();
      localStorage.setItem('session_id', newSessionId);

      setUser(data.user);
      setSessionId(newSessionId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();

      const newSessionId = generateSessionId();
      localStorage.setItem('session_id', newSessionId);

      setUser(data.user);
      setSessionId(newSessionId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
    }
    localStorage.removeItem('session_id');
    setUser(null);
    setSessionId(generateSessionId());
    localStorage.setItem('session_id', sessionId);
  };

  const value = {
    user,
    sessionId,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
