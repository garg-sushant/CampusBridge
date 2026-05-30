'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (email: string) => Promise<void>;
  logout: () => void;
  register: (email: string, full_name: string, password: string, role?: string, departmentId?: number) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch (err) {
      console.error('Failed to load user session:', err);
      const isNetworkError = err instanceof TypeError || (err instanceof Error && err.name === 'AbortError');
      if (!isNetworkError) {
        localStorage.removeItem('token');
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Synchronise authentication session changes (login/logout/role-switching) across multiple tabs instantly
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      localStorage.setItem('token', data.access_token);
      
      // Load user profile
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
      
      // Route based on role using window.location.href to fully reload state and purge segment cache
      if (userData.role === 'admin' || userData.role === 'department_head') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.googleLogin(email);
      localStorage.setItem('token', data.access_token);
      
      // Load user profile
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
      
      // Route based on role using window.location.href to fully reload state and purge segment cache
      if (userData.role === 'admin' || userData.role === 'department_head') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Google authentication failed';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string, 
    fullName: string, 
    password: string, 
    role: string = 'student', 
    departmentId?: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/register', {
        email,
        full_name: fullName,
        password,
        role,
        department_id: departmentId || null
      });
      
      // Perform auto-login after successful registration
      await login(email, password);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Registration failed';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginWithGoogle, logout, register, refreshUser }}>
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
