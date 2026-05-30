'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Complaint, Comment } from '@/types';
import Navbar from '@/components/Navbar';
import { 
  Plus, Search, Filter, LogOut, CheckCircle2, AlertTriangle, 
  MapPin, HelpCircle, FileText, Send, ChevronRight, X, Image as ImageIcon
} from 'lucide-react';

export default function StudentDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch complaints
  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      let path = '/complaints?';
      if (statusFilter) path += `status=${statusFilter}&`;
      if (search) path += `search=${encodeURIComponent(search)}&`;
      const data = await api.get<Complaint[]>(path);
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load grievances', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await Promise.resolve();
      if (!active) return;
      if (user) {
        loadComplaints();
      }
    };
    run();
    return () => {
      active = false;
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
    const interval = setInterval(() => {
      loadComplaints();
      if (selectedComplaint) {
        loadSelectedDetails(selectedComplaint.id, false);
      }
    }, 5000);
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
        <AlertTriangle className="h-12 w-12 text-indigo-400 mb-4" aria-hidden="true" />
        <h3 className="text-xl font-bold text-white">Unauthorized Access</h3>
        <p className="text-sm text-neutral-400 mt-1 mb-4">Please log in to access your dashboard.</p>
        <Link href="/login" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-all">
          Sign In
        </Link>
      </div>
    );
  }

  // Calculate student counters
  const filedCount = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white relative">
      <Navbar />

      {/* Main Page Area */}
      <main className="flex-1 z-10 bg-zinc-950 pb-16">
        {/* Dashboard Grid */}
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8 space-y-8 w-full mx-auto">
          {/* Headline Title */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Student Portal</h1>
              <p className="text-zinc-400 text-sm mt-1">Track and manage your filed campus complaints transparently.</p>
            </div>
            <Link href="/submit" className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white shadow-sm hover:shadow-md transition-all duration-200">
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>Submit Grievance</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Filed count */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filed Grievances</span>
                <span className="text-3xl font-extrabold mt-1 block">{filedCount}</span>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-xl shadow-sm">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            {/* Resolved count */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Resolved Issues</span>
                <span className="text-3xl font-extrabold mt-1 block text-emerald-400">{resolvedCount}</span>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-800 text-emerald-400 rounded-xl shadow-sm">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            {/* Circular Gauge Trust Score */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Trust Integrity Score</span>
                <span className="text-3xl font-extrabold block text-indigo-400">{user.trust_score.toFixed(1)}%</span>
                <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full inline-block ${
                  user.trust_score >= 90 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                }`}>
                  {user.trust_score >= 90 ? 'High Credibility' : 'Standard Rating'}
                </span>
              </div>
              
              {/* SVG circular progress */}
              <div className="relative h-16 w-16">
                <svg className="h-full w-full transform -rotate-90" role="img" aria-label={`Integrity Trust rating dial showing ${user.trust_score.toFixed(1)}%`}>
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#18181b" strokeWidth="4" />
                  <circle 
                    cx="32" 
                    cy="32" 
                    r="28" 
                    fill="transparent" 
                    stroke="#4f46e5" 
                    strokeWidth="4" 
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={(2 * Math.PI * 28) * (1 - user.trust_score / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-zinc-300">
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
                  return (
                    <div 
                      key={c.id}
                      onClick={() => handleSelectComplaint(c)}
                      className={`glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-indigo-500/40 hover:bg-neutral-900/40 transition-all ${
                        isSelected ? 'border-indigo-500 bg-neutral-900/60 shadow-lg shadow-indigo-500/5' : ''
                      }`}
                    >
                      <div className="space-y-2.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                            c.status === 'resolved' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                            c.status === 'rejected' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                            c.status === 'in_progress' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                            'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                          }`}>
                            {c.status.replace('_', ' ')}
                          </span>
                          
                          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                            c.urgency === 'critical' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                            c.urgency === 'high' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300' :
                            c.urgency === 'medium' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                            'bg-neutral-800 text-neutral-400'
                          }`}>
                            {c.urgency} urgency
                          </span>

                          <span className="text-xs text-neutral-400 font-mono">
                            {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-lg text-white tracking-tight">{c.title}</h4>
                        <p className="text-neutral-300 text-sm line-clamp-2 leading-relaxed">{c.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-neutral-400 pt-1.5">
                          <span className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                            <span>{c.location}</span>
                          </span>
                          <span className="text-neutral-700">•</span>
                          <span>Dept: {c.department?.name || 'Assessing...'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400">
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
      </main>      {/* Right Drawer: Complaint Audit Stepper & Details */}
      {selectedComplaint && (
        <aside className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col z-50 animate-slide-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-950">
            <div>
              <span className="block text-xs font-mono text-indigo-400 font-semibold tracking-wider">GRIEVANCE TIMELINE & AUDIT</span>
              <span className="font-bold text-sm truncate max-w-64 block text-white mt-1">{selectedComplaint.title}</span>
            </div>
            <button 
              onClick={() => setSelectedComplaint(null)} 
              aria-label="Close detailed timeline drawer"
              title="Close detailed timeline drawer"
              className="p-2 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white transition-all"
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
                    <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Submitted Evidence</span>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedComplaint.attachments.map((att) => (
                        <div key={att.id} className="glass-panel p-4.5 rounded-xl border border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <a 
                              href={`http://localhost:8000${att.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-2 text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <ImageIcon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                              <span className="font-semibold underline">View Attachment File</span>
                            </a>
                            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                              att.ai_verification_status === 'verified' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                              att.ai_verification_status === 'rejected' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                              'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                            }`}>
                              System Verification: {att.ai_verification_status}
                            </span>
                          </div>
                          {att.ai_verification_explanation && (
                            <p className={`text-xs leading-relaxed pl-1 ${
                              att.ai_verification_status === 'rejected' ? 'text-rose-300' : 'text-neutral-400'
                            }`}>
                              {att.ai_verification_explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description details */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Grievance Detail Description</span>
                  <div className="p-5 rounded-xl bg-neutral-900 border border-zinc-800 leading-relaxed text-sm text-neutral-200 whitespace-pre-wrap">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Comment Timeline Events */}
                <div className="space-y-4">
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Resolution Audit Timeline</span>
                  <div className="relative border-l border-zinc-800 pl-5 ml-2.5 space-y-5">
                    {comments.map((comm) => (
                      <div key={comm.id} className="relative space-y-1.5">
                        {/* Dot marker */}
                        <div className="absolute left-[-22.5px] top-1.5 h-3.5 w-3.5 rounded-full bg-neutral-950 border-2 border-indigo-500" />
                        
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span className="font-bold text-neutral-200">
                            {comm.user ? comm.user.full_name : 'System Auditor'}
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
          <div className="p-5 border-t border-zinc-900 bg-zinc-950">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <label htmlFor="new-comment" className="sr-only">New comment</label>
              <input
                id="new-comment"
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Post a public progress comment..."
                className="flex-1 px-4 py-3 rounded-xl glass-input text-sm placeholder-neutral-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={commentLoading || !newComment.trim()}
                aria-label="Send public progress comment"
                title="Send public progress comment"
                className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-neutral-500 text-white shadow-lg transition-all"
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
    </div>
  );
}
