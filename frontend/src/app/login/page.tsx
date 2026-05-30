'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { GraduationCap, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Autofill helper for reviewers
  const handleAutofill = (role: 'student' | 'it' | 'admin') => {
    if (role === 'student') {
      setEmail('student@campus.edu');
      setPassword('studentpassword');
    } else if (role === 'it') {
      setEmail('ithead@campus.edu');
      setPassword('itpassword');
    } else if (role === 'admin') {
      setEmail('admin@campus.edu');
      setPassword('adminpassword');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError('Please fill in all fields.');
      return;
    }
    try {
      await login(email, password);
    } catch {
      // Errors are handled by context but we can log them
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
            <GraduationCap className="h-7 w-7 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Sign In to Aegis</h2>
          <p className="text-sm text-zinc-400">Campus Governance & Grievance Portal</p>
        </div>

        {/* Form Container */}
        <div className="glass-panel p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Context/Form error message */}
            {(error || formError) && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="login-email" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Campus Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@campus.edu"
                  aria-required="true"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-required="true"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-neutral-400 font-bold text-white shadow-sm transition-all duration-200"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-5 w-5" aria-hidden="true" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>

          {/* Registration Redirect */}
          <div className="mt-6 text-center text-sm text-neutral-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-indigo-400 hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        {/* Quick Autofill Widgets for Dev Review */}
        <div className="mt-8 glass-panel p-5 rounded-xl border border-white/5 text-center">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Reviewer Quick Login Roles
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => handleAutofill('student')}
              aria-label="Autofill Student account credentials"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-xs text-zinc-300 font-medium transition-all duration-200"
            >
              ⚡ Student
            </button>
            <button
              onClick={() => handleAutofill('it')}
              aria-label="Autofill IT Services Head credentials"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-xs text-zinc-300 font-medium transition-all duration-200"
            >
              ⚡ IT Services Head
            </button>
            <button
              onClick={() => handleAutofill('admin')}
              aria-label="Autofill Dean Admin credentials"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-xs text-zinc-300 font-medium transition-all duration-200"
            >
              ⚡ Dean (Admin)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
