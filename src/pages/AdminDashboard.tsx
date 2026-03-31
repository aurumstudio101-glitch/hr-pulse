import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, query, onSnapshot, updateDoc, doc, deleteDoc, 
  orderBy, getDocs, addDoc, serverTimestamp, Timestamp, where, setDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, FileText, CheckCircle, XCircle, AlertTriangle, 
  Search, Plus, Trash2, UserPlus, Mail, Briefcase, 
  TrendingUp, Clock, Calendar as CalendarIcon, Star
} from 'lucide-react';
import { LeaveRequest, UserProfile, PayrollRecord, PerformanceRecord } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

import { useAuth } from '../hooks/useAuth';

export default function AdminDashboard() {
  const { user, uid, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'owner' && user.role !== 'hr' && user.role !== 'super')) {
      navigate('/dashboard');
      return;
    }

    // Mock data for demo users if Firestore fails or is not needed
    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    
    if (isDemo) {
      setRequests([
        {
          id: 'demo-1',
          userId: 'demo-uid',
          userName: 'John Doe',
          userRole: 'employee',
          leaveType: 'Annual',
          reason: 'Vacation',
          startDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)),
          endDate: Timestamp.fromDate(new Date(Date.now() - 86400000 * 2)),
          status: 'Pending',
          createdAt: Timestamp.now()
        }
      ] as LeaveRequest[]);
      
      setEmployees([
        { uid: 'demo-uid', name: 'John Doe', email: 'john@example.com', role: 'employee', department: 'Engineering', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 5, sick: 2, casual: 1, short: 0 }, performanceScore: 85, createdAt: Timestamp.now() },
        { uid: 'demo-uid-2', name: 'Jane Smith', email: 'jane@example.com', role: 'hr', department: 'HR', salary: 6000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 2, sick: 1, casual: 0, short: 0 }, performanceScore: 92, createdAt: Timestamp.now() }
      ] as UserProfile[]);
      
      setPayroll([
        { id: 'pay-1', userId: 'demo-uid', userName: 'John Doe', month: new Date().getMonth() + 1, year: new Date().getFullYear(), netSalary: 5000, status: 'Paid', createdAt: Timestamp.now(), branch: 'Main', salaryA: 3000, salaryB: 2000, epf: 500, advances: 0, coverDedication: 0, intensive: 500, travelling: 0 }
      ] as PayrollRecord[]);
      
      setPerformance([
        { id: 'perf-1', userId: 'demo-uid', userName: 'John Doe', evaluatorId: 'demo-uid-2', evaluatorName: 'Jane Smith', score: 85, feedback: 'Great performance', goals: ['Improve coding speed'], createdAt: Timestamp.now() }
      ] as PerformanceRecord[]);
      
      setLoading(false);
      return; // Stop here for demo users
    }

    const unsubRequests = onSnapshot(query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc')), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LeaveRequest[]);
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc')), (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });

    const unsubPayroll = onSnapshot(query(collection(db, 'payroll'), orderBy('createdAt', 'desc')), (snap) => {
      setPayroll(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayrollRecord[]);
    });

    const unsubPerformance = onSnapshot(query(collection(db, 'performance'), orderBy('createdAt', 'desc')), (snap) => {
      setPerformance(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PerformanceRecord[]);
      setLoading(false);
    });

    return () => {
      unsubRequests();
      unsubUsers();
      unsubPayroll();
      unsubPerformance();
    };
  }, []);

  const stats = [
    { label: 'Total Employees', value: employees.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/admin/employees' },
    { label: 'Pending Leaves', value: requests.filter(r => r.status === 'Pending').length, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', path: '/admin/leaves' },
    { label: 'Monthly Payroll', value: `$${payroll.filter(p => p.month === new Date().getMonth() + 1).reduce((acc, curr) => acc + curr.netSalary, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', path: '/admin/payroll' },
    { label: 'Avg Performance', value: (performance.reduce((acc, curr) => acc + curr.score, 0) / (performance.length || 1)).toFixed(1), icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50', path: '/admin/performance' },
  ];

  const chartData = [
    { name: 'Jan', count: 4 },
    { name: 'Feb', count: 7 },
    { name: 'Mar', count: employees.length },
  ];

  const departmentData = Object.entries(
    employees.reduce((acc, emp) => {
      const dept = emp.department || 'Other';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b'];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-zinc-900">Company Overview</h1>
        <p className="text-zinc-500 font-medium">Real-time analytics and system health</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => navigate(stat.path)}
            className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", stat.bg)}>
              <stat.icon className={stat.color} size={20} />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-black text-zinc-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <h3 className="text-lg font-black text-zinc-900 mb-8 flex items-center gap-2">
            <TrendingUp size={20} className="text-orange-500" />
            Growth Analytics
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#ff8c00" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2">
            <Clock size={20} className="text-orange-500" />
            Recent Activity
          </h3>
          <div className="space-y-6">
            {requests.slice(0, 5).map(req => (
              <div key={req.id} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 font-bold text-xs">
                  {req.userName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{req.userName}</p>
                  <p className="text-xs text-zinc-500 font-medium">Applied for {req.leaveType}</p>
                  <p className="text-[10px] text-zinc-400 font-bold mt-1">{formatDate(req.createdAt?.toDate() || new Date())}</p>
                </div>
              </div>
            ))}
            {requests.length === 0 && <p className="text-sm text-zinc-400 font-medium italic">No recent activity</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2">
            <Users size={20} className="text-orange-500" />
            Top Performers
          </h3>
          <div className="space-y-4">
            {employees.sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0)).slice(0, 3).map(emp => (
              <div key={emp.uid} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 font-bold">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{emp.name}</p>
                    <p className="text-xs text-zinc-500">{emp.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-orange-600 font-black">
                  <Star size={14} className="fill-orange-600" />
                  {emp.performanceScore || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2">
            <Briefcase size={20} className="text-orange-500" />
            Department Distribution
          </h3>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

