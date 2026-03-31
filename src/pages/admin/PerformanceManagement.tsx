import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { 
  collection, query, onSnapshot, addDoc, doc, 
  orderBy, where, getDocs, serverTimestamp, updateDoc, getDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  BarChart3, Search, Star, Target, 
  MessageSquare, User, TrendingUp, 
  Plus, XCircle, CheckCircle
} from 'lucide-react';
import { PerformanceRecord, UserProfile } from '../../types';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../../hooks/useAuth';

export default function PerformanceManagement() {
  const { user: currentUser, uid, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [rating, setRating] = useState(5);
  const [goals, setGoals] = useState<string[]>(['']);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'hr' && currentUser.role !== 'super')) {
      navigate('/dashboard');
      return;
    }

    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setEmployees([
        { uid: 'employee-uid', username: 'employee', name: 'Employee User', email: 'employee@hrpulse.com', role: 'employee', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 0, sick: 0, casual: 0, short: 0 }, performanceScore: 100, createdAt: new Date() as any }
      ]);
      return;
    }

    const q = query(collection(db, 'users'), where('role', '!=', 'owner'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });
    return () => unsubscribe();
  }, [currentUser, authLoading, navigate]);

  useEffect(() => {
    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setPerformanceRecords([
        { id: 'perf-1', userId: 'employee-uid', userName: 'Employee User', evaluatorId: 'hr-uid', evaluatorName: 'HR Manager', score: 90, feedback: 'Excellent performance this quarter.', goals: ['Learn React Native', 'Improve communication'], createdAt: new Date() as any }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'performance'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPerformanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PerformanceRecord[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddPerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const record: Omit<PerformanceRecord, 'id'> = {
        userId: selectedEmpId,
        userName: selectedEmpName,
        evaluatorId: auth.currentUser?.uid || '',
        evaluatorName: currentUser?.name || 'HR',
        score: rating * 20, // Convert 1-5 to 1-100
        feedback: feedback,
        goals: goals.filter(g => g.trim() !== ''),
        createdAt: serverTimestamp() as any,
      };

      await addDoc(collection(db, 'performance'), record);
      
      // Update user's performance score
      await updateDoc(doc(db, 'users', selectedEmpId), {
        performanceScore: rating * 20
      });

      toast.success('Performance evaluation recorded');
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedEmpId('');
    setSelectedEmpName('');
    setRating(5);
    setGoals(['']);
    setFeedback('');
  };

  const addGoal = () => setGoals([...goals, '']);
  const updateGoal = (index: number, val: string) => {
    const newGoals = [...goals];
    newGoals[index] = val;
    setGoals(newGoals);
  };

  const filteredRecords = performanceRecords.filter(p => 
    p.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Performance Management</h1>
          <p className="text-zinc-500 font-medium">Evaluate employees and set growth goals</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
        >
          <Plus size={20} />
          New Evaluation
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
            <Star className="text-orange-600" size={24} />
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Avg. Rating</p>
          <p className="text-3xl font-black text-zinc-900">
            {((performanceRecords.reduce((acc, curr) => acc + curr.score, 0) / (performanceRecords.length || 1)) / 20).toFixed(1)}
          </p>
          <p className="text-xs text-zinc-500 font-medium mt-2">Across all evaluations</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
            <Target className="text-blue-600" size={24} />
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Goals Set</p>
          <p className="text-3xl font-black text-zinc-900">
            {performanceRecords.reduce((acc, curr) => acc + curr.goals.length, 0)}
          </p>
          <p className="text-xs text-zinc-500 font-medium mt-2">Active objectives</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-6">
            <TrendingUp className="text-green-600" size={24} />
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Completion</p>
          <p className="text-3xl font-black text-zinc-900">92%</p>
          <p className="text-xs text-zinc-500 font-medium mt-2">Evaluations on track</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Rating</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Goals</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 font-bold text-sm">
                        {record.userName.charAt(0)}
                      </div>
                      <p className="text-sm font-bold text-zinc-900">{record.userName}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          size={14} 
                          className={cn(i < (record.score / 20) ? "text-orange-500 fill-orange-500" : "text-zinc-200")} 
                        />
                      ))}
                      <span className="ml-2 text-sm font-bold text-zinc-900">{(record.score / 20).toFixed(1)}/5</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-zinc-700">{record.goals.length} Active Goals</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[200px]">
                      {record.goals[0]}...
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-zinc-900">{formatDate(record.createdAt?.toDate() || new Date())}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2.5 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all">
                      <MessageSquare size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <BarChart3 size={48} strokeWidth={1} />
                      <p className="font-medium">No performance records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Evaluation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900">New Performance Evaluation</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleAddPerformance} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Select Employee</label>
                  <select
                    required
                    value={selectedEmpId}
                    onChange={(e) => {
                      const emp = employees.find(emp => emp.uid === e.target.value);
                      setSelectedEmpId(e.target.value);
                      setSelectedEmpName(emp?.name || '');
                    }}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                  >
                    <option value="">Choose an employee...</option>
                    {employees.map(emp => (
                      <option key={emp.uid} value={emp.uid}>{emp.name} (@{emp.username})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Rating (1-5)</label>
                  <div className="flex items-center gap-4">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(r)}
                        className={cn(
                          "w-12 h-12 rounded-xl font-black transition-all border",
                          rating === r 
                            ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100" 
                            : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-orange-200"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Key Goals</label>
                    <button 
                      type="button" 
                      onClick={addGoal}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Goal
                    </button>
                  </div>
                  {goals.map((goal, i) => (
                    <input
                      key={i}
                      type="text"
                      value={goal}
                      onChange={(e) => updateGoal(i, e.target.value)}
                      className="w-full px-5 py-3 rounded-xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium text-sm"
                      placeholder={`Goal #${i + 1}`}
                    />
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">HR Feedback</label>
                  <textarea
                    required
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                    placeholder="Provide detailed feedback on performance and areas for improvement..."
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedEmpId}
                    className="flex-1 bg-orange-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Save Evaluation'}
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
