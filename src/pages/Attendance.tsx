import React, { useState, useEffect } from 'react';
import { 
  Clock, ArrowUpRight, ArrowDownRight, Calendar, 
  UserCheck, Timer, Search, Filter, Download
} from 'lucide-react';
import { AttendanceRecord, UserProfile } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function Attendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isManagement = user.role === 'hr' || user.role === 'owner' || user.role === 'super';
      const [empData, attData] = await Promise.all([
        supabaseService.getEmployees(),
        supabaseService.getAttendance(isManagement ? undefined : user.uid)
      ]);
      setEmployees(empData);
      setRecords(attData);
    } catch (err) {
      console.error('Error loading attendance data:', err);
      toast.error('Failed to sync attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid, user?.role]);

  const branches = ['All', ...new Set(employees.map(e => e.branch))];

  const filteredRecords = records.filter(r => {
    const emp = employees.find(e => e.uid === r.userId);
    const matchesSearch = emp ? emp.name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchesBranch = filterBranch === 'All' || (emp ? emp.branch === filterBranch : true);
    return matchesSearch && matchesBranch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getEmpName = (uid: string) => employees.find(e => e.uid === uid)?.name || 'Unknown';

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Attendance Log</h1>
          <p className="text-zinc-500 font-medium">Track daily work hours and shifts</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {user?.role === 'employee' && (
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  if (await supabaseService.checkIn(user.uid)) {
                    toast.success('Checked in!');
                    loadData();
                  } else {
                    toast.error('Already checked in today');
                  }
                }}
                className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
              >
                <ArrowUpRight size={18} />
                Check In
              </button>
              <button 
                onClick={async () => {
                  if (await supabaseService.checkOut(user.uid)) {
                    toast.success('Checked out!');
                    loadData();
                  } else {
                    toast.error('No active shift found');
                  }
                }}
                className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg"
              >
                <ArrowDownRight size={18} />
                Check Out
              </button>
            </div>
          )}
          <button className="bg-white border border-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all">
            <Download size={18} />
            Export Logs
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <UserCheck size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Logs</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{records.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <Clock size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Late Check-ins</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{records.filter(r => r.isLate).length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <Timer size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Completed Shifts</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{records.filter(r => r.checkOut).length}</p>
        </div>
      </div>

      {/* Filters (Only for Admin/HR) */}
      {(user?.role !== 'employee') && (
        <div className="bg-white p-4 rounded-4xl border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by employee name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
          <select 
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-orange-500"
          >
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-white rounded-4xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Check In</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Check Out</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-black text-xs">
                        {getEmpName(record.userId).charAt(0)}
                      </div>
                      <span className="font-bold text-zinc-900">{getEmpName(record.userId)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                      <Calendar size={14} className="text-zinc-400" />
                      {formatDate(record.date)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight size={14} className={record.isLate ? "text-red-500" : "text-green-500"} />
                      <span className={cn("text-sm font-black", record.isLate ? "text-red-600" : "text-zinc-900")}>
                        {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {record.isLate && <span className="text-[8px] font-black uppercase bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Late</span>}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight size={14} className={record.isEarlyOut ? "text-amber-500" : "text-blue-500"} />
                      <span className="text-sm font-black text-zinc-900">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                      {record.isEarlyOut && <span className="text-[8px] font-black uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Early</span>}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      record.checkOut ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {record.checkOut ? 'Completed' : 'Active'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
