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
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initSession = async () => {
      // Defer synchronous execution to avoid state cascading warnings in rendering phase
      await Promise.resolve();
      if (active) {
        refreshUser();
      }
    };
    initSession();
    return () => {
      active = false;
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
      
      // Route based on role
      if (userData.role === 'admin' || userData.role === 'department_head') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed';
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
    router.push('/login');
  };

  // React 19 standard: context value supplied directly to context object instead of context.Provider
  return (
    <AuthContext value={{ user, loading, error, login, logout, register, refreshUser }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
