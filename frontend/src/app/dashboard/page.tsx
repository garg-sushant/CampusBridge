'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api, getBackendMediaUrl } from '@/lib/api';
import { Complaint, Comment } from '@/types';
import Navbar from '@/components/Navbar';
import { 
  Plus, Search, Filter, CheckCircle2, AlertTriangle, 
  MapPin, HelpCircle, FileText, Send, ChevronRight, X, Image as ImageIcon
} from 'lucide-react';

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // States for Additional Information submission (30-60 score range)
  const [additionalText, setAdditionalText] = useState('');
  const [additionalFile, setAdditionalFile] = useState<File | null>(null);
  const [infoSubmitting, setInfoSubmitting] = useState(false);
  const [infoSubmitSuccess, setInfoSubmitSuccess] = useState<string | null>(null);
  const [infoSubmitError, setInfoSubmitError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  // Filter out automated system/AI logs to preserve clean human-to-human timeline
  const cleanConversationComments = comments.filter(c => {
    if (c.is_ai_generated) return false;
    const content = c.content || '';
    if (
      content.startsWith('Administrative Action:') ||
      content.startsWith('System Action:') ||
      content.startsWith('Grievance filed successfully') ||
      content.startsWith('Evidence uploaded:') ||
      content.includes('AI Orchestrator') ||
      content.includes('AI Evidence Verifier')
    ) {
      return false;
    }
    return true;
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch complaints
  const loadComplaints = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      let path = '/complaints?';
      if (statusFilter) path += `status=${statusFilter}&`;
      if (debouncedSearch) path += `search=${encodeURIComponent(debouncedSearch)}&`;
      const data = await api.get<Complaint[]>(path);
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load grievances', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    let isMounted = true;
    if (user) {
      (async () => {
        if (isMounted) await loadComplaints(true);
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [user, loadComplaints]);

  // Fetch single complaint details including comments
  const loadSelectedDetails = useCallback(async (complaintId: string, showLoading = false) => {
    if (showLoading) setDetailLoading(true);
    try {
      const detailed = await api.get<Complaint>(`/complaints/${complaintId}`);
      setSelectedComplaint(detailed);
      setComments(detailed.comments || []);
    } catch (err) {
      console.error('Failed to fetch detailed grievance details', err);
    } finally {
      if (showLoading) setDetailLoading(false);
    }
  }, []);

  const handleSelectComplaint = (complaint: Complaint) => {
    loadSelectedDetails(complaint.id, true);
  };

  // Polling for real-time updates (syncs dashboard and open timeline drawer)
  useEffect(() => {
    if (!user) return;
    const complaintId = selectedComplaint?.id;
    const interval = setInterval(() => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      loadComplaints(false);
      if (complaintId) {
        loadSelectedDetails(complaintId, false);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [user, loadComplaints, selectedComplaint?.id, loadSelectedDetails]);


  // Submit a public comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedComplaint) return;
    setCommentLoading(true);
    try {
      const added = await api.post<Comment>(`/complaints/${selectedComplaint.id}/comment`, {
        content: newComment,
        is_internal: false
      });
      
      // Instantly inject comment into screen
      const userObj = user ? { id: user.id, email: user.email, full_name: user.full_name, role: user.role, trust_score: user.trust_score, department_id: user.department_id, created_at: user.created_at } : null;
      setComments(prev => [...prev, { ...added, user: userObj }]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to submit comment', err);
    } finally {
      setCommentLoading(false);
    }
  };

  // Submit additional information/documents requested by AI (30-60 score range)
  const handleProvideAdditionalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!additionalText.trim() && !additionalFile) {
      setInfoSubmitError('Please provide text details or select a document/image to upload.');
      return;
    }
    setInfoSubmitting(true);
    setInfoSubmitError(null);
    setInfoSubmitSuccess(null);

    try {
      const formData = new FormData();
      if (additionalText.trim()) {
        formData.append('additional_info', additionalText.trim());
      }
      if (additionalFile) {
        formData.append('file', additionalFile);
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/complaints/${selectedComplaint.id}/provide-info`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to submit additional information.');
      }

      const updatedComplaint: Complaint = await res.json();
      setSelectedComplaint(updatedComplaint);
      setAdditionalText('');
      setAdditionalFile(null);
      setInfoSubmitSuccess(
        updatedComplaint.status === 'verified' 
          ? '✓ Information and evidence verified! Grievance accepted and routed directly to department.' 
          : '✓ Additional information submitted and reassessed.'
      );
      loadComplaints(false);
      loadSelectedDetails(selectedComplaint.id, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting additional information.';
      setInfoSubmitError(msg);
    } finally {
      setInfoSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center text-center px-4">
        <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" aria-hidden="true" />
        <h3 className="text-xl font-bold text-white">Access Denied</h3>
        <p className="text-sm text-slate-400 mt-1 mb-4">
          {!user ? 'Please sign in to access your portal.' : 'This student portal is restricted to student accounts only.'}
        </p>
        <Link href="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-all shadow-md">
          {!user ? 'Sign In' : 'Go Back'}
        </Link>
      </div>
    );
  }

  // Calculate student counters
  const filedCount = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-white relative">
      <Navbar />

      {/* Main Page Area */}
      <main className="flex-1 z-10 pb-16">
        {/* Dashboard Grid */}
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8 space-y-8 w-full mx-auto">
          {/* Headline Title */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">Student Portal</h1>
              <p className="text-slate-400 text-sm mt-1">Track and manage your filed campus complaints transparently.</p>
            </div>
            <Link href="/submit" className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all duration-200">
              <Plus className="h-4.5 w-4.5" aria-hidden="true" />
              <span>Submit Grievance</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Filed count */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Filed Grievances</span>
                <span className="text-3xl font-extrabold mt-1 block text-slate-100">{filedCount}</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl shadow-inner">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            {/* Resolved count */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Resolved Issues</span>
                <span className="text-3xl font-extrabold mt-1 block text-emerald-400">{resolvedCount}</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 text-emerald-400 rounded-xl shadow-inner">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            {/* Circular Gauge Trust Score */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Trust Integrity Score</span>
                <span className="text-3xl font-extrabold block text-blue-400">{user.trust_score.toFixed(1)}%</span>
                <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full inline-block ${
                  user.trust_score >= 90 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {user.trust_score >= 90 ? 'High Credibility' : 'Standard Rating'}
                </span>
              </div>
              
              {/* SVG circular progress */}
              <div className="relative h-16 w-16">
                <svg className="h-full w-full transform -rotate-90" role="img" aria-label={`Integrity Trust rating dial showing ${user.trust_score.toFixed(1)}%`}>
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#1e293b" strokeWidth="4" />
                  <circle 
                    cx="32" 
                    cy="32" 
                    r="28" 
                    fill="transparent" 
                    stroke="#3b82f6" 
                    strokeWidth="4" 
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={(2 * Math.PI * 28) * (1 - user.trust_score / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-200">
                  {user.trust_score.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          {/* Grievance Tracker explorer */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">My Grievance Submissions</h3>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <label htmlFor="search-input" className="sr-only">Search grievances</label>
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
                <input
                  id="search-input"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search grievances by title, location, or description..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm placeholder-neutral-500 focus:outline-none"
                />
              </div>

              {/* Filter */}
              <div className="relative min-w-48">
                <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" aria-hidden="true" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter grievances by status"
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm bg-neutral-950 appearance-none cursor-pointer focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="pending_info">Pending Additional Info</option>
                  <option value="verified">Verified</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="glass-panel p-12 rounded-2xl flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : complaints.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
                <HelpCircle className="h-10 w-10 text-neutral-600 mx-auto" aria-hidden="true" />
                <p className="text-neutral-400 text-sm">No grievances found matching the filters.</p>
                <Link href="/submit" className="text-indigo-400 text-sm font-semibold hover:underline">
                  Submit your first grievance here
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {complaints.map((c) => {
                  const isSelected = selectedComplaint?.id === c.id;
                  const isPendingInfo = c.status === 'pending_info';
                  return (
                    <div 
                      key={c.id}
                      onClick={() => handleSelectComplaint(c)}
                      className={`glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-blue-500/40 hover:bg-slate-900/60 transition-all ${
                        isPendingInfo ? 'border-amber-500/40 bg-amber-950/15' : ''
                      } ${
                        isSelected ? 'border-blue-500 bg-slate-900/80 shadow-lg shadow-blue-500/10' : ''
                      }`}
                    >
                      <div className="space-y-2.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                            c.status === 'resolved' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                            c.status === 'rejected' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' :
                            c.status === 'pending_info' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold shadow-sm' :
                            c.status === 'in_progress' ? 'bg-sky-500/15 border border-sky-500/30 text-sky-400' :
                            'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                          }`}>
                            {c.status === 'pending_info' && <AlertTriangle className="h-3 w-3 text-amber-400" aria-hidden="true" />}
                            {c.status === 'pending_info' ? 'Action Required: Info Needed' : c.status.replace('_', ' ')}
                          </span>
                          
                          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                            c.urgency === 'critical' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 font-extrabold' :
                            c.urgency === 'high' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300' :
                            c.urgency === 'medium' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                            'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                          }`}>
                            {c.urgency} urgency
                          </span>

                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-lg text-slate-100 tracking-tight">{c.title}</h4>
                        <p className="text-slate-300 text-sm line-clamp-2 leading-relaxed">{c.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1.5">
                          <span className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            <span>{c.location}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span>Dept: {c.department?.name || 'Assessing...'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-400 group-hover:text-blue-400">
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right Drawer: Complaint Audit Stepper & Details */}
      {selectedComplaint && (
        <aside className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-[#0e131f] border-l border-white/[0.08] shadow-2xl flex flex-col z-50 animate-slide-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.08] bg-[#0b0f17]">
            <div>
              <span className="block text-xs font-mono text-blue-400 font-semibold tracking-wider">GRIEVANCE TIMELINE & AUDIT</span>
              <span className="font-bold text-sm truncate max-w-64 block text-slate-100 mt-1">{selectedComplaint.title}</span>
            </div>
            <button 
              onClick={() => setSelectedComplaint(null)} 
              aria-label="Close detailed timeline drawer"
              title="Close detailed timeline drawer"
              className="p-2 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-400 hover:text-white transition-all"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Drawer Body (Timeline Stepper) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {detailLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Stepper progress indicator */}
                <div className="space-y-4">
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Resolution Status Tracker</span>
                  <div className="grid grid-cols-5 gap-1.5 pt-1.5">
                    {['submitted', 'verified', 'assigned', 'in_progress', 'resolved'].map((step, idx, arr) => {
                      const statuses = ['submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected'];
                      const currentIdx = statuses.indexOf(selectedComplaint.status);
                      const isCompleted = currentIdx >= idx && selectedComplaint.status !== 'rejected';
                      const isRejected = selectedComplaint.status === 'rejected' && idx === arr.length - 1;
                      
                      return (
                        <div key={step} className="flex flex-col items-center">
                           <div className={`h-2 w-full rounded-full ${
                            isRejected ? 'bg-rose-600' :
                            isCompleted ? 'bg-indigo-600' : 'bg-zinc-900'
                          }`} />
                          <span className="block text-[10px] font-bold font-mono uppercase text-neutral-400 mt-2.5 text-center whitespace-nowrap overflow-hidden max-w-full truncate">
                            {isRejected && idx === arr.length - 1 ? 'rejected' : step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence attachments */}
                {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
                  <div className="space-y-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Submitted Evidence & Proof ({selectedComplaint.attachments.length})
                    </span>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedComplaint.attachments.map((att) => {
                        const fullUrl = getBackendMediaUrl(att.file_url);
                        const isImg = att.file_type?.startsWith('image/') || att.file_url?.endsWith('.png') || att.file_url?.endsWith('.jpg') || att.file_url?.endsWith('.jpeg') || att.file_url?.endsWith('.webp') || att.file_url?.endsWith('.bmp') || att.file_url?.endsWith('.avif');
                        return (
                          <div key={att.id} className="glass-panel p-4.5 rounded-xl border border-white/[0.08] space-y-3">
                            <div className="flex items-center justify-between">
                              <a 
                                href={fullUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-2 text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <ImageIcon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                                <span className="font-semibold underline">Open Attachment Link</span>
                              </a>
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                                att.ai_verification_status === 'verified' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                                att.ai_verification_status === 'rejected' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' :
                                'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                              }`}>
                                AI Verification: {att.ai_verification_status}
                              </span>
                            </div>

                            {/* Inline Screenshot Thumbnail Preview */}
                            {isImg && (
                              brokenImages[att.id] ? (
                                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 h-28 flex flex-col items-center justify-center p-4 text-center space-y-1">
                                  <ImageIcon className="h-6 w-6 text-slate-500" />
                                  <span className="text-xs font-semibold text-slate-400">Attached File: {att.file_url.split('/').pop()}</span>
                                  <span className="text-[10px] text-slate-500">File verified & stored in system registry</span>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => setPreviewImageUrl(fullUrl)}
                                  className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer h-48 flex items-center justify-center"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img 
                                    src={fullUrl} 
                                    alt="Submitted Proof Screenshot" 
                                    onError={() => setBrokenImages(prev => ({ ...prev, [att.id]: true }))}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white font-bold text-xs shadow-md border border-white/10">
                                      Click to Expand Screenshot 🔍
                                    </span>
                                  </div>
                                </div>
                              )
                            )}

                            {att.ai_verification_explanation && (
                              <p className={`text-xs leading-relaxed pl-1 ${
                                att.ai_verification_status === 'rejected' ? 'text-rose-300' : 'text-slate-400'
                              }`}>
                                {att.ai_verification_explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interactive Section for Additional Information Requested by AI (30-60 score range) */}
                {selectedComplaint.status === 'pending_info' && (
                  <div className="glass-panel p-5 rounded-2xl border-2 border-amber-500/50 bg-amber-950/20 space-y-4 animate-slide-in shadow-xl shadow-amber-500/5">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                          Action Required • Additional Info Needed
                        </span>
                        <h4 className="text-sm font-extrabold text-white mt-0.5">
                          AI Triage Requirement (Score: 30–60 Range)
                        </h4>
                      </div>
                    </div>

                    {/* The exact prompt asked by AI */}
                    <div className="p-4 rounded-xl bg-black/70 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                      <span className="font-bold text-amber-300 block mb-1">Requested by AI Auditor:</span>
                      {selectedComplaint.info_requested || 'Please upload clear photo/document evidence of the reported problem and provide specific room/timing details to verify authenticity.'}
                    </div>

                    {infoSubmitSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
                        {infoSubmitSuccess}
                      </div>
                    )}

                    {infoSubmitError && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-medium">
                        {infoSubmitError}
                      </div>
                    )}

                    <form onSubmit={handleProvideAdditionalInfo} className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                          Provide Requested Details / Specifics
                        </label>
                        <textarea
                          rows={3}
                          value={additionalText}
                          onChange={(e) => setAdditionalText(e.target.value)}
                          placeholder="Type the specific details, room numbers, or clarifications requested above..."
                          className="w-full bg-zinc-900/90 border border-zinc-700 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                          Attach Requested Photo or Document (JPG, PNG, PDF)
                        </label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setAdditionalFile(e.target.files[0]);
                            }
                          }}
                          className="block w-full text-xs text-neutral-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-300 hover:file:bg-amber-500/30 cursor-pointer bg-zinc-900 border border-zinc-700 rounded-xl p-1.5"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={infoSubmitting}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20"
                      >
                        {infoSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Verifying & Submitting...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Submit Requested Info & Re-verify Grievance</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Description details */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Grievance Detail Description</span>
                  <div className="p-5 rounded-xl bg-neutral-900 border border-zinc-800 leading-relaxed text-sm text-neutral-200 whitespace-pre-wrap">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Clean Conversation & Updates timeline */}
                <div className="space-y-4">
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Grievance Conversation & Updates</span>
                  <div className="relative border-l border-zinc-800 pl-5 ml-2.5 space-y-5">
                    {/* Student's Initial Submission Event comes first */}
                    <div className="relative space-y-1.5 animate-slide-in">
                      <div className="absolute left-[-22.5px] top-1.5 h-3.5 w-3.5 rounded-full bg-indigo-500 border-2 border-zinc-950 shadow-[0_0_8px_#4f46e5]" />
                      
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-neutral-200">{selectedComplaint.student?.full_name || 'Student'}</span>
                          <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                            INITIAL SUBMISSION
                          </span>
                        </div>
                        <span className="font-mono text-neutral-500 text-xs">
                          {new Date(selectedComplaint.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      
                      <div className="text-xs text-neutral-300 leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-zinc-800 text-[9px] font-mono font-semibold uppercase rounded-bl border-l border-b border-zinc-700 text-zinc-400">
                          {selectedComplaint.location}
                        </div>
                        <h5 className="font-bold text-white text-sm pr-20">{selectedComplaint.title}</h5>
                        <p className="whitespace-pre-wrap text-zinc-300 text-xs pt-1">{selectedComplaint.description}</p>
                      </div>
                    </div>

                    {/* Subsequent Human Updates & Chats */}
                    {cleanConversationComments.map((comm) => (
                      <div key={comm.id} className="relative space-y-1.5 animate-slide-in">
                        <div className="absolute left-[-22.5px] top-1.5 h-3.5 w-3.5 rounded-full bg-neutral-950 border-2 border-indigo-500" />
                        
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span className="font-bold text-neutral-200">
                            {comm.user ? comm.user.full_name : 'Staff'}
                          </span>
                          <span className="font-mono text-neutral-500 text-xs">
                            {new Date(comm.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        
                        <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-900/50 p-3 rounded-xl border border-zinc-800">
                          {comm.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Comment Submission footer */}
          <div className="p-5 border-t border-white/[0.08] bg-[#0b0f17]">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <label htmlFor="new-comment" className="sr-only">New comment</label>
              <input
                id="new-comment"
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Post a public progress comment..."
                className="flex-1 px-4 py-3 rounded-xl glass-input text-sm placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={commentLoading || !newComment.trim()}
                aria-label="Send public progress comment"
                title="Send public progress comment"
                className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-lg transition-all"
              >
                {commentLoading ? (
                  <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4.5 w-4.5" aria-hidden="true" />
                )}
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* Image Full-Size Modal Preview */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 p-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white hover:bg-black transition-colors z-10"
              aria-label="Close screenshot preview"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={previewImageUrl} 
              alt="Expanded Proof Evidence Preview" 
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
