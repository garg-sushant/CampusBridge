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
      <header className="w-full px-6 md:px-12 lg:px-16 py-6 flex items-center justify-between border-b border-zinc-900 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="h-11 w-11 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-sm">
            <Image src="/icon.png" alt="CampusBridge Logo" width={44} height={44} className="object-cover" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-zinc-100 block">
              CampusBridge
            </span>
            <span className="block text-xs text-zinc-400 font-mono tracking-widest uppercase -mt-0.5">
              Governance Hub
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all duration-200"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 md:px-12 lg:px-16 py-16 flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10 my-auto">
        {/* Left: Text copy */}
        <div className="max-w-2xl flex flex-col space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold w-fit">
            <ShieldCheck
              className="h-4.5 w-4.5 text-indigo-500"
              aria-hidden="true"
            />
            <span>Institutional Grievance Redressal Platform</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none text-white">
            Smart Campus <br />
            <span className="text-indigo-400">Governance & Grievance</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
            Eliminate administrative delays. CampusBridge uses intelligent multi-agent
            workflows, automated policy matching, and multimodal verification to
            route, evaluate, and resolve campus issues transparently and officially.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-base font-bold text-white shadow-sm transition-all duration-200 group"
            >
              <span>Student Grievance Portal</span>
              <ArrowRight
                className="h-5 w-5 transform group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-base font-semibold text-zinc-200 transition-all duration-200"
            >
              <LayoutDashboard
                className="h-5 w-5 text-indigo-400"
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
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Image src="/icon.png" alt="CampusBridge Logo" width={24} height={24} className="object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Official Routing & Classification
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Intelligent routing workflows instantly triage, categorize, and assign
                  submissions to Canteen, IT, Canteen, or Hostel administration departments.
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
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Evidence Verification Pipeline
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Computer vision algorithms cross-validate uploaded photographs
                  against reported issue descriptions, eliminating fake
                  submissions.
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
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Grounded Timeline Audit Log
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  A transparent step-by-step grievance resolution audit trail
                  with RAG-driven policy citations and internal notes.
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
