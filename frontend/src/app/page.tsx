"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden bg-zinc-950">
      {/* Header */}
      <header className="w-full px-6 md:px-12 lg:px-16 py-5 flex items-center justify-between border-b border-white/[0.08] relative z-10 bg-[#0b0f17]/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="h-11 w-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md">
            <Image src="/icon.png" alt="CampusBridge Logo" width={44} height={44} className="object-cover" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-100 block">
              CampusBridge
            </span>
            <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase -mt-0.5">
              Governance Hub
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 transition-all duration-200"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 md:px-12 lg:px-16 py-16 flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10 my-auto">
        {/* Left: Text copy */}
        <div className="max-w-2xl flex flex-col space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/25 text-blue-300 text-xs font-semibold w-fit">
            <ShieldCheck
              className="h-4 w-4 text-blue-400"
              aria-hidden="true"
            />
            <span>Institutional Grievance Redressal Platform</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Smart Campus <br />
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-blue-200 bg-clip-text text-transparent">
              Governance & Redressal
            </span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed">
            Eliminate administrative bottlenecks. CampusBridge pairs multi-agent
            credibility audits with automated policy routing to verify, triage, and resolve campus issues transparently and reliably.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 group"
            >
              <span>Student Grievance Portal</span>
              <ArrowRight
                className="h-4.5 w-4.5 transform group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/[0.09] text-sm font-bold text-slate-200 transition-all duration-200 shadow-md"
            >
              <LayoutDashboard
                className="h-4.5 w-4.5 text-blue-400"
                aria-hidden="true"
              />
              <span>Administrative Console</span>
            </Link>
          </div>
        </div>

        {/* Right: Glassmorphic Features Preview Panel */}
        <div className="w-full lg:max-w-md flex flex-col space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-panel p-6 rounded-2xl relative overflow-hidden"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                <Image src="/icon.png" alt="CampusBridge Logo" width={24} height={24} className="object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Official Routing & Triage
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Automated routing workflows instantly categorize and assign
                  submissions to IT, Hostel, Electrical, Water, or Academic desks.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-panel p-6 rounded-2xl relative overflow-hidden"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  3-Tier Credibility Auditing
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Multi-agent evaluation grades evidence authenticity, requesting additional documentation when needed and auto-routing verified claims.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-panel p-6 rounded-2xl relative overflow-hidden"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Transparent Public Audit Trail
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Every status change, staff action, and resolution milestone is recorded in a clear chronological timeline with realtime updates.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 py-6 px-6 text-center text-xs text-zinc-500 relative z-10">
        © 2026 CampusBridge. Designed for modern institutional workflows.
      </footer>
    </div>
  );
}
