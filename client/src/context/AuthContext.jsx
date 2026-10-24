import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, logoutUser, fetchCurrentUser } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('skillswap_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('skillswap_token'));
  const [loading, setLoading] = useState(true);

  // Sync current user profile on load
  const loadUser = useCallback(async () => {
    const storedToken = localStorage.getItem('skillswap_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }
    try {
      const freshUser = await fetchCurrentUser();
      setUser(freshUser);
      localStorage.setItem('skillswap_user', JSON.stringify(freshUser));
    } catch (err) {
      console.error('Failed to restore session:', err);
      localStorage.removeItem('skillswap_token');
      localStorage.removeItem('skillswap_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('skillswap:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('skillswap:unauthorized', handleUnauthorized);
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    localStorage.setItem('skillswap_token', data.token);
    localStorage.setItem('skillswap_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await registerUser(userData);
    // Do not automatically set user session or persist token; user must sign in manually
    return data;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // ignore server logout error
    } finally {
      localStorage.removeItem('skillswap_token');
      localStorage.removeItem('skillswap_user');
      setToken(null);
      setUser(null);
    }
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('skillswap_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateCurrentUser,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
