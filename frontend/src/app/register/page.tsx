'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, User, UserCheck, Briefcase, AlertCircle } from 'lucide-react';
import { Department } from '@/types';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const { register, loading, error } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'department_head'>('student');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch departments live from API
  useEffect(() => {
    async function loadDepts() {
      try {
        const data = await api.get<Department[]>('/departments');
        setDepartments(data);
      } catch (err) {
        console.error('Failed to load departments', err);
        // Fallback standard departments in case of absolute local offline boot
        setDepartments([
          { id: 1, name: 'Hostel Administration', code: 'HOSTEL', created_at: '' },
          { id: 2, name: 'WiFi/IT Services', code: 'IT', created_at: '' },
          { id: 3, name: 'Electrical Maintenance', code: 'ELECTRICAL', created_at: '' },
          { id: 4, name: 'Water & Sanitation', code: 'WATER', created_at: '' }
        ]);
      }
    }
    loadDepts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName || !email || !password) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (role === 'department_head' && !departmentId) {
      setFormError('Please select your assigned department.');
      return;
    }

    try {
      await register(
        email, 
        fullName, 
        password, 
        role, 
        role === 'department_head' ? (departmentId as number) : undefined
      );
    } catch {}
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4 py-8">
      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 mb-6">
          <div className="h-14 w-14 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
            <Image src="/icon.png" alt="CampusBridge Logo" width={56} height={56} className="object-cover" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Create CampusBridge Account</h2>
          <p className="text-sm text-zinc-400">Join the Campus Governance Hub</p>
        </div>

        {/* Form Container */}
        <div className="glass-panel p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error notifications */}
            {(error || formError) && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Role Toggle Selector */}
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Join CampusBridge as a...
              </span>
              <div 
                className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800"
                role="radiogroup"
                aria-label="Registration Role Selector"
              >
                <button
                  type="button"
                  onClick={() => { setRole('student'); setFormError(null); }}
                  role="radio"
                  aria-checked={role === 'student'}
                  tabIndex={role === 'student' ? 0 : -1}
                  className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    role === 'student'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('department_head'); setFormError(null); }}
                  role="radio"
                  aria-checked={role === 'department_head'}
                  tabIndex={role === 'department_head' ? 0 : -1}
                  className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    role === 'department_head'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Dept Staff
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="register-fullname" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" aria-hidden="true" />
                <input
                  id="register-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Amit Patel"
                  aria-required="true"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Campus Email */}
            <div className="space-y-1">
              <label htmlFor="register-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Campus Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" aria-hidden="true" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@campus.edu"
                  aria-required="true"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Department Selection (Conditional on Department Head Role) */}
            {role === 'department_head' && (
              <div className="space-y-1">
                <label htmlFor="register-dept" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Assigned Department
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500 pointer-events-none" aria-hidden="true" />
                  <select
                    id="register-dept"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(Number(e.target.value))}
                    aria-required="true"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white bg-neutral-950 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="text-neutral-500">
                      Select Department...
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id} className="bg-neutral-950 text-white">
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="register-password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Create Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" aria-hidden="true" />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-required="true"
                  aria-describedby="password-help"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-white placeholder-neutral-500 transition-all duration-300"
                />
              </div>
              <span id="password-help" className="block text-[10px] text-zinc-500 mt-1">
                Password must be at least 6 characters.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-neutral-400 font-bold text-white shadow-sm transition-all duration-200 mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Login Redirect */}
          <div className="mt-5 text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-indigo-400 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
