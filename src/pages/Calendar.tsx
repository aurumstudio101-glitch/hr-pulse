import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Briefcase, Sun, Info } from 'lucide-react';
import { LeaveRequest, Holiday } from '../types';
import { cn, formatDate } from '../lib/utils';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  eachDayOfInterval 
} from 'date-fns';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demoUserStr = localStorage.getItem('hr_pulse_demo_user');
    const demoUser = demoUserStr ? JSON.parse(demoUserStr) : null;

    if (!db && !demoUser) return;

    if (demoUser) {
      setLeaves([]);
      setHolidays([]);
      setLoading(false);
      return;
    }

    // Fetch all approved leaves for calendar
    const qLeaves = query(
      collection(db, 'leaveRequests'),
      where('status', '==', 'Approved')
    );
    const unsubLeaves = onSnapshot(qLeaves, (snap) => {
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LeaveRequest[]);
    }, (error) => {
      console.error("Error fetching leaves for calendar:", error);
    });

    // Fetch holidays
    const qHolidays = query(collection(db, 'holidays'), orderBy('date', 'asc'));
    const unsubHolidays = onSnapshot(qHolidays, (snap) => {
      setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Holiday[]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching holidays:", error);
      setLoading(false);
    });

    return () => {
      unsubLeaves();
      unsubHolidays();
    };
  }, []);

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">{format(currentMonth, 'MMMM yyyy')}</h1>
          <p className="text-zinc-500 font-medium">Company events and leave schedule</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-3 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-6 py-3 bg-white border border-zinc-100 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all shadow-sm"
          >
            Today
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-3 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, 'yyyy-MM-dd');
        const dayHolidays = holidays.filter(h => h.date === formattedDate);
        const dayLeaves = leaves.filter(l => {
          const start = l.startDate.toDate();
          const end = l.endDate.toDate();
          return isSameDay(day, start) || isSameDay(day, end) || (day > start && day < end);
        });

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] p-3 border border-zinc-50 transition-all relative",
              !isSameMonth(day, monthStart) ? "bg-zinc-50/30 text-zinc-300" : "bg-white text-zinc-900",
              isSameDay(day, new Date()) && "bg-orange-50/30 ring-1 ring-inset ring-orange-200"
            )}
          >
            <span className={cn(
              "text-sm font-bold",
              isSameDay(day, new Date()) && "text-orange-600"
            )}>
              {format(day, 'd')}
            </span>
            
            <div className="mt-2 space-y-1">
              {dayHolidays.map(h => (
                <div key={h.id} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-tighter rounded-md flex items-center gap-1">
                  <Sun size={10} />
                  {h.title}
                </div>
              ))}
              {dayLeaves.map(l => (
                <div key={l.id} className="px-2 py-1 bg-orange-50 text-orange-700 text-[9px] font-black uppercase tracking-tighter rounded-md flex items-center gap-1 truncate">
                  <Briefcase size={10} />
                  {l.userName}
                </div>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden">{rows}</div>;
  };

  return (
    <div className="space-y-8 pb-12">
      {renderHeader()}
      <div className="bg-white p-2 rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        {renderDays()}
        {renderCells()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Info size={18} className="text-orange-500" />
            Legend
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-orange-50 border border-orange-100 rounded"></div>
              <span className="text-xs font-bold text-zinc-600">Employee Leave</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-indigo-50 border border-indigo-100 rounded"></div>
              <span className="text-xs font-bold text-zinc-600">Public Holiday</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-xs font-bold text-zinc-600">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
