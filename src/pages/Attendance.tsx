import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Clock, ArrowUpRight, ArrowDownRight, Calendar, UserCheck, Timer } from 'lucide-react';
import { AttendanceRecord } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';

import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../firebase';

export default function Attendance() {
  const { user, uid, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    if (!uid) return;

    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      const today = new Date().toISOString().split('T')[0];
      const mockRecords: AttendanceRecord[] = [
        { id: 'att-1', userId: uid, date: today, checkIn: { toDate: () => new Date(new Date().setHours(9, 0)) } as any, checkOut: { toDate: () => new Date(new Date().setHours(17, 0)) } as any, isLate: false, isEarlyOut: false },
        { id: 'att-2', userId: uid, date: '2024-03-20', checkIn: { toDate: () => new Date(new Date().setHours(8, 45)) } as any, checkOut: { toDate: () => new Date(new Date().setHours(17, 15)) } as any, isLate: false, isEarlyOut: false }
      ];
      setRecords(mockRecords);
      setTodayRecord(mockRecords[0]);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
      setRecords(allRecords);
      
      const todayRec = allRecords.find(r => r.date === today);
      setTodayRecord(todayRec || null);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendance records:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleCheckIn = async () => {
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await addDoc(collection(db, 'attendance'), {
        userId: uid,
        date: today,
        checkIn: serverTimestamp(),
      });
      toast.success('Checked in successfully!');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'attendance');
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.id) return;
    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        checkOut: serverTimestamp(),
      });
      toast.success('Checked out successfully!');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `attendance/${todayRecord.id}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading attendance logs...</div>;

  const isCheckedIn = !!todayRecord;
  const isCheckedOut = !!todayRecord?.checkOut;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-zinc-900">Attendance Log</h1>
        <p className="text-zinc-500 font-medium">Track your daily work hours and shifts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm sticky top-24">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <Clock size={20} className="text-orange-500" />
                Today's Shift
              </h3>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                isCheckedOut ? "bg-zinc-100 text-zinc-500" : 
                isCheckedIn ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              )}>
                {isCheckedOut ? 'Completed' : isCheckedIn ? 'Active' : 'Not Started'}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <ArrowUpRight size={18} className="text-green-600" />
                  <span className="text-sm font-bold text-zinc-600">Check In</span>
                </div>
                <span className="text-sm font-black text-zinc-900">
                  {todayRecord?.checkIn ? todayRecord.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <ArrowDownRight size={18} className="text-red-600" />
                  <span className="text-sm font-bold text-zinc-600">Check Out</span>
                </div>
                <span className="text-sm font-black text-zinc-900">
                  {todayRecord?.checkOut ? todayRecord.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>

              {!isCheckedIn ? (
                <button 
                  onClick={handleCheckIn}
                  className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                >
                  <UserCheck size={20} />
                  Check In Now
                </button>
              ) : !isCheckedOut ? (
                <button 
                  onClick={handleCheckOut}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-100 flex items-center justify-center gap-2"
                >
                  <Timer size={20} />
                  Check Out
                </button>
              ) : (
                <div className="w-full bg-zinc-100 text-zinc-500 py-4 rounded-2xl font-bold text-center">
                  Shift Completed
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-zinc-50">
              <h2 className="text-xl font-black text-zinc-900">History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Check In</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Check Out</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                            <Calendar size={16} />
                          </div>
                          <span className="text-sm font-bold text-zinc-900">{record.date}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-zinc-700">
                        {record.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-zinc-700">
                        {record.checkOut ? record.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          record.checkOut ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {record.checkOut ? 'Completed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
