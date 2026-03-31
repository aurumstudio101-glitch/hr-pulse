import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { 
  collection, query, onSnapshot, updateDoc, doc, 
  orderBy, where, getDoc, runTransaction, Timestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  CheckCircle, XCircle, Search, Briefcase, 
  Calendar as CalendarIcon, Clock, User,
  AlertTriangle, Filter
} from 'lucide-react';
import { LeaveRequest, UserProfile } from '../../types';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../../hooks/useAuth';

export default function LeaveManagement() {
  const { user: currentUser, uid, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'hr' && currentUser.role !== 'super')) {
      navigate('/dashboard');
      return;
    }

    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setRequests([
        {
          id: 'demo-1',
          userId: 'employee-uid',
          userName: 'Employee User',
          userRole: 'employee',
          leaveType: 'Annual',
          reason: 'Vacation',
          startDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)),
          endDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 2)),
          status: 'Pending',
          createdAt: Timestamp.now()
        }
      ] as LeaveRequest[]);
      setLoading(false);
      return;
    }

    // HR can see employee requests. Owner can see everyone's.
    const q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LeaveRequest[];
      
      const filteredByRole = allRequests.filter(req => {
        if (currentUser.role === 'owner' || currentUser.role === 'super') return true;
        if (currentUser.role === 'hr') return req.userRole === 'employee';
        return false;
      });

      setRequests(filteredByRole);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, authLoading, navigate]);

  const handleStatusUpdate = async (request: LeaveRequest, status: 'Approved' | 'Rejected') => {
    if (!request.id || !currentUser) return;

    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'leaveRequests', request.id!);
        const userRef = doc(db, 'users', request.userId);
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        
        // Update request status
        transaction.update(requestRef, { 
          status,
          approvedBy: currentUser.name,
          updatedAt: new Date()
        });

        // If approved, deduct from balance
        if (status === 'Approved') {
          const leaveType = request.leaveType.toLowerCase() as keyof UserProfile['usedLeaves'];
          const currentUsed = userData.usedLeaves[leaveType] || 0;
          const duration = Math.ceil(Math.abs(request.endDate.toDate().getTime() - request.startDate.toDate().getTime()) / (1000 * 60 * 60 * 24)) + 1;

          transaction.update(userRef, {
            [`usedLeaves.${leaveType}`]: currentUsed + duration
          });
        }
      });

      toast.success(`Request ${status.toLowerCase()} successfully`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.leaveType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'All' || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-zinc-900">Leave Management</h1>
        <p className="text-zinc-500 font-medium">Review and process employee leave applications</p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                placeholder="Search by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
            <div className="flex p-1 bg-zinc-100 rounded-xl">
              {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <Briefcase size={16} />
            {filteredRequests.length} Requests Found
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Leave Details</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Duration</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-zinc-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 font-bold text-sm">
                        {request.userName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{request.userName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{request.userRole}</span>
                          {request.isUrgent && <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter flex items-center gap-0.5"><AlertTriangle size={8} /> Urgent</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-zinc-900">{request.leaveType}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {formatDate(request.startDate.toDate())} - {formatDate(request.endDate.toDate())}
                    </p>
                    {request.reason && <p className="text-[10px] text-zinc-500 italic mt-1 truncate max-w-[200px]">"{request.reason}"</p>}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      <Clock size={14} className="text-zinc-400" />
                      <span className="text-sm font-bold">
                        {Math.ceil(Math.abs(request.endDate.toDate().getTime() - request.startDate.toDate().getTime()) / (1000 * 60 * 60 * 24)) + 1} Days
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      request.status === 'Approved' ? "bg-green-50 text-green-700 border-green-100" :
                      request.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {request.status}
                    </div>
                    {request.approvedBy && <p className="text-[9px] text-zinc-400 mt-1">By {request.approvedBy}</p>}
                  </td>
                  <td className="px-8 py-5 text-right">
                    {request.status === 'Pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStatusUpdate(request, 'Approved')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-100"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(request, 'Rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest italic">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <Briefcase size={48} strokeWidth={1} />
                      <p className="font-medium">No leave requests found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
