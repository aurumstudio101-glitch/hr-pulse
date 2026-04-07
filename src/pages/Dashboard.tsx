import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, Plus, 
  ArrowUpRight, ArrowDownRight, Timer, ListTodo,
  TrendingUp, Briefcase, UserCheck, ShieldCheck, Trash2, Camera,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { LeaveRequest, AttendanceRecord, Task, LeaveType, UserProfile } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

import { useAuth } from '../hooks/useAuth';
import * as supabaseService from '../services/supabaseService';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, uid } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveImage, setLeaveImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [calendarDate, setCalendarDate] = useState(new Date());

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

  const loadData = async () => {
    if (!uid || !user) return;
    setLoading(true);
    try {
      const isManagement = user.role === 'hr' || user.role === 'owner' || user.role === 'super';
      
      const [empData, leaveData, attendanceData, taskData] = await Promise.all([
        supabaseService.getEmployees(),
        supabaseService.getLeaves(isManagement ? undefined : uid),
        supabaseService.getAttendance(isManagement ? undefined : uid),
        supabaseService.getTasks(uid)
      ]);

      setEmployees(empData);
      setRequests(leaveData);
      setAttendance(attendanceData);
      setTasks(taskData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // In a real app with Supabase, we would set up real-time subscriptions here
    // For now, we'll use a standard fetch to get the migration working.
  }, [uid, user?.role]);

  // Live Performance Calculation logic (mirrors Performance page)
  const getLiveMetrics = (targetUid: string) => {
    const empAttendance = attendance.filter(a => a.userId === targetUid);
    const empTasks = tasks.filter(t => t.userId === targetUid);
    
    const totalLogs = empAttendance.length;
    const lateLogs = empAttendance.filter(a => a.isLate).length;
    const punctuality = totalLogs > 0 ? Math.round(((totalLogs - lateLogs) / totalLogs) * 100) : 100;

    const finishedTasks = empTasks.filter(t => t.completed).length;
    const efficiency = empTasks.length > 0 ? Math.round((finishedTasks / empTasks.length) * 100) : 0;

    const reliability = totalLogs > 0 ? Math.round((empAttendance.filter(a => a.checkOut).length / totalLogs) * 100) : 100;
    
    return Math.round((punctuality + efficiency + reliability) / 3) || 85;
  };

  const currentPerformance = user ? getLiveMetrics(user.uid) : 85;

  const getLocalToday = () => {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Colombo', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(currentTime);
  };

  const todayStr = getLocalToday();
  const todayRecord = attendance.find(r => r.date === todayStr);
  const isCheckedIn = !!todayRecord;
  const isCheckedOut = !!todayRecord?.checkOut;

  const handleCheckIn = async () => {
    if (!uid) return;
    const success = await supabaseService.checkIn(uid);
    if (success) {
      toast.success('Checked in successfully!');
      loadData();
    } else {
      toast.error('Already checked in today');
    }
  };

  const handleCheckOut = async () => {
    if (!uid) return;
    const success = await supabaseService.checkOut(uid);
    if (success) {
      toast.success('Checked out successfully!');
      loadData();
    } else {
      toast.error('Failed to check out');
    }
  };

  const toggleTask = async (id: string) => {
    await supabaseService.toggleTask(id);
    loadData();
  };

  const deleteTask = async (id: string) => {
    await supabaseService.deleteTask(id);
    loadData();
  };

  const addTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const title = (form.elements.namedItem('taskTitle') as HTMLInputElement).value;
    if (!title || !uid) return;

    await supabaseService.saveTask({
      userId: uid,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    form.reset();
    toast.success('Task added');
    loadData();
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !user) return;
    
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
      const leaveData: any = {
        userId: uid,
        userName: user.name,
        userRole: user.role,
        leaveType,
        reason,
        startDate: startDate,
        endDate: endDate,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        imageUrl: leaveImage || null
      };
      
      await supabaseService.saveLeave(leaveData);
      
      toast.success('Leave request submitted successfully!');
      setIsModalOpen(false);
      setReason('');
      setStartDate('');
      setEndDate('');
      setLeaveImage(null);
      loadData();
    } catch (error: any) {
      console.error('Leave submission error:', error);
      toast.error(error.message || 'Failed to submit leave request. Please check your data.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLeaveImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
      <div className="bg-white p-6 rounded-4xl border border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-zinc-900 flex items-center gap-2">
            <CalendarIcon size={18} className="text-orange-500" />
            {monthNames[month]} {year}
          </h3>
          <div className="flex gap-1">
            <button 
              onClick={() => setCalendarDate(new Date(year, month - 1))}
              className="p-1.5 hover:bg-zinc-50 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setCalendarDate(new Date(year, month + 1))}
              className="p-1.5 hover:bg-zinc-50 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <span key={d} className="text-[10px] font-bold text-zinc-400 uppercase">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => (
            <div 
              key={i} 
              className={cn(
                "aspect-square flex items-center justify-center text-xs font-bold rounded-xl transition-all",
                !day ? "invisible" : "hover:bg-orange-50 cursor-default",
                day === today.getDate() && month === today.getMonth() && year === today.getFullYear() 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-200" 
                  : "text-zinc-600"
              )}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getManagementStats = () => {
    const todayStr = getLocalToday();
    const activeNow = attendance.filter(a => a.date === todayStr && !a.checkOut).length;
    const pendingRequests = requests.filter(r => r.status === 'Pending').length;
    
    // Average company performance
    const allScores = employees.map(e => getLiveMetrics(e.uid));
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : 85;

    return { totalStaff: employees.length, activeNow, pendingRequests, avgScore };
  };

  const mStats = getManagementStats();

  const attendanceData = [
    { day: 'Mon', hours: 0 },
    { day: 'Tue', hours: 0 },
    { day: 'Wed', hours: 0 },
    { day: 'Thu', hours: 0 },
    { day: 'Fri', hours: 0 },
  ];

  // Map real attendance to the weekly chart
  attendance.slice(0, 30).forEach(r => {
    const date = new Date(r.date);
    const dayName = date.toLocaleDateString([], { weekday: 'short' });
    const match = attendanceData.find(d => d.day === dayName);
    if (match && r.checkIn && r.checkOut) {
      const diff = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
      match.hours = Math.max(match.hours, Math.round((diff / (1000 * 60 * 60)) * 10) / 10);
    }
  });

  if (loading) return <div className="p-8 text-center text-zinc-400 font-bold">Syncing HR Pulse...</div>;

  const greeting = getGreeting();
  const isAdmin = user?.role === 'owner' || user?.role === 'super' || user?.role === 'hr';

  return (
    <div className="space-y-8 pb-12">
      {/* 🚀 Role-Aware Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-linear-to-br from-zinc-900 to-zinc-800 rounded-4xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">{greeting.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-black">{greeting.text}, {user?.name.split(' ')[0]}!</h1>
                      <p className="text-zinc-400 font-bold uppercase tracking-wider text-xs">
                        {isAdmin ? `${user?.role.toUpperCase()} • Company Access Active` : `${user?.role.toUpperCase()} • Personal Workspace`}
                      </p>
                    </div>
                    <div className="text-right hidden md:block border-l border-white/10 pl-6">
                      <p className="text-5xl font-black tracking-tighter tabular-nums">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{currentTime.toLocaleDateString([], { weekday: 'long' })}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {isAdmin ? (
                  <>
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Staff</p>
                      <p className="text-2xl font-black">{mStats.totalStaff}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Active Now</p>
                      <p className="text-2xl font-black text-green-400">{mStats.activeNow}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Pending Requests</p>
                      <p className="text-2xl font-black text-orange-400">{mStats.pendingRequests}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Performance</p>
                    <p className="text-2xl font-black text-orange-400">{currentPerformance}%</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Net Pay</p>
                    <p className="text-2xl font-black">LKR {user?.net.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Remaining Leaves</p>
                    <p className="text-2xl font-black text-blue-400">{user?.leaveQuotas.annual - user?.usedLeaves.annual} d</p>
                  </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                {!isAdmin ? (
                  <>
                    {!(attendance.find(r => r.date === getLocalToday())) ? (
                      <button 
                        onClick={handleCheckIn}
                        className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-900/20"
                      >
                        <ArrowUpRight size={20} />
                        Check In Now
                      </button>
                    ) : !(attendance.find(r => r.date === getLocalToday() && r.checkOut)) ? (
                      <button 
                        onClick={handleCheckOut}
                        className="bg-white text-zinc-900 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all shadow-lg"
                      >
                        <ArrowDownRight size={20} />
                        Check Out
                      </button>
                    ) : (
                      <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                        <CheckCircle2 size={20} />
                        Shift Logged
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex gap-4">
                    <div className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-900/20">
                      <ShieldCheck size={20} />
                      Management Mode
                    </div>
                    {(user?.role === 'owner' || user?.role === 'super') && (
                      <div className="bg-white/10 border border-white/10 px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                        <TrendingUp size={20} className="text-green-400" />
                        Avg Performance: {mStats.avgScore}%
                      </div>
                    )}
                  </div>
                )}
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/20 transition-all"
                >
                  <Plus size={20} />
                  New Request
                </button>
              </div>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-orange-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-4xl border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2 text-sm uppercase tracking-widest">
                  <TrendingUp size={16} className="text-orange-500" />
                  {isAdmin ? 'Company Resources' : 'My Leave Status'}
                </h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={user ? [
                        { name: 'Annual', value: user.leaveQuotas.annual - user.usedLeaves.annual, color: '#f97316' },
                        { name: 'Sick', value: user.leaveQuotas.sick - user.usedLeaves.sick, color: '#ef4444' },
                        { name: 'Casual', value: user.leaveQuotas.casual - user.usedLeaves.casual, color: '#3b82f6' },
                        { name: 'Used', value: Object.values(user.usedLeaves || {}).reduce((a: number, b: number) => a + b, 0), color: '#f4f4f5' },
                      ] : []}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { color: '#f97316' },
                        { color: '#ef4444' },
                        { color: '#3b82f6' },
                        { color: '#f4f4f5' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-4xl border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2 text-sm uppercase tracking-widest">
                  <Timer size={16} className="text-orange-500" />
                  {isAdmin ? 'System Load' : 'Weekly Activity'}
                </h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="hours" fill="#18181b" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Peek */}
          <div className="bg-zinc-900 p-6 rounded-4xl text-white shadow-xl shadow-zinc-200">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
              <ShieldCheck size={16} className="text-orange-500" />
              Company Health
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Attendance</span>
                <span className={cn(
                  "font-black",
                  mStats.activeNow / (mStats.totalStaff || 1) > 0.8 ? "text-green-400" : "text-orange-400"
                )}>
                  {Math.round((mStats.activeNow / (mStats.totalStaff || 1)) * 100)}% Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Leave Volume</span>
                <span className={cn(
                  "font-black",
                  mStats.pendingRequests > 5 ? "text-red-400" : mStats.pendingRequests > 2 ? "text-orange-400" : "text-green-400"
                )}>
                  {mStats.pendingRequests > 5 ? 'High Load' : mStats.pendingRequests > 2 ? 'Moderate' : 'Normal'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Performance</span>
                <span className="font-black text-white">{isAdmin ? `${mStats.avgScore}% avg` : `${currentPerformance}%`}</span>
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="bg-white p-6 rounded-4xl border border-zinc-100 shadow-sm flex flex-col">
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
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-400 font-medium">No tasks for today</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "group flex items-center gap-3 p-4 rounded-2xl border transition-all",
                      task.completed ? "bg-zinc-50 border-zinc-100 opacity-60" : "bg-white border-zinc-100 hover:border-orange-200"
                    )}
                  >
                    <div 
                      onClick={() => toggleTask(task.id!)}
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer",
                        task.completed ? "bg-orange-500 border-orange-500 text-white" : "border-zinc-300 group-hover:border-orange-400"
                      )}
                    >
                      {task.completed && <CheckCircle2 size={12} />}
                    </div>
                    <span 
                      onClick={() => toggleTask(task.id!)}
                      className={cn("flex-1 text-sm font-medium cursor-pointer", task.completed ? "line-through text-zinc-400" : "text-zinc-700")}
                    >
                      {task.title}
                    </span>
                    <button 
                      onClick={() => deleteTask(task.id!)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calendar Widget */}
          {renderCalendar()}
        </div>
      </div>

      {/* Leave History Table */}
      <div className="bg-white rounded-4xl border border-zinc-100 shadow-sm overflow-hidden">
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
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-zinc-400 font-medium">No leave requests found</td>
                </tr>
              ) : (
                requests.slice(0, 5).map((request) => (
                  <tr key={request.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{request.leaveType}</p>
                          {isAdmin && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{request.userName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-zinc-700">{formatDate(request.startDate)}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">To {formatDate(request.endDate)}</p>
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
                ))
              )}
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
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Attachment (Optional)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="leave-image"
                    />
                    <label
                      htmlFor="leave-image"
                      className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer group"
                    >
                      <Camera size={20} className="text-zinc-400 group-hover:text-orange-500" />
                      <span className="text-sm font-bold text-zinc-500 group-hover:text-orange-600">
                        {leaveImage ? 'Image Selected' : 'Upload Image/Document'}
                      </span>
                    </label>
                    {leaveImage && (
                      <div className="mt-4 relative inline-block">
                        <img src={leaveImage} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-zinc-100" />
                        <button 
                          type="button"
                          onClick={() => setLeaveImage(null)}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </div>
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
