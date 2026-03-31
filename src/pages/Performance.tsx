import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, query, onSnapshot, doc, 
  orderBy, where, getDoc, updateDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  BarChart3, Star, Target, MessageSquare, 
  TrendingUp, CheckCircle, Clock, Edit2, XCircle
} from 'lucide-react';
import { PerformanceRecord, UserProfile } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../hooks/useAuth';

export default function Performance() {
  const { user, uid, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PerformanceRecord | null>(null);
  const [selfEvaluation, setSelfEvaluation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!uid) return;

    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setRecords([
        { id: 'perf-1', userId: uid, userName: 'Demo User', evaluatorId: 'hr-uid', evaluatorName: 'HR Manager', score: 85, rating: 4, feedback: 'Good progress this quarter.', hrFeedback: 'Consistently meeting expectations.', goals: ['Master React', 'Improve documentation'], status: 'Completed', createdAt: { toDate: () => new Date() } as any }
      ]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'performance'), 
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PerformanceRecord[]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching performance records:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  const handleSelfEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord?.id) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'performance', selectedRecord.id), {
        selfEvaluation,
        status: 'Self-Evaluated'
      });
      toast.success('Self-evaluation submitted successfully');
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (record: PerformanceRecord) => {
    setSelectedRecord(record);
    setSelfEvaluation(record.selfEvaluation || '');
    setIsModalOpen(true);
  };

  const latestRecord = records[0];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-zinc-900">My Performance</h1>
        <p className="text-zinc-500 font-medium">Track your growth, goals, and feedback</p>
      </div>

      {latestRecord && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
              <Star className="text-orange-600" size={24} />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Current Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-black text-zinc-900">{latestRecord.rating}/5</p>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className={cn(i < latestRecord.rating ? "text-orange-500 fill-orange-500" : "text-zinc-200")} />
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
              <Target className="text-blue-600" size={24} />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Goals</p>
            <p className="text-3xl font-black text-zinc-900">{latestRecord.goals.length}</p>
            <p className="text-xs text-zinc-500 font-medium mt-2">Set by HR/Owner</p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-6">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-3xl font-black text-zinc-900">{latestRecord.status}</p>
            <p className="text-xs text-zinc-500 font-medium mt-2">Latest evaluation</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
            <Clock size={24} className="text-orange-500" />
            Evaluation History
          </h3>
          <div className="space-y-4">
            {records.map((record) => (
              <motion.div 
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Performance Review</p>
                      <p className="text-xs text-zinc-500 font-medium">{formatDate(record.createdAt?.toDate() || new Date())}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={cn(i < record.rating ? "text-orange-500 fill-orange-500" : "text-zinc-200")} />
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{record.status}</p>
                    </div>
                    <button 
                      onClick={() => openModal(record)}
                      className="p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Target size={14} className="text-orange-500" />
                      Key Goals
                    </h4>
                    <ul className="space-y-2">
                      {record.goals.map((goal, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium text-zinc-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare size={14} className="text-blue-500" />
                      HR Feedback
                    </h4>
                    <p className="text-sm font-medium text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-2xl italic">
                      "{record.hrFeedback}"
                    </p>
                  </div>
                </div>

                {record.selfEvaluation && (
                  <div className="mt-8 pt-8 border-t border-zinc-50">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Your Self-Evaluation</h4>
                    <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                      {record.selfEvaluation}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
            {records.length === 0 && (
              <div className="bg-white p-12 rounded-[2.5rem] border border-zinc-100 text-center">
                <BarChart3 size={48} className="text-zinc-200 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">No performance reviews yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-orange-500" />
            Growth Tips
          </h3>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-orange-100">
            <h4 className="text-lg font-bold mb-4">Keep it up!</h4>
            <p className="text-sm text-orange-50 leading-relaxed mb-6">
              Your performance score is in the top 15% of the company. Focus on your "Leadership" goal this quarter to prepare for senior roles.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                <CheckCircle size={18} />
                <span className="text-xs font-bold">Complete 2 more tasks today</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                <CheckCircle size={18} />
                <span className="text-xs font-bold">Update your monthly goals</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Self Evaluation Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900">Self Evaluation</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSelfEvaluation} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Your Thoughts</label>
                  <textarea
                    required
                    value={selfEvaluation}
                    onChange={(e) => setSelfEvaluation(e.target.value)}
                    rows={6}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                    placeholder="How do you feel about your performance? What were your key achievements and challenges?"
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
                    disabled={submitting}
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
