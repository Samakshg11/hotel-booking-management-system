import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('hms_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('hms_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    queryClient.clear();
    return res.data.user;
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    localStorage.setItem('hms_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    queryClient.clear();
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('hms_token');
    // Also clear the cached header so the next request doesn't send the stale token
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    queryClient.clear();
  };

  // 1-Click Demo Role Switcher for instant interview demonstration
  const switchDemoRole = async (role) => {
    const credentials = {
      guest: { email: 'guest@demo.test', password: 'Password123!' },
      staff: { email: 'staff@demo.test', password: 'Password123!' },
      admin: { email: 'admin@demo.test', password: 'Password123!' },
    };

    if (credentials[role]) {
      return login(credentials[role].email, credentials[role].password);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || 'guest',
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

