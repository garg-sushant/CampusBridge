'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { GraduationCap, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle, loading, error } = useAuth();
  
  // State variables for standard login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'student' | 'dept' | 'admin' | null>(null);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  
  // State variables for Google Account selector
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  
  // Ref to autofocus the email field upon role selection
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Guided role selector handler
  const handleRoleSelect = (role: 'student' | 'dept' | 'admin') => {
    setSelectedRole(role);
    setEmail('');
    setPassword('');
    setFormError(null);
    
    // Auto-focus email input field on next render tick
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  };

  // Instant login bypass handler
  const triggerAutoLogin = async (targetEmail: string, targetPass: string) => {
    setAutoLoginLoading(true);
    setFormError(null);
    setEmail(targetEmail);
    setPassword(targetPass);
    
    try {
      await login(targetEmail, targetPass);
    } catch {
      // Errors are captured and handled by AuthContext
    } finally {
      setAutoLoginLoading(false);
    }
  };

  // Google Account verification and Sign-In handler
  const handleGoogleAccountSelect = async (targetEmail: string) => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      await loginWithGoogle(targetEmail);
      setGoogleModalOpen(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setGoogleError(errMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!selectedRole) {
      setFormError('Please select your campus role at the bottom first.');
      return;
    }
    
    if (!email || !password) {
      setFormError('Please fill in both email and password fields.');
      return;
    }
    
    try {
      await login(email, password);
    } catch {
      // Auth errors are captured and handled by our AuthContext
    }
  };

  const isBtnLoading = loading || autoLoginLoading || googleLoading;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Background decoration blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-md">
            <GraduationCap className="h-7 w-7 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Sign In to Aegis</h2>
          <p className="text-sm text-zinc-400">Campus Governance & Grievance Portal</p>
        </div>

        {/* Form Container */}
        <div className="glass-panel p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error notifications */}
            {(error || formError) && (
              <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed animate-shake">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Instruction banner if no role is selected */}
            {!selectedRole && (
              <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold leading-relaxed animate-pulse">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>Select your role below first to unlock the login input fields.</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Campus Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4.5 w-4.5 text-neutral-500" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  ref={emailInputRef}
                  disabled={!selectedRole}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={selectedRole ? "name@campus.edu" : "Select role below first"}
                  aria-required="true"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-600 transition-all duration-300 ${
                    !selectedRole ? 'opacity-40 cursor-not-allowed bg-zinc-950/20' : 'opacity-100'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4.5 w-4.5 text-neutral-500" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  disabled={!selectedRole}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={selectedRole ? "••••••••" : "Select role below first"}
                  aria-required="true"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-600 transition-all duration-300 ${
                    !selectedRole ? 'opacity-40 cursor-not-allowed bg-zinc-950/20' : 'opacity-100'
                  }`}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isBtnLoading || !selectedRole}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 font-bold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed cursor-pointer"
            >
              {isBtnLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-5 w-5" aria-hidden="true" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#09090b] px-2.5 text-zinc-500 font-bold tracking-wider">Or continue with</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            disabled={isBtnLoading}
            onClick={() => setGoogleModalOpen(true)}
            className="w-full flex items-center justify-center space-x-2.5 py-3 rounded-xl bg-white hover:bg-neutral-100 disabled:bg-neutral-300 text-zinc-950 font-bold text-sm shadow-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.05.5 12 .5 7.38.5 3.4 3.14 1.45 7.02l3.82 2.96C6.23 6.98 8.89 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.44-1.09 2.66-2.31 3.48l3.6 2.79c2.1-1.94 3.76-4.8 3.76-8.37z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.54c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.45 7.02C.52 8.88 0 10.97 0 13.14s.52 4.26 1.45 6.12l3.82-2.96z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.24 0 5.95-1.08 7.93-2.91l-3.6-2.79c-1 .67-2.28 1.07-4.33 1.07-3.11 0-5.77-1.94-6.73-4.94l-3.82 2.96C3.4 20.86 7.38 23.5 12 23.5z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Registration Redirect */}
          <div className="mt-6 text-center text-xs text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-indigo-400 hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        {/* Primary Role Selector Widget */}
        <div className="mt-6 glass-panel p-5 rounded-2xl border border-white/5 text-center">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Select Your Role to Sign In
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => handleRoleSelect('student')}
              aria-label="Select Student Role"
              className={`flex-1 px-3.5 py-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                selectedRole === 'student'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300'
              }`}
            >
              🎓 Student
            </button>
            <button
              onClick={() => handleRoleSelect('dept')}
              aria-label="Select Department Role"
              className={`flex-1 px-3.5 py-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                selectedRole === 'dept'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300'
              }`}
            >
              🏢 Dept
            </button>
            <button
              onClick={() => handleRoleSelect('admin')}
              aria-label="Select Dean Admin Role"
              className={`flex-1 px-3.5 py-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300'
              }`}
            >
              🏛️ Dean (Admin)
            </button>
          </div>

          {/* Premium Glowing Credential Helper card with Instant Auto-Logins */}
          {selectedRole && (
            <div className="mt-5 p-4 bg-zinc-950/80 border border-indigo-500/20 rounded-xl text-left animate-slide-in relative overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                Credential Guide & Instant Login
              </span>
              <div className="mt-2.5 text-xs text-zinc-300 font-mono flex flex-col gap-2.5">
                {selectedRole === 'student' && (
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="text-zinc-500">Email:</span>{' '}
                      <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">student@campus.edu</code>
                      <br />
                      <span className="text-zinc-500">Password:</span>{' '}
                      <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">studentpassword</code>
                    </div>
                    <button
                      type="button"
                      disabled={isBtnLoading}
                      onClick={() => triggerAutoLogin('student@campus.edu', 'studentpassword')}
                      className="mt-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 font-bold text-[10px] text-indigo-200 hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>⚡ Instant Student Login</span>
                    </button>
                  </div>
                )}
                {selectedRole === 'dept' && (
                  <div className="space-y-3.5">
                    <div className="flex flex-col gap-1.5">
                      <div>
                        <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Option 1: WiFi/IT Services Head</span>
                        <span className="text-zinc-500">Email:</span>{' '}
                        <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">ithead@campus.edu</code>
                        <br />
                        <span className="text-zinc-500">Password:</span>{' '}
                        <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">itpassword</code>
                      </div>
                      <button
                        type="button"
                        disabled={isBtnLoading}
                        onClick={() => triggerAutoLogin('ithead@campus.edu', 'itpassword')}
                        className="flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 font-bold text-[10px] text-indigo-200 hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>⚡ Instant IT Dept Login</span>
                      </button>
                    </div>
                    
                    <div className="pt-2.5 border-t border-white/5 flex flex-col gap-1.5">
                      <div>
                        <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Option 2: Hostel Warden Head</span>
                        <span className="text-zinc-500">Email:</span>{' '}
                        <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">hostelhead@campus.edu</code>
                        <br />
                        <span className="text-zinc-500">Password:</span>{' '}
                        <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">hostelpassword</code>
                      </div>
                      <button
                        type="button"
                        disabled={isBtnLoading}
                        onClick={() => triggerAutoLogin('hostelhead@campus.edu', 'hostelpassword')}
                        className="flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 font-bold text-[10px] text-indigo-200 hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>⚡ Instant Hostel Dept Login</span>
                      </button>
                    </div>
                  </div>
                )}
                {selectedRole === 'admin' && (
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="text-zinc-500">Email:</span>{' '}
                      <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">admin@campus.edu</code>
                      <br />
                      <span className="text-zinc-500">Password:</span>{' '}
                      <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 select-all">adminpassword</code>
                    </div>
                    <button
                      type="button"
                      disabled={isBtnLoading}
                      onClick={() => triggerAutoLogin('admin@campus.edu', 'adminpassword')}
                      className="mt-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 font-bold text-[10px] text-indigo-200 hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>⚡ Instant Dean Login</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                Inputs are unlocked. Click an **Instant Login** button above to sign in instantly, or manually type the credentials inside the fields.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mock Google account selector modal */}
      {googleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 relative">
            
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <svg className="h-8 w-8" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.05.5 12 .5 7.38.5 3.4 3.14 1.45 7.02l3.82 2.96C6.23 6.98 8.89 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.44-1.09 2.66-2.31 3.48l3.6 2.79c2.1-1.94 3.76-4.8 3.76-8.37z" />
                  <path fill="#FBBC05" d="M5.27 14.54c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.45 7.02C.52 8.88 0 10.97 0 13.14s.52 4.26 1.45 6.12l3.82-2.96z" />
                  <path fill="#34A853" d="M12 23.5c3.24 0 5.95-1.08 7.93-2.91l-3.6-2.79c-1 .67-2.28 1.07-4.33 1.07-3.11 0-5.77-1.94-6.73-4.94l-3.82 2.96C3.4 20.86 7.38 23.5 12 23.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Choose an Account</h3>
              <p className="text-xs text-zinc-400">to continue to Aegis Campus Portal</p>
            </div>

            {/* Error in modal */}
            {googleError && (
              <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed animate-shake">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{googleError}</span>
              </div>
            )}

            {/* Accounts list */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[
                { email: 'student@campus.edu', name: 'Amit Patel', desc: 'Student' },
                { email: 'ithead@campus.edu', name: 'Prof. Rajesh Sharma', desc: 'IT Head' },
                { email: 'hostelhead@campus.edu', name: 'Dr. Sunita Rao', desc: 'Hostel Warden' },
                { email: 'admin@campus.edu', name: 'Dean of Campus Governance', desc: 'Dean (Admin)' }
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={googleLoading}
                  onClick={() => handleGoogleAccountSelect(acc.email)}
                  className="w-full flex items-center space-x-3 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900 transition-all text-left cursor-pointer group"
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {acc.name.charAt(0)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <span className="block text-xs font-bold text-white truncate">{acc.name}</span>
                    <span className="block text-[10px] text-zinc-400 truncate">{acc.email}</span>
                  </div>
                  <span className="text-[9px] font-bold font-mono text-zinc-500 uppercase group-hover:text-indigo-400 transition-colors">
                    {acc.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Use another account option */}
            <div className="pt-2 border-t border-zinc-805">
              {showCustomGoogleInput ? (
                <div className="space-y-2">
                  <label htmlFor="custom-google-email" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Enter Google Email
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="custom-google-email"
                      type="email"
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="user@campus.edu"
                      className="flex-1 px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={googleLoading || !customGoogleEmail.trim()}
                      onClick={() => handleGoogleAccountSelect(customGoogleEmail)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold rounded-lg text-white cursor-pointer transition-all"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomGoogleInput(true)}
                  className="w-full text-center text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline py-1.5 cursor-pointer"
                >
                  Use another Google account
                </button>
              )}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => {
                setGoogleModalOpen(false);
                setGoogleError(null);
                setShowCustomGoogleInput(false);
                setCustomGoogleEmail('');
              }}
              className="w-full py-2.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-400 hover:text-white cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
