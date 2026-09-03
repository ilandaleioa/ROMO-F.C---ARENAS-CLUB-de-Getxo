import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch (_) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('romofc:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('romofc:auth-expired', handleAuthExpired);
  }, []);

  const login = async (username, password) => {
    const { user } = await api.post('/auth/login', { username, password });
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
