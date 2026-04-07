import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Filter, 
  Search, Calendar, User, MessageSquare,
  AlertCircle, Check, X, Camera, Plus
} from 'lucide-react';
import { LeaveRequest, UserRole } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Leaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveImage, setLeaveImage] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isManagement = user.role === 'hr' || user.role === 'owner' || user.role === 'super';
      const data = await supabaseService.getLeaves(isManagement ? undefined : user.uid);
      setLeaves(data || []);
    } catch (err) {
      console.error('Error loading leaves:', err);
      toast.error('Failed to sync leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid, user?.role]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Quick validation
    const typeKey = leaveType.toLowerCase() as keyof typeof user.leaveQuotas;
    const remaining = ((user.leaveQuotas as any)?.[typeKey] || 0) - ((user.usedLeaves as any)?.[typeKey] || 0);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > remaining) {
      toast.error(`Insufficient ${leaveType} leave balance.`);
      return;
    }

    setSubmitting(true);
    try {
      const leaveData: any = {
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        leaveType,
        reason,
        startDate: startDate,
        endDate: endDate,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };
      if (leaveImage) leaveData.imageUrl = leaveImage;

      await supabaseService.saveLeave(leaveData);
      
      toast.success('Leave request submitted successfully!');
      setIsModalOpen(false);
      setReason('');
      setStartDate('');
      setEndDate('');
      setLeaveImage(null);
      loadData();
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(error.message || 'Failed to submit leave. Check your permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLeaveImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    if (!user) return;
    try {
      await supabaseService.updateLeave(id, status, user.name);
      toast.success(`Leave request ${status.toLowerCase()}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update request');
    }
  };

  const filteredLeaves = leaves.filter(l => {
    const matchesFilter = filter === 'All' || l.status === filter;
    const matchesSearch = (l.userName || '').toLowerCase().includes(search.toLowerCase()) || 
                         (l.leaveType || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const canApprove = (req: LeaveRequest) => {
    if (!user) return false;
    if (user.role === 'owner') return req.userRole === 'super' || req.userRole === 'hr';
    if (user.role === 'hr') return req.userRole === 'employee';
    if (user.role === 'super') return req.userRole === 'employee';
    return false;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Leave Management</h1>
          <p className="text-zinc-500 font-medium tracking-tight">Track, apply, and approve time-off requests</p>
        </div>
        {user?.role === 'employee' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-orange-600 transition-all shadow-xl shadow-orange-100"
          >
            <Plus size={20} />
            Apply for Leave
          </button>
        )}
      </div>

      {/* 📊 My Balance Summary (Strategic for Employees) */}
      {user?.role === 'employee' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Annual', val: (user.leaveQuotas?.annual || 0) - (user.usedLeaves?.annual || 0), color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Sick', val: (user.leaveQuotas?.sick || 0) - (user.usedLeaves?.sick || 0), color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Casual', val: (user.leaveQuotas?.casual || 0) - (user.usedLeaves?.casual || 0), color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Short', val: (user.leaveQuotas?.short || 0) - (user.usedLeaves?.short || 0), color: 'text-green-600', bg: 'bg-green-50' },
          ].map(q => (
            <div key={q.label} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{q.label} Balance</p>
              <p className={cn("text-2xl font-black", q.color)}>{q.val} Days</p>
            </div>
          ))}
        </div>
      )}

      {/* Global Stats Summary for Managers */}
      {(user?.role === 'hr' || user?.role === 'owner' || user?.role === 'super') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: leaves.filter(l => l.status === 'Pending').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Total Leaves', value: leaves.length, icon: Calendar, color: 'text-zinc-600', bg: 'bg-zinc-100' },
            { label: 'Approved', value: leaves.filter(l => l.status === 'Approved').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Rejected', value: leaves.filter(l => l.status === 'Rejected').length, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", stat.bg, stat.color)}>
                  <stat.icon size={18} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className="text-2xl font-black text-zinc-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-4xl border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Filter list..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                filter === f 
                  ? "bg-zinc-900 text-white" 
                  : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredLeaves.map((req) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={req.id}
              className="bg-white p-6 rounded-4xl border border-zinc-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6"
            >
              <div className="flex items-center gap-4 min-w-[200px]">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 font-black text-xl shadow-inner border border-zinc-100">
                  {req.userName?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">{req.userName}</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{req.userRole}</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-zinc-900">{req.leaveType}</p>
                    <p className="text-[10px] font-bold text-zinc-500">{formatDate(req.startDate)} - {formatDate(req.endDate)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Reason</p>
                    <p className="text-xs font-medium text-zinc-700 line-clamp-1 italic">"{req.reason}"</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                    req.status === 'Approved' ? "bg-green-50 text-green-700 border-green-100" :
                    req.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-100" :
                    "bg-amber-50 text-amber-700 border-amber-100"
                  )}>
                    {req.status}
                  </div>
                  {req.imageUrl && (
                    <a 
                      href={req.imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-orange-500 transition-all"
                      title="View Attachment"
                    >
                      <Camera size={20} />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex gap-2 min-w-[120px] justify-end">
                {req.status === 'Pending' && canApprove(req) ? (
                  <>
                    <button 
                      onClick={() => handleAction(req.id!, 'Approved')}
                      className="p-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-all shadow-lg shadow-green-100"
                    >
                      <Check size={20} />
                    </button>
                    <button 
                      onClick={() => handleAction(req.id!, 'Rejected')}
                      className="p-3 bg-white text-red-500 border border-red-500/30 rounded-2xl hover:bg-red-50 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : req.status === 'Pending' && !canApprove(req) ? (
                  <div className="flex items-center gap-2 text-zinc-400 px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
                    <Clock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Awaiting HR</span>
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">
                    Processed by<br/>
                    <span className="text-zinc-900">{req.approvedBy}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 📝 native Apply Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-4xl shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                <h2 className="text-2xl font-black text-zinc-900">Request Time Off</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmitLeave} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Type of Leave</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as any)}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-zinc-800"
                  >
                    <option value="Annual">Annual Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Casual">Casual Leave</option>
                    <option value="Short">Short Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-zinc-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Reason</label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all resize-none font-medium"
                    placeholder="Briefly describe your reason..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Attachment (Optional)</label>
                  <label className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer group">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Camera size={20} className="text-zinc-400 group-hover:text-orange-500" />
                    <span className="text-sm font-bold text-zinc-500 group-hover:text-orange-600">
                      {leaveImage ? 'Image Attached ✅' : 'Upload Medical/Document'}
                    </span>
                  </label>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-orange-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-orange-600 transition-all shadow-xl shadow-orange-100 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Confirm Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── types for internal use ──────────────────────────────────────────────────
type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Short';
