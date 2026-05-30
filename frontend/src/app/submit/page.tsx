'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Department, Complaint } from '@/types';
import { 
  ArrowLeft, Send, UploadCloud, X, CheckCircle2, 
  MapPin, AlertCircle, FileCheck, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';

export default function SubmitComplaint() {
  const { user, loading: authLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [step, setStep] = useState(1); // 1: Info Form, 2: Upload Files, 3: Success Screen
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load departments
  useEffect(() => {
    async function loadDepts() {
      try {
        const data = await api.get<Department[]>('/departments');
        if (data && data.length > 0) {
          setDepartments(data);
        } else {
          setDepartments([
            { id: 1, name: 'Hostel Administration', code: 'HOSTEL', created_at: '' },
            { id: 2, name: 'WiFi/IT Services', code: 'IT', created_at: '' },
            { id: 3, name: 'Electrical Maintenance', code: 'ELECTRICAL', created_at: '' },
            { id: 4, name: 'Water & Sanitation', code: 'WATER', created_at: '' }
          ]);
        }
      } catch (err) {
        console.error('Failed to load departments', err);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      // Validate types
      const invalid = selected.filter(f => !f.type.startsWith('image/') && f.type !== 'application/pdf');
      if (invalid.length > 0) {
        setFormError('Only images and PDF files are supported.');
        return;
      }
      setFormError(null);
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleNextStep = () => {
    setFormError(null);
    if (!title || !description || !category || !location) {
      setFormError('Please fill in all details before proceeding.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setFormError(null);
    try {
      // 1. Submit complaint metadata
      const complaintData = await api.post<Complaint>('/complaints/submit', {
        title,
        description,
        category,
        location
      });

      // 2. Submit files if present
      if (files.length > 0) {
        await api.upload(complaintData.id, files);
      }

      setStep(3);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to submit grievance. Please try again.';
      setFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-12 w-12 text-indigo-400 mb-4" />
        <h3 className="text-xl font-bold text-white">Unauthorized Access</h3>
        <p className="text-sm text-neutral-400 mt-1 mb-4">Please log in to submit a grievance.</p>
        <Link href="/login" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-all">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white relative">
      <Navbar />
      
      {/* Header bar */}
      <header className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-5 flex items-center justify-between border-b border-zinc-900 relative z-10">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" aria-label="Back to Student Portal" title="Back to Student Portal" className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">
            <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </Link>
          <div>
            <span className="font-bold text-lg text-white block tracking-tight">File a New Grievance</span>
            <span className="block text-xs text-zinc-400 font-medium">Step {step} of 3</span>
          </div>
        </div>
        <div className="text-xs text-zinc-400 font-semibold font-mono tracking-wider bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full shadow-sm">
          STUDENT PORTAL
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 relative z-10 max-w-3xl w-full mx-auto">
        <div className="w-full">
          <AnimatePresence mode="wait">
            {/* STEP 1: Description Form */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="glass-panel p-8 rounded-2xl border border-white/5 space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-white tracking-tight">Grievance Details</h3>
                  <p className="text-sm text-neutral-400">Describe the issue clearly. The system will analyze the details for automatic categorization.</p>
                </div>

                {formError && (
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm" role="alert">
                    <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-5">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label htmlFor="submit-title" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Issue Summary (Title)
                    </label>
                    <input
                      id="submit-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. WiFi outage in Block B Hostel rooms"
                      aria-required="true"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white placeholder-neutral-500"
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1.5">
                    <label htmlFor="submit-category" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      id="submit-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      aria-required="true"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white bg-neutral-950"
                    >
                      <option value="" disabled className="text-neutral-500">
                        Select grievance type...
                      </option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name} className="bg-neutral-950">
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location */}
                  <div className="space-y-1.5">
                    <label htmlFor="submit-location" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
                      <input
                        id="submit-location"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Hostel Block B, Floor 2 rest room"
                        aria-required="true"
                        className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-neutral-500"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label htmlFor="submit-description" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Detailed Description
                    </label>
                    <textarea
                      id="submit-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      placeholder="Please provide full details, including dates, names, or impact of the problem..."
                      aria-required="true"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white placeholder-neutral-500 resize-none"
                    />
                  </div>
                </div>

                {/* Submit & Next */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleNextStep}
                    title="Proceed to Evidence"
                    className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-sm transition-all duration-200"
                  >
                    <span>Proceed to Evidence</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: File Evidence Upload */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="glass-panel p-8 rounded-2xl border border-white/5 space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Upload Evidence</h3>
                  <p className="text-xs text-neutral-400">Photos help administrators verify details instantly and speed up resolutions.</p>
                </div>

                {formError && (
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm" role="alert">
                    <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Upload drag drop box */}
                <div className="relative border-2 border-dashed border-zinc-800 hover:border-indigo-500 rounded-2xl p-8 text-center bg-zinc-900/50 hover:bg-zinc-905 transition-all cursor-pointer group shadow-sm">
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    aria-label="Upload evidence files (images or PDFs)"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="h-10 w-10 text-zinc-500 group-hover:text-indigo-400 mx-auto mb-3 transition-colors" aria-hidden="true" />
                  <span className="block text-sm font-bold text-white">Click or Drag images / PDFs to upload</span>
                  <span className="block text-[10px] text-zinc-500 mt-1">Supports PNG, JPG, JPEG, PDF up to 10MB</span>
                </div>

                {/* Uploaded File Previews */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Selected Evidence Files</span>
                    <div className="grid grid-cols-1 gap-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 border border-white/5">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <FileCheck className="h-5 w-5 text-indigo-400 shrink-0" aria-hidden="true" />
                            <div className="overflow-hidden">
                              <span className="block text-xs font-bold text-white truncate">{file.name}</span>
                              <span className="block text-[10px] text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            aria-label={`Remove uploaded file ${file.name}`}
                            title="Remove file"
                            className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notice element */}
                <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs shadow-sm">
                  <Info className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
                  <p className="leading-relaxed">
                    <strong>Integrity Policy:</strong> Aegis evaluates uploaded files using AI models. Uploading irrelevant or spam images will impact your student trust score rating.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    title="Back to Form"
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 font-semibold text-zinc-300 text-sm transition-all duration-200"
                  >
                    Back to Form
                  </button>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    title="File Grievance"
                    className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-905 disabled:text-zinc-500 font-semibold text-white shadow-sm transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Grievance...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        <span>File Grievance</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Success Screen */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-8 rounded-2xl border border-white/5 text-center space-y-6"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Grievance Submitted</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
                    Your grievance has been successfully registered. The Aegis system will now automatically evaluate your descriptions and route it to the appropriate department.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Link
                    href="/dashboard"
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg transition-all text-sm"
                  >
                    Go to Portal Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setTitle('');
                      setDescription('');
                      setCategory('');
                      setLocation('');
                      setFiles([]);
                      setStep(1);
                    }}
                    className="px-6 py-3 rounded-xl bg-neutral-900 border border-white/5 hover:bg-neutral-800 font-semibold text-white transition-all text-sm"
                  >
                    Submit Another Grievance
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
