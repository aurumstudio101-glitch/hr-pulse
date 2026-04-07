import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  MapPin, Clock, Info, Gift, PartyPopper, Moon
} from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { LeaveRequest, Holiday } from '../types';
import * as supabaseService from '../services/supabaseService';

export default function Calendar() {
  const { user, uid } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await supabaseService.getLeaves(uid);
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading leaves for calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [uid]);

  // 2. Internet Holiday Sync (Sri Lanka)
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/LK`);
        if (response.ok) {
          const data = await response.json();
          setHolidays(data.map((h: any, i: number) => ({
            id: `h-${i}`,
            date: h.date,
            title: h.localName || h.name,
            type: h.types.includes('Public') ? 'Public' : 'Other'
          })));
        }
      } catch (err) {
        console.error('Holiday fetch error:', err);
      }
    };

    fetchHolidays();
  }, [year]);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => i);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to check if a specific day is a holiday or on leave
  const getDayInfo = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const holiday = holidays.find(h => h.date === dateStr);
    const userLeave = requests.find(r => {
      const start = r.startDate;
      const end = r.endDate;
      return dateStr >= start && dateStr <= end;
    });

    return { holiday, userLeave };
  };

  const nextMonth = () => {
    if (month === 11) return; // Restrict to current year
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const prevMonth = () => {
    if (month === 0) return; // Restrict to current year
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const upcomingHolidays = holidays
    .filter(h => new Date(h.date) >= new Date())
    .slice(0, 4);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Personal Calendar</h1>
          <p className="text-zinc-500 font-medium">{year} Sri Lankan Holidays & Personal Leaves</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm">
          <button 
            onClick={prevMonth} 
            disabled={month === 0}
            className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-zinc-900 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-black text-zinc-900 min-w-[120px] text-center">
            {monthNames[month]} {year}
          </span>
          <button 
            onClick={nextMonth} 
            disabled={month === 11}
            className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-zinc-900 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {blanks.map(b => <div key={`blank-${b}`} className="aspect-square" />)}
            {days.map(day => {
              const { holiday, userLeave } = getDayInfo(day);
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              
              return (
                <div 
                  key={day} 
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all group cursor-default border border-transparent",
                    isToday ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" : "hover:bg-zinc-50",
                    holiday ? "bg-orange-50/50 border-orange-100" : "",
                    userLeave ? (userLeave.status === 'Approved' ? "bg-green-50/50 border-green-100" : "bg-amber-50/50 border-amber-100") : ""
                  )}
                >
                  <span className={cn(
                    "text-sm font-black", 
                    holiday && !isToday ? "text-orange-600" : "",
                    userLeave && !isToday ? (userLeave.status === 'Approved' ? "text-green-600" : "text-amber-600") : ""
                  )}>
                    {day}
                  </span>
                  
                  <div className="absolute bottom-2 flex gap-1 items-center">
                    {holiday && (
                      <div className="w-1 h-1 rounded-full bg-orange-500 shadow-sm" />
                    )}
                    {userLeave && (
                      <div className={cn(
                        "w-1 h-1 rounded-full shadow-sm",
                        userLeave.status === 'Approved' ? "bg-green-500" : "bg-amber-500"
                      )} />
                    )}
                  </div>

                  {(holiday || userLeave) && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-40 p-2 bg-zinc-900 text-white text-[10px] font-bold rounded-lg text-center shadow-xl leading-snug">
                      {holiday && <p className="text-orange-400">🌕 {holiday.title}</p>}
                      {userLeave && <p className={userLeave.status === 'Approved' ? "text-green-400" : "text-amber-400"}>
                        {userLeave.status === 'Approved' ? '✅' : '⏳'} {userLeave.leaveType} {(userLeave.status)}
                      </p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events List */}
        <div className="space-y-6">
          <div className="bg-zinc-900 p-8 rounded-[2.5rem] text-white">
            <div className="flex items-center gap-3 mb-6">
              <PartyPopper className="text-orange-400" size={24} />
              <h3 className="font-black text-lg">Internet Sync</h3>
            </div>
            <div className="space-y-6">
              {upcomingHolidays.length === 0 ? (
                <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest text-center py-4">No holidays found</p>
              ) : (
                upcomingHolidays.map((h, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex flex-col items-center justify-center shrink-0 border border-white/5">
                      <span className="text-[10px] font-black uppercase text-orange-400">
                        {new Date(h.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black leading-none">
                        {new Date(h.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight">{h.title}</h4>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">SL Public Holiday</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-zinc-400" size={20} />
              <h3 className="font-black text-zinc-900">Personal View</h3>
            </div>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              This calendar automatically pulls official Sri Lankan holidays for **{year}**. Your submitted leave requests are also mapped here with real-time status updates:
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Approved Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Pending Status</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Public Holiday</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
