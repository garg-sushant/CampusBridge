'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Complaint, Comment, Department, AdminDashboardStats } from '@/types';
import Navbar from '@/components/Navbar';
import { 
  Search, LogOut, AlertTriangle, 
  HelpCircle, Send, X, Image as ImageIcon,
  LayoutDashboard, Layers, Flame, Users
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  
  // Action details
  const [newStatus, setNewStatus] = useState('');
  const [newDeptId, setNewDeptId] = useState<number | ''>('');
  const [newUrgency, setNewUrgency] = useState('');
  const [duplicateInput, setDuplicateInput] = useState('');
  const [isDuplicateFlag, setIsDuplicateFlag] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load complaints and stats
  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      let path = '/complaints?';
      if (statusFilter) path += `status=${statusFilter}&`;
      if (urgencyFilter) path += `urgency=${urgencyFilter}&`;
      if (deptFilter) path += `department_id=${deptFilter}&`;
      if (search) path += `search=${encodeURIComponent(search)}&`;
      const data = await api.get<Complaint[]>(path);
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load grievances', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter, urgencyFilter, deptFilter, search]);

  const loadStats = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setStatsLoading(true);
      const data = await api.get<AdminDashboardStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      if (showLoading) setStatsLoading(false);
    }
  }, []);

  const loadDepts = useCallback(async () => {
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
      console.error('Failed to load campus departments', err);
      setDepartments([
        { id: 1, name: 'Hostel Administration', code: 'HOSTEL', created_at: '' },
        { id: 2, name: 'WiFi/IT Services', code: 'IT', created_at: '' },
        { id: 3, name: 'Electrical Maintenance', code: 'ELECTRICAL', created_at: '' },
        { id: 4, name: 'Water & Sanitation', code: 'WATER', created_at: '' }
      ]);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData(true);
      loadStats(true);
      loadDepts();
    }
  }, [user, loadData, loadStats, loadDepts]);

  // Load comments in background without resetting active drawer form fields
  const loadSelectedComments = useCallback(async (complaintId: string) => {
    try {
      const detailed = await api.get<Complaint>(`/complaints/${complaintId}`);
      setSelectedComplaint(detailed);
      setComments(detailed.comments || []);
    } catch (err) {
      console.error('Failed to fetch detailed grievance comments in background', err);
    }
  }, []);

  // Load single detailed complaint and initialise drawer fields
  const handleSelectComplaint = async (complaint: Complaint) => {
    setActionError(null);
    try {
      const detailed = await api.get<Complaint>(`/complaints/${complaint.id}`);
      setSelectedComplaint(detailed);
      setComments(detailed.comments || []);
      setNewStatus(detailed.status);
      setNewDeptId(detailed.department_id || '');
      setNewUrgency(detailed.urgency);
      setIsDuplicateFlag(detailed.is_duplicate);
      setDuplicateInput(detailed.duplicate_of_id || '');
    } catch (err) {
      console.error('Failed to fetch detailed grievance', err);
    }
  };

  // Polling for real-time updates (syncs list, stats, and comments)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadData(false);
      loadStats(false);
      if (selectedComplaint) {
        loadSelectedComments(selectedComplaint.id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, loadData, loadStats, selectedComplaint?.id, loadSelectedComments]);

  // Submit comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedComplaint) return;
    try {
      const added = await api.post<Comment>(`/complaints/${selectedComplaint.id}/comment`, {
        content: newComment,
        is_internal: isInternalComment
      });
      const userObj = user ? { id: user.id, email: user.email, full_name: user.full_name, role: user.role, trust_score: user.trust_score, department_id: user.department_id, created_at: user.created_at } : null;
      setComments(prev => [...prev, { ...added, user: userObj }]);
      setNewComment('');
      setIsInternalComment(false);
    } catch (err) {
      console.error('Failed to submit comment', err);
    }
  };

  // Update administrative fields
  const handleApplyActions = async () => {
    if (!selectedComplaint) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const isDeptHead = user?.role === 'department_head';
      const updated = await api.patch<Complaint>(`/complaints/${selectedComplaint.id}/status`, {
        status: newStatus || undefined,
        department_id: isDeptHead ? (selectedComplaint.department_id || user.department_id) : (newDeptId || null),
        urgency: newUrgency || undefined,
        is_duplicate: isDuplicateFlag,
        duplicate_of_id: isDuplicateFlag && duplicateInput ? duplicateInput : null
      });

      setSelectedComplaint(updated);
      setComments(updated.comments || []);
      
      // Reload list and stats
      loadData();
      loadStats();
    } catch (err) {
      console.error('Failed to apply administrative update', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update administrative settings.');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role === 'student') {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center text-center px-4">
        <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" aria-hidden="true" />
        <h3 className="text-xl font-bold text-white">Access Denied</h3>
        <p className="text-sm text-neutral-400 mt-1 mb-4">You do not have administrative clearance to access this hub.</p>
        <Link href="/login" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-all">
          Go Back
        </Link>
      </div>
    );
  }

  // Dynamically resolve department details for title rendering
  const activeUserDept = departments.find(d => d.id === user?.department_id);
  const activeDeptName = activeUserDept ? activeUserDept.name : '';
  
  const dashboardTitle = user?.role === 'admin' 
    ? "Dean's Governance Desk" 
    : user?.role === 'department_head' && activeDeptName 
    ? `${activeDeptName} Desk` 
    : "Administrative Desk";

  const dashboardSubtitle = user?.role === 'admin'
    ? "Review and monitor campus-wide grievances, automated verification data, and statuses."
    : user?.role === 'department_head' && activeDeptName
    ? `Review and resolve grievances assigned to the ${activeDeptName} department.`
    : "Review campus grievances, inspect automated verification data, and route tasks to appropriate departments.";

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
    
    // Dean (admin) should see replies of dept to students, but NOT private/internal notes by department heads
    if (user?.role === 'admin' && c.is_internal && c.user?.role === 'department_head') {
      return false;
    }
    
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white relative">
      <Navbar />

      {/* Main Admin Area */}
      <main className="flex-1 z-10 bg-zinc-950 pb-16">
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-8 space-y-8 w-full mx-auto">
          {/* Top Panel Title */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-5 bg-zinc-950">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{dashboardTitle}</h1>
              <p className="text-zinc-400 text-sm mt-1">{dashboardSubtitle}</p>
            </div>
            <div className="text-xs text-zinc-400 font-semibold font-mono tracking-wider bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full uppercase shadow-sm">
              {user.role.replace('_', ' ')} clearance
            </div>
          </div>

          {/* Analytics Dashboard Grid */}
          {!statsLoading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="glass-panel p-4 rounded-xl">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Active Loading</span>
                <span className="text-2xl font-extrabold mt-1 block">{stats.active_complaints}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Resolved Cases</span>
                <span className="text-2xl font-extrabold mt-1 block text-emerald-400">{stats.resolved_complaints}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Resolution Rate</span>
                <span className="text-2xl font-extrabold mt-1 block text-indigo-400">{stats.resolution_rate}%</span>
              </div>
              <div className="glass-panel p-4 rounded-xl">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Semantic Duplicates</span>
                <span className="text-2xl font-extrabold mt-1 block text-amber-400">{stats.duplicate_count}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Spam / Rejected</span>
                <span className="text-2xl font-extrabold mt-1 block text-rose-400">{stats.fake_count}</span>
              </div>
            </div>
          )}

          {/* Dynamic SVG / Progress indicator Charts panel */}
          {!statsLoading && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Department loads */}
              <div className="glass-panel p-5 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                  <Layers className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Load by Department</span>
                </div>
                <div className="space-y-2">
                  {stats.department_distribution.slice(0, 4).map((d) => (
                    <div key={d.department_name} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>{d.department_name}</span>
                        <span className="font-bold text-white">{d.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full w-[--bar-width]" 
                          style={{ '--bar-width': `${stats.total_complaints > 0 ? (d.count / stats.total_complaints) * 100 : 0}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Urgency levels */}
              <div className="glass-panel p-5 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                  <Flame className="h-4 w-4 text-rose-400" aria-hidden="true" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Urgency Trends</span>
                </div>
                <div className="space-y-2">
                  {stats.urgency_distribution.map((u) => (
                    <div key={u.urgency} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400 capitalize">
                        <span>{u.urgency}</span>
                        <span className="font-bold text-white">{u.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full w-[--bar-width] ${
                            u.urgency === 'critical' || u.urgency === 'high' ? 'bg-rose-500' :
                            u.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ '--bar-width': `${stats.total_complaints > 0 ? (u.count / stats.total_complaints) * 100 : 0}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category loads */}
              <div className="glass-panel p-5 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                  <Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Category Frequency</span>
                </div>
                <div className="space-y-2">
                  {stats.category_distribution.slice(0, 4).map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>{c.category}</span>
                        <span className="font-bold text-white">{c.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full w-[--bar-width]" 
                          style={{ '--bar-width': `${stats.total_complaints > 0 ? (c.count / stats.total_complaints) * 100 : 0}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grievance Desk list registry */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Grievance Registry</h3>

            {/* Filter controls */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <label htmlFor="admin-search" className="sr-only">Search student names, titles or descriptions</label>
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
                <input
                  id="admin-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student names, titles, or descriptions..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm placeholder-neutral-500 focus:outline-none"
                />
              </div>

              {/* Status filter */}
              <div className="relative min-w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter complaints by status"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-neutral-950 focus:outline-none"
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

              {/* Urgency filter */}
              <div className="relative min-w-40">
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  aria-label="Filter complaints by urgency"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-neutral-950 focus:outline-none"
                >
                  <option value="">All Urgency</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Department filter (Only visible to Dean/Admin) */}
              {user?.role === 'admin' && (
                <div className="relative min-w-48">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : '')}
                    aria-label="Filter complaints by department"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-neutral-950 focus:outline-none"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Registry table list */}
            {loading ? (
              <div className="glass-panel p-12 rounded-xl flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : complaints.length === 0 ? (
              <div className="glass-panel p-12 rounded-xl text-center space-y-2">
                <HelpCircle className="h-8 w-8 text-neutral-600 mx-auto" aria-hidden="true" />
                <p className="text-neutral-400 text-sm">No grievances found matching the filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/10">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300 font-bold uppercase tracking-wider text-xs">
                      <th scope="col" className="p-4.5">Student</th>
                      <th scope="col" className="p-4.5">Grievance Summary</th>
                      <th scope="col" className="p-4.5">Routed Dept</th>
                      <th scope="col" className="p-4.5">Urgency</th>
                      <th scope="col" className="p-4.5">Status</th>
                      <th scope="col" className="p-4.5 text-right">Filed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map((c) => {
                      const isSelected = selectedComplaint?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleSelectComplaint(c)}
                          className={`border-b border-zinc-900/50 cursor-pointer hover:bg-zinc-900/20 transition-colors ${
                            isSelected ? 'bg-zinc-900/50' : ''
                          }`}
                        >
                          <th scope="row" className="p-4.5 font-bold text-left text-white">
                            {c.student?.full_name}
                            <span className="block text-xs text-zinc-400 font-mono tracking-wide font-normal mt-0.5">
                              Trust: {c.student?.trust_score?.toFixed(0) ?? '100'}%
                            </span>
                          </th>
                          <td className="p-4.5">
                            <span className="font-extrabold text-zinc-200 block max-w-70 truncate text-sm">{c.title}</span>
                            <span className="block text-xs text-zinc-400 truncate max-w-70 mt-0.5">{c.description}</span>
                          </td>
                          <td className="p-4.5 text-zinc-300 font-medium">
                            {c.department?.name || <span className="text-neutral-500">Unassigned</span>}
                          </td>
                          <td className="p-4.5">
                            <span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] ${
                              c.urgency === 'critical' || c.urgency === 'high' ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30' :
                              c.urgency === 'medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/30' :
                              'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}>
                              {c.urgency}
                            </span>
                          </td>
                          <td className="p-4.5">
                            <span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] ${
                              c.status === 'resolved' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' :
                              c.status === 'rejected' ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30' :
                              c.status === 'in_progress' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/30' :
                              'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}>
                              {c.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-neutral-500">
                            {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right Drawer: Administrative Action Panel */}
      {selectedComplaint && (
        <aside className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col z-50 animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-950">
            <div>
              <span className="block text-xs font-mono font-semibold text-indigo-400 tracking-wider">ADMINISTRATIVE ORCHESTRATION</span>
              <span className="font-bold text-sm truncate max-w-64 block text-white mt-1">{selectedComplaint.title}</span>
            </div>
            <button 
              onClick={() => setSelectedComplaint(null)} 
              aria-label="Close admin action panel drawer"
              title="Close admin action panel drawer"
              className="p-2 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white transition-all"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Action Dashboard Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Student info */}
            <div className="glass-panel p-5 rounded-xl space-y-3 border border-white/5 bg-neutral-900/10">
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Submitting Student Info</span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-extrabold text-sm text-white">{selectedComplaint.student?.full_name}</span>
                  <span className="block text-xs text-neutral-400 mt-0.5">{selectedComplaint.student?.email}</span>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-neutral-400 font-medium">Integrity Trust Rating</span>
                  <span className={`block font-extrabold text-base mt-0.5 ${
                    selectedComplaint.student && selectedComplaint.student.trust_score >= 90 ? 'text-emerald-400' : 'text-indigo-400'
                  }`}>
                    {selectedComplaint.student?.trust_score?.toFixed(0) ?? '100'}%
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION MANAGER PANEL */}
            <div className="space-y-5 border-b border-zinc-900 pb-6">
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Administrative Orchestration</span>
              
              {user?.role === 'admin' ? (
                <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden shadow-inner space-y-4">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                  <div className="flex items-center space-x-2 text-indigo-400">
                    <span className="text-xs font-bold font-mono tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      Read-Only Mode
                    </span>
                    <span className="text-[10px] text-zinc-400 font-semibold font-mono tracking-wider uppercase">
                      Dean Clearance
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="block text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Current Status</span>
                      <span className="block font-bold text-white capitalize mt-0.5">{selectedComplaint.status.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="block text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Urgency Level</span>
                      <span className="block font-bold text-white capitalize mt-0.5">{selectedComplaint.urgency}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Assigned Department</span>
                      <span className="block font-bold text-white mt-0.5">
                        {selectedComplaint.department?.name || 'Unassigned (Claim Desk)'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed pt-1 border-t border-white/5">
                    Note: You have complete view-only clearance as Dean. Modifying orchestration values or submitting timeline comments is disabled for this role.
                  </p>
                </div>
              ) : (
                <>
                  {actionError && (
                    <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs" role="alert">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
                      <span className="font-semibold leading-relaxed">{actionError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Status */}
                    <div className="space-y-1.5">
                      <label htmlFor="action-status" className="block text-xs text-neutral-400 uppercase tracking-wider font-semibold">Workflow Status</label>
                      <select
                        id="action-status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg glass-input text-xs bg-neutral-950 font-medium"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    {/* Urgency */}
                    <div className="space-y-1.5">
                      <label htmlFor="action-urgency" className="block text-xs text-neutral-400 uppercase tracking-wider font-semibold">Grievance Urgency</label>
                      <select
                        id="action-urgency"
                        value={newUrgency}
                        onChange={(e) => setNewUrgency(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg glass-input text-xs bg-neutral-950 font-medium"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    {/* Department Routing */}
                    <div className="col-span-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label htmlFor="action-dept" className="block text-xs text-neutral-400 uppercase tracking-wider font-semibold">Department Assignment</label>
                        {user?.role === 'department_head' && (
                          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded animate-pulse">
                            Locked to your purview
                          </span>
                        )}
                      </div>
                      <select
                        id="action-dept"
                        value={newDeptId}
                        disabled={user?.role === 'department_head'}
                        onChange={(e) => setNewDeptId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2.5 rounded-lg glass-input text-xs bg-neutral-950 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">Unassigned (Claim Desk)</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duplicate link check */}
                    <div className="col-span-2 flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        checked={isDuplicateFlag}
                        onChange={(e) => setIsDuplicateFlag(e.target.checked)}
                        id="isDuplicate"
                        className="rounded border-white/10 bg-neutral-950 text-indigo-600 focus:ring-0"
                      />
                      <label htmlFor="isDuplicate" className="text-sm text-neutral-300 select-none cursor-pointer">
                        Link as Duplicate Grievance
                      </label>
                    </div>

                    {isDuplicateFlag && (
                      <div className="col-span-2 space-y-1.5">
                        <label htmlFor="duplicate-target" className="block text-xs text-neutral-400 uppercase tracking-wider font-semibold">Target Duplicate ID</label>
                        <input
                          id="duplicate-target"
                          type="text"
                          value={duplicateInput}
                          onChange={(e) => setDuplicateInput(e.target.value)}
                          placeholder="Enter target grievance UUID..."
                          className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Apply Action Button */}
                  <button
                    onClick={handleApplyActions}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white shadow-lg transition-all cursor-pointer"
                  >
                    {actionLoading ? (
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      <span>Apply Orchestration Settings</span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Description details */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Report Description</span>
              <div className="p-5 rounded-xl bg-neutral-900 border border-zinc-800 leading-relaxed text-sm text-neutral-200 whitespace-pre-wrap">
                {selectedComplaint.description}
              </div>
            </div>

            {/* Evidence files */}
            {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
              <div className="space-y-4">
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Evidence Files</span>
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
                          <span className="font-semibold underline">View Attachment</span>
                        </a>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                          att.ai_verification_status === 'verified' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                          att.ai_verification_status === 'rejected' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                          'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                        }`}>
                          System Analysis: {att.ai_verification_status}
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
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-neutral-200">{comm.user ? comm.user.full_name : 'Staff'}</span>
                        {comm.is_internal && (
                          <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            INTERNAL NOTE
                          </span>
                        )}
                      </div>
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
          </div>

          {/* Comment submission bar */}
          {user?.role !== 'admin' && (
            <div className="p-5 border-t border-zinc-900 bg-zinc-950 space-y-4">
              <form onSubmit={handleAddComment} className="space-y-4">
                <div className="flex gap-2">
                  <label htmlFor="admin-comment" className="sr-only">Post administrative progress update</label>
                  <input
                    id="admin-comment"
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Post administrative progress update..."
                    className="flex-1 px-4 py-3 rounded-xl glass-input text-sm placeholder-neutral-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    aria-label="Send administrative comment"
                    title="Send administrative comment"
                    className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="h-4.5 w-4.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    id="isInternal"
                    className="rounded border-white/10 bg-neutral-950 text-rose-600 focus:ring-0"
                  />
                  <label htmlFor="isInternal" className="text-xs text-neutral-400 font-bold uppercase select-none cursor-pointer">
                    Post as Staff-Only Internal Note
                  </label>
                </div>
              </form>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
