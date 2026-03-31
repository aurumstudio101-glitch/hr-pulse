import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, Timestamp, limit, doc, getDoc, updateDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  Calendar, Clock, CheckCircle2, XCircle, Plus, 
  ArrowUpRight, ArrowDownRight, Timer, ListTodo,
  TrendingUp, Briefcase, UserCheck, ShieldCheck
} from 'lucide-react';
import { LeaveRequest, UserProfile, AttendanceRecord, Task, LeaveType } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../firebase';

export default function Dashboard() {
  const { user, uid, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: '🌞' };
    if (hour < 18) return { text: 'Good Afternoon', icon: '☀️' };
    return { text: 'Good Evening', icon: '🌙' };
  };

  useEffect(() => {
    if (!uid) return;

    // Mock data for demo users if Firestore fails or is not needed
    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    
    if (isDemo) {
      setRequests([
        {
          id: 'demo-1',
          userId: uid,
          userName: user?.name || 'Demo User',
          userRole: user?.role || 'employee',
          leaveType: 'Annual',
          reason: 'Vacation',
          startDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)),
          endDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 2)),
          status: 'Approved',
          createdAt: Timestamp.now()
        }
      ] as LeaveRequest[]);
      
      setAttendance([
        {
          id: 'att-1',
          userId: uid,
          date: new Date().toISOString().split('T')[0],
          checkIn: Timestamp.fromDate(new Date(new Date().setHours(9, 0))),
          isLate: false,
          isEarlyOut: false
        }
      ] as AttendanceRecord[]);
      
      setTasks([
        { id: 'task-1', userId: uid, title: 'Complete onboarding', completed: true, createdAt: Timestamp.now() },
        { id: 'task-2', userId: uid, title: 'Review payroll', completed: false, createdAt: Timestamp.now() }
      ] as Task[]);
      
      setLoading(false);
      return; // Stop here for demo users
    }

    // Leave Requests
    const qLeaves = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsubLeaves = onSnapshot(qLeaves, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LeaveRequest[]);
    }, (error) => {
      console.error("Leave Requests Error:", error);
      if (isDemo) setLoading(false);
    });

    // Attendance
    const qAtt = query(
      collection(db, 'attendance'),
      where('userId', '==', uid),
      orderBy('date', 'desc'),
      limit(7)
    );
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[]);
    }, (error) => {
      console.error("Attendance Error:", error);
    });

    // Tasks
    const qTasks = query(
      collection(db, 'tasks'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[]);
      setLoading(false);
    }, (error) => {
      console.error("Tasks Error:", error);
      setLoading(false);
    });

    return () => {
      unsubLeaves();
      unsubAtt();
      unsubTasks();
    };
  }, [uid]);

  const handleCheckIn = async () => {
    if (!uid) return;
    const todayStr = currentTime.toISOString().split('T')[0];
    const hour = currentTime.getHours();
    const isLate = hour >= 9; // Late after 9:00 AM

    try {
      await addDoc(collection(db, 'attendance'), {
        userId: uid,
        date: todayStr,
        checkIn: serverTimestamp(),
        isLate,
        isEarlyOut: false,
      });
      toast.success('Checked in successfully!');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'attendance');
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.id) return;
    const hour = currentTime.getHours();
    const isEarlyOut = hour < 17; // Early out before 5:00 PM

    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        checkOut: serverTimestamp(),
        isEarlyOut,
      });
      toast.success('Checked out successfully!');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `attendance/${todayRecord.id}`);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !completed });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `tasks/${id}`);
    }
  };

  const addTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const title = (form.elements.namedItem('taskTitle') as HTMLInputElement).value;
    if (!title || !uid) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        userId: uid,
        title,
        completed: false,
        createdAt: serverTimestamp(),
      });
      form.reset();
      toast.success('Task added');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'tasks');
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !user) return;
    
    // Check balance
    const typeKey = leaveType.toLowerCase() as keyof typeof user.leaveQuotas;
    const remaining = user.leaveQuotas[typeKey] - user.usedLeaves[typeKey];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > remaining) {
      toast.error(`Insufficient ${leaveType} leave balance. Remaining: ${remaining} days.`);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        userId: uid,
        userName: user.name,
        userRole: user.role,
        leaveType,
        reason,
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        status: 'Pending',
        createdAt: serverTimestamp(),
      });
      toast.success('Leave request submitted!');
      setIsModalOpen(false);
      setReason('');
      setStartDate('');
      setEndDate('');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'leaveRequests');
    } finally {
      setSubmitting(false);
    }
  };

  const leaveData = user ? [
    { name: 'Annual', value: user.leaveQuotas.annual - user.usedLeaves.annual, color: '#ff8c00' },
    { name: 'Sick', value: user.leaveQuotas.sick - user.usedLeaves.sick, color: '#ef4444' },
    { name: 'Casual', value: user.leaveQuotas.casual - user.usedLeaves.casual, color: '#3b82f6' },
    { name: 'Short', value: user.leaveQuotas.short - user.usedLeaves.short, color: '#10b981' },
  ] : [];

  const attendanceData = [
    { day: 'Mon', hours: 0 },
    { day: 'Tue', hours: 0 },
    { day: 'Wed', hours: 0 },
    { day: 'Thu', hours: 0 },
    { day: 'Fri', hours: 0 },
  ];

  attendance.forEach(r => {
    const day = new Date(r.date).toLocaleDateString([], { weekday: 'short' });
    const data = attendanceData.find(d => d.day === day);
    if (data && r.checkIn && r.checkOut) {
      const diff = r.checkOut.toDate().getTime() - r.checkIn.toDate().getTime();
      data.hours = Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
    }
  });

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading your workspace...</div>;

  const todayStr = currentTime.toISOString().split('T')[0];
  const todayRecord = attendance.find(r => r.date === todayStr);
  const isCheckedIn = !!todayRecord;
  const isCheckedOut = !!todayRecord?.checkOut;
  const greeting = getGreeting();

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-8 text-white shadow-xl shadow-orange-100 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{greeting.icon}</span>
                <div>
                  <h1 className="text-3xl font-black">{greeting.text}, {user?.name.split(' ')[0]}!</h1>
                  <p className="text-orange-100 font-bold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              
              <p className="text-orange-50 opacity-90 font-medium max-w-md mb-8">
                {user?.role === 'employee' 
                  ? `You have ${user.leaveQuotas.annual - user.usedLeaves.annual} annual leave days remaining. Your current performance score is ${user.performanceScore}%.`
                  : `Administrative Portal: You have full control over ${user?.role === 'owner' || user?.role === 'super' ? 'HR and Employee' : 'Employee'} management.`}
              </p>

              <div className="flex flex-wrap gap-4">
                {user?.role === 'employee' && (
                  <>
                    {!isCheckedIn ? (
                      <button 
                        onClick={handleCheckIn}
                        className="bg-white text-orange-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-50 transition-all shadow-lg"
                      >
                        <ArrowUpRight size={20} />
                        Check In Now
                      </button>
                    ) : !isCheckedOut ? (
                      <button 
                        onClick={handleCheckOut}
                        className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
                      >
                        <ArrowDownRight size={20} />
                        Check Out
                      </button>
                    ) : (
                      <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                        <UserCheck size={20} />
                        Shift Completed
                      </div>
                    )}
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-orange-400/30 backdrop-blur-md text-white border border-white/30 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-400/40 transition-all"
                    >
                      <Plus size={20} />
                      Request Leave
                    </button>
                  </>
                )}
                {(user?.role === 'hr' || user?.role === 'owner' || user?.role === 'super') && (
                  <div className="flex gap-4">
                    <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                      <ShieldCheck size={20} />
                      {user.role.toUpperCase()} Access
                    </div>
                    {(user.role === 'hr' || user.role === 'super') && (
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-orange-400/30 backdrop-blur-md text-white border border-white/30 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-400/40 transition-all"
                      >
                        <Plus size={20} />
                        Request Personal Leave
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-orange-400/20 rounded-full blur-2xl"></div>
          </div>

          {/* Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-orange-500" />
                  Leave Balances
                </h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leaveData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {leaveData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {leaveData.map(item => (
                  <div key={item.name} className="text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.name}</p>
                    <p className="text-sm font-black text-zinc-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Timer size={18} className="text-orange-500" />
                  Weekly Activity
                </h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="hours" fill="#ff8c00" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-center text-zinc-400 mt-4 font-medium">
                {attendance.length > 0 ? `Last check-in: ${formatDate(attendance[0].checkIn.toDate())}` : 'No attendance records yet'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Performance</p>
              <p className="text-2xl font-black text-orange-500">{user?.performanceScore}%</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Salary</p>
              <p className="text-2xl font-black text-zinc-900">${user?.salary.toLocaleString()}</p>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <ListTodo size={18} className="text-orange-500" />
                Daily Tasks
              </h3>
            </div>
            <form onSubmit={addTask} className="mb-6">
              <div className="relative">
                <input 
                  name="taskTitle"
                  type="text" 
                  placeholder="Add a new task..." 
                  className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all">
                  <Plus size={16} />
                </button>
              </div>
            </form>
            <div className="flex-1 space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-400 font-medium">No tasks for today</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => toggleTask(task.id!, task.completed)}
                    className={cn(
                      "group flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                      task.completed ? "bg-zinc-50 border-zinc-100 opacity-60" : "bg-white border-zinc-100 hover:border-orange-200"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      task.completed ? "bg-orange-500 border-orange-500 text-white" : "border-zinc-300 group-hover:border-orange-400"
                    )}>
                      {task.completed && <CheckCircle2 size={12} />}
                    </div>
                    <span className={cn("text-sm font-medium", task.completed ? "line-through text-zinc-400" : "text-zinc-700")}>
                      {task.title}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
          <h2 className="text-xl font-black text-zinc-900">Recent Leave Requests</h2>
          <button className="text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Duration</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reason</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {requests.slice(0, 5).map((request) => (
                <tr key={request.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                        <Briefcase size={16} />
                      </div>
                      <span className="font-bold text-zinc-900">{request.leaveType}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-zinc-700">{formatDate(request.startDate.toDate())}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">To {formatDate(request.endDate.toDate())}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm text-zinc-500 max-w-xs truncate font-medium">{request.reason}</p>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Modal */}
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
                <h2 className="text-2xl font-black text-zinc-900">Apply for Leave</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmitLeave} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                  >
                    {['Annual', 'Sick', 'Casual', 'Short'].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Reason</label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all resize-none font-medium"
                    placeholder="Briefly explain the reason for your leave..."
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
                    {submitting ? 'Submitting...' : 'Submit Request'}
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
