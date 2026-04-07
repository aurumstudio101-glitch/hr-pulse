import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Award, Target, Zap, 
  Star, AlertCircle, CheckCircle2, BarChart3
} from 'lucide-react';
import { PerformanceRecord, UserProfile, AttendanceRecord, Task } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { toast } from 'sonner';

export default function Performance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<UserProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadEmps = async () => {
      try {
        const emps = await supabaseService.getEmployees();
        setEmployees(emps || []);
        if (!selectedEmp && emps && emps.length > 0) {
          const initial = user?.role === 'employee' ? emps.find(e => e.uid === user.uid) || emps[0] : emps[0];
          setSelectedEmp(initial);
        }
      } catch (err) {
        console.error('Error loading employees:', err);
      }
    };
    loadEmps();
  }, [user]);

  useEffect(() => {
    if (!selectedEmp) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [attData, taskData] = await Promise.all([
          supabaseService.getAttendance(selectedEmp.uid),
          supabaseService.getTasks(selectedEmp.uid)
        ]);
        setAttendance(attData || []);
        setTasks(taskData || []);
      } catch (err) {
        console.error('Error loading performance data:', err);
        toast.error('Failed to sync performance metrics');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedEmp]);

  // Dynamic Metrics Calculation
  const getMetrics = () => {
    // 1. Punctuality (based on 'isLate' flag in attendance)
    const totalLogs = attendance.length;
    const lateLogs = attendance.filter(a => a.isLate).length;
    const punctualityScore = totalLogs > 0 ? Math.max(0, Math.round(((totalLogs - lateLogs) / totalLogs) * 100)) : 100;

    // 2. Efficiency (based on task completion)
    const totalTasks = tasks.length;
    const finishedTasks = tasks.filter(t => t.completed).length;
    const efficiencyScore = totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0;

    // 3. Reliability (based on shifts completed vs total)
    const shiftsCompleted = attendance.filter(a => a.checkOut).length;
    const reliabilityScore = totalLogs > 0 ? Math.round((shiftsCompleted / totalLogs) * 100) : 100;

    // Composite Performance Score
    const finalScore = Math.round((punctualityScore + efficiencyScore + reliabilityScore) / 3) || 85;

    return { 
      punctuality: punctualityScore, 
      efficiency: efficiencyScore, 
      reliability: reliabilityScore, 
      final: finalScore,
      totalLogs,
      finishedTasks,
      totalTasks
    };
  };

  const metrics = getMetrics();

  // Dynamic Ranking & History Logic
  const getExtendedMetrics = () => {
    const m = getMetrics();
    
    // 1. Calculate Rank
    // In a real high-scale app, we'd use a cloud function. Here we'll compare against others.
    const allScores = employees.map(e => {
      // Very thin calculation for others to keep it fast
      const empAttendance = attendance.filter(a => a.userId === e.uid);
      const empTasks = tasks.filter(t => t.userId === e.uid);
      const totalLogs = empAttendance.length;
      const finishedTasks = empTasks.filter(t => t.completed).length;
      const attScore = totalLogs > 0 ? Math.round((empAttendance.filter(a => !a.isLate).length / totalLogs) * 100) : 100;
      const tskScore = empTasks.length > 0 ? Math.round((finishedTasks / empTasks.length) * 100) : 100;
      return { uid: e.uid, score: Math.round((attScore + tskScore) / 2) };
    }).sort((a, b) => b.score - a.score);

    const rank = allScores.findIndex(s => s.uid === selectedEmp?.uid) + 1;

    // 2. Real Score History (April Alignment)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    
    // If no real work data exists, show an empty chart as requested
    if (m.totalLogs === 0 && m.totalTasks === 0) {
      return { ...m, rank, history: [] };
    }

    const history = [
      { 
        month: months[currentMonthIdx], 
        score: m.final 
      }
    ];

    return { ...m, rank, history };
  };

  const xMetrics = getExtendedMetrics();

  const getAchievements = () => {
    const list = [];
    if (xMetrics.reliability === 100 && xMetrics.totalLogs > 0) {
      list.push({ text: "Perfect Attendance Streak", icon: CheckCircle2, color: "text-green-400" });
    }
    if (xMetrics.punctuality > 95 && xMetrics.totalLogs > 0) {
      list.push({ text: "Exceptional Punctuality", icon: Zap, color: "text-yellow-400" });
    }
    if (xMetrics.efficiency > 90 && xMetrics.totalTasks > 0) {
      list.push({ text: "High Efficiency Master", icon: Target, color: "text-blue-400" });
    }
    if (xMetrics.final > 90) {
      list.push({ text: "Top Tier Performance", icon: Award, color: "text-orange-400" });
    }
    if (list.length === 0) {
      list.push({ text: "Consistency in Progress", icon: TrendingUp, color: "text-zinc-400" });
    }
    return list;
  };

  const achievements = getAchievements();

  const performanceData = [
    { subject: 'Attendance', A: xMetrics.reliability, fullMark: 100 },
    { subject: 'Punctuality', A: xMetrics.punctuality, fullMark: 100 },
    { subject: 'Efficiency', A: xMetrics.efficiency, fullMark: 100 },
    { subject: 'Reliability', A: xMetrics.reliability, fullMark: 100 },
    { subject: 'Overall', A: xMetrics.final, fullMark: 100 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Performance Analytics</h1>
          <p className="text-zinc-500 font-medium tracking-tight">Real-time ranking and growth tracking</p>
        </div>
        {user?.role !== 'employee' && (
          <select 
            value={selectedEmp?.uid}
            onChange={(e) => setSelectedEmp(employees.find(emp => emp.uid === e.target.value) || null)}
            className="px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-sm font-black text-zinc-800 outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          >
            {employees.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border border-zinc-50 shadow-xl shadow-zinc-100/50 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="w-24 h-24 rounded-4xl bg-linear-to-br from-zinc-50 to-zinc-100 mx-auto mb-6 flex items-center justify-center text-zinc-800 font-black text-3xl shadow-inner border border-zinc-200">
              {selectedEmp?.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-black text-zinc-900 mb-1">{selectedEmp?.name}</h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-8">{selectedEmp?.role} • {selectedEmp?.branch}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100/50">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">Score</p>
                <p className="text-3xl font-black text-zinc-900">{xMetrics.final}%</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100/50">
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 text-center">Rank</p>
                <p className="text-3xl font-black text-orange-600">#{xMetrics.rank}</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-zinc-900/20">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Award className="text-orange-400" size={20} />
              </div>
              <h3 className="font-black text-xl tracking-tight">Key Achievements</h3>
            </div>
            <ul className="space-y-6">
              {achievements.map((ach, idx) => (
                <li key={idx} className="flex items-center gap-4 group">
                  <div className={cn("p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors", ach.color)}>
                    <ach.icon size={18} className="shrink-0" />
                  </div>
                  <p className="text-sm font-bold text-zinc-300">{ach.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] border border-zinc-50 shadow-xl shadow-zinc-100/50">
              <h3 className="font-black text-zinc-900 mb-8 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Target size={20} className="text-orange-500" />
                </div>
                Skill Distribution
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={performanceData}>
                    <PolarGrid stroke="#f4f4f5" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} />
                    <Radar name="Score" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-zinc-50 shadow-xl shadow-zinc-100/50">
              <h3 className="font-black text-zinc-900 mb-8 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp size={20} className="text-green-500" />
                </div>
                Score History
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={xMetrics.history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', radius: 10 }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 20px' }}
                      labelStyle={{ fontWeight: 900, color: '#18181b', marginBottom: '4px' }}
                    />
                    <Bar dataKey="score" fill="url(#barGradient)" radius={[10, 10, 10, 10]} barSize={24} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#18181b" />
                        <stop offset="100%" stopColor="#3f3f46" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Efficiency', val: `${xMetrics.efficiency}%`, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50' },
              { label: 'Punctuality', val: `${xMetrics.punctuality}%`, icon: Star, color: 'text-orange-500', bg: 'bg-orange-50' },
              { label: 'Attendance', val: `${xMetrics.reliability}%`, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
              { label: 'Reliability', val: `${xMetrics.reliability}%`, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map((m, i) => (
              <div key={i} className="bg-white p-6 rounded-4xl border border-zinc-50 shadow-lg shadow-zinc-100/50 hover:scale-[1.02] transition-transform">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm", m.bg, m.color)}>
                  <m.icon size={24} />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{m.label}</p>
                <p className="text-2xl font-black text-zinc-900">{m.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
