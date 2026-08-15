'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LogOut, FileText, Plus, LayoutDashboard, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const isStudent = user.role === 'student';
  const isAdmin = user.role === 'admin' || user.role === 'department_head';

  const navLinks = [
    ...(isStudent
      ? [
          { href: '/dashboard', label: 'My Grievances', icon: FileText },
          { href: '/submit', label: 'File Grievance', icon: Plus },
        ]
      : []),
    ...(isAdmin
      ? [
          { 
            href: '/admin', 
            label: user.role === 'admin' ? "Dean's Desk" : 'Dept Desk', 
            icon: LayoutDashboard 
          },
        ]
      : []),
  ];

  return (
    <nav className="w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-50 transition-colors">
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="flex items-center justify-between h-18">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <Link href={isStudent ? '/dashboard' : '/admin'} className="flex items-center space-x-3 group">
              <div className="h-11 w-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md group-hover:border-blue-500/40 transition-all">
                <Image src="/icon.png" alt="CampusBridge Logo" width={44} height={44} className="object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-100 block group-hover:text-blue-400 transition-colors">
                  CampusBridge
                </span>
                <span className="text-[11px] text-slate-400 font-mono tracking-wider uppercase -mt-0.5">
                  Redressal Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-2.5 px-4.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Desktop User Info & Sign Out */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-3 bg-slate-900/60 border border-white/[0.08] px-4 py-2 rounded-xl">
              <div className="h-8.5 w-8.5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-sm shadow-inner">
                {user.full_name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-200">{user.full_name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wide">
                    {user.role === 'admin' ? 'System Admin' : user.role === 'department_head' ? 'Dept Head' : 'Student'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center justify-center h-10 w-10 bg-slate-900/60 border border-white/[0.08] hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-white/[0.08] focus:outline-none"
              aria-label="Toggle main menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-t border-zinc-900">
          <div className="px-3 pt-2 pb-3 space-y-1 sm:px-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl text-lg font-bold transition-all ${
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                  }`}
                >
                  <Icon className="h-5.5 w-5.5 text-indigo-400" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Profile & Sign Out info */}
          <div className="pt-4 pb-3 border-t border-zinc-900 px-4">
            <div className="flex items-center space-x-3 bg-zinc-900/20 p-3 rounded-xl border border-zinc-900">
              <div className="h-11 w-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-sm">
                {user.full_name.charAt(0)}
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-base font-extrabold text-white truncate">{user.full_name}</span>
                <span className="text-xs text-zinc-400 truncate">{user.email}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold font-mono text-zinc-400 uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    {user.role === 'admin' ? 'Admin' : user.role === 'department_head' ? 'Dept Head' : 'Student'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="mt-3 flex items-center justify-center space-x-2 w-full py-3.5 bg-zinc-900 border border-zinc-800 hover:border-rose-500/20 hover:bg-rose-500/5 text-base font-semibold text-zinc-300 hover:text-rose-400 rounded-xl transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
