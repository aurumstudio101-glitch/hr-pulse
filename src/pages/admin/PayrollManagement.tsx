import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { 
  collection, query, onSnapshot, addDoc, doc, 
  orderBy, where, getDocs, serverTimestamp, updateDoc, deleteDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  CreditCard, Search, DollarSign, Download, 
  Calendar as CalendarIcon, CheckCircle, 
  AlertCircle, TrendingUp, Filter, User, Plus, Trash2, Edit2, X, Save
} from 'lucide-react';
import { PayrollRecord, UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';

export default function PayrollManagement() {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [submitting, setSubmitting] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  const [payrollInputs, setPayrollInputs] = useState<Record<string, Partial<PayrollRecord>>>({});

  const branches = ['All', 'Borella', 'Dehiwela', 'Dematagoda', 'Homagama', 'Kadawatha', 'Kiribathgoda', 'Kottawa', 'Office', 'Panadura', 'W2', 'W3', 'W4'];

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'owner' && user.role !== 'hr' && user.role !== 'super')) {
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

    const q = query(collection(db, 'users'), where('role', '==', 'employee'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });
    return () => unsubscribe();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setPayrollHistory([
        { id: 'pay-1', userId: 'employee-uid', userName: 'Employee User', branch: 'Main', startDate: new Date() as any, month: new Date().getMonth() + 1, year: new Date().getFullYear(), salaryA: 3000, salaryB: 2000, epf: 400, advances: 0, coverDedication: 0, intensive: 500, travelling: 0, netSalary: 5100, status: 'Paid', createdAt: new Date() as any }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'payroll'), orderBy('year', 'desc'), orderBy('month', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPayrollHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayrollRecord[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (empId: string, field: keyof PayrollRecord, value: any) => {
    setPayrollInputs(prev => {
      const current = prev[empId] || {};
      const updated = { ...current, [field]: value };
      
      // Recalculate Net Salary
      const sA = Number(updated.salaryA || 0);
      const sB = Number(updated.salaryB || 0);
      const intensive = Number(updated.intensive || 0);
      const travelling = Number(updated.travelling || 0);
      const epf = Number(updated.epf || 0);
      const advances = Number(updated.advances || 0);
      const coverDedication = Number(updated.coverDedication || 0);
      
      updated.netSalary = (sA + sB + intensive + travelling) - (epf + advances + coverDedication);
      
      return { ...prev, [empId]: updated };
    });
  };

  const initializeInputs = () => {
    const inputs: Record<string, Partial<PayrollRecord>> = {};
    employees.forEach(emp => {
      inputs[emp.uid] = {
        salaryA: emp.salary || 0,
        salaryB: emp.salaryB || 0,
        epf: (emp.salary || 0) * 0.08, // Default 8% EPF
        advances: 0,
        coverDedication: 0,
        intensive: 0,
        travelling: 0,
        netSalary: (emp.salary || 0) + (emp.salaryB || 0) - ((emp.salary || 0) * 0.08)
      };
    });
    setPayrollInputs(inputs);
    setShowInputForm(true);
  };

  const handleGeneratePayroll = async () => {
    setSubmitting(true);
    try {
      // Check if already generated
      const q = query(
        collection(db, 'payroll'), 
        where('month', '==', selectedMonth),
        where('year', '==', selectedYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        if (!confirm("Payroll for this month already exists. Do you want to overwrite?")) {
          setSubmitting(false);
          return;
        }
        // Delete existing
        const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'payroll', d.id)));
        await Promise.all(deletePromises);
      }

      const payrollPromises = employees.map(async (emp) => {
        const input = payrollInputs[emp.uid] || {};
        
        const record: Omit<PayrollRecord, 'id'> = {
          userId: emp.uid,
          userName: emp.name,
          branch: emp.branch || 'Office',
          startDate: emp.startDate || serverTimestamp() as any,
          month: selectedMonth,
          year: selectedYear,
          salaryA: Number(input.salaryA || 0),
          salaryB: Number(input.salaryB || 0),
          epf: Number(input.epf || 0),
          advances: Number(input.advances || 0),
          coverDedication: Number(input.coverDedication || 0),
          intensive: Number(input.intensive || 0),
          travelling: Number(input.travelling || 0),
          netSalary: Number(input.netSalary || 0),
          status: 'Paid',
          createdAt: serverTimestamp() as any,
        };

        return addDoc(collection(db, 'payroll'), record);
      });

      await Promise.all(payrollPromises);
      toast.success('Payroll generated successfully');
      setShowInputForm(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (filteredHistory.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Month', 'Year', 'Employee Name', 'Branch', 'Start Date', 
      'Salary-A', 'Salary-B', 'EPF', 'Advances', 'Cover Dedication', 
      'Intensive', 'Travelling', 'Net Salary'
    ];

    const rows = filteredHistory.map(record => [
      record.month,
      record.year,
      record.userName,
      record.branch || 'N/A',
      record.startDate || 'N/A',
      record.salaryA,
      record.salaryB,
      record.epf,
      record.advances,
      record.coverDedication,
      record.intensive,
      record.travelling,
      record.netSalary
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payroll exported successfully');
  };

  const filteredHistory = payrollHistory.filter(p => {
    const matchesSearch = p.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.branch.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranch === 'All' || p.branch === selectedBranch;
    const matchesMonth = p.month === selectedMonth;
    const matchesYear = p.year === selectedYear;
    return matchesSearch && matchesBranch && matchesMonth && matchesYear;
  });

  const totals = filteredHistory.reduce((acc, curr) => ({
    salaryA: acc.salaryA + curr.salaryA,
    salaryB: acc.salaryB + curr.salaryB,
    epf: acc.epf + curr.epf,
    advances: acc.advances + curr.advances,
    coverDedication: acc.coverDedication + curr.coverDedication,
    intensive: acc.intensive + curr.intensive,
    travelling: acc.travelling + curr.travelling,
    netSalary: acc.netSalary + curr.netSalary,
  }), { salaryA: 0, salaryB: 0, epf: 0, advances: 0, coverDedication: 0, intensive: 0, travelling: 0, netSalary: 0 });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Payroll Management</h1>
          <p className="text-zinc-500 font-medium tracking-tight">Manage salaries, incentives, and deductions</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-4 py-3 rounded-xl bg-white border border-zinc-200 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-3 rounded-xl bg-white border border-zinc-200 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={initializeInputs}
            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
          >
            <Plus size={20} />
            Generate Monthly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Net Salary</p>
          <p className="text-2xl font-black text-zinc-900">Rs. {totals.netSalary.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total EPF</p>
          <p className="text-2xl font-black text-zinc-900">Rs. {totals.epf.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Incentives</p>
          <p className="text-2xl font-black text-zinc-900">Rs. {totals.intensive.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Travelling</p>
          <p className="text-2xl font-black text-zinc-900">Rs. {totals.travelling.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
            <select 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full md:w-48 px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 text-zinc-500 hover:text-orange-600 font-bold text-sm transition-all"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Branch</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Team Member</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Salary-A</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Salary-B</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">EPF</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Advances</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Intensive</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Travelling</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Salary Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredHistory.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-zinc-500">{record.branch}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-zinc-900">{record.userName}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{record.salaryA.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{record.salaryB.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-red-500">({record.epf.toLocaleString()})</td>
                  <td className="px-6 py-4 text-sm text-red-500">({record.advances.toLocaleString()})</td>
                  <td className="px-6 py-4 text-sm text-green-600">{record.intensive.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{record.travelling.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-black text-zinc-900">{record.netSalary.toLocaleString()}</td>
                </tr>
              ))}
              {filteredHistory.length > 0 && (
                <tr className="bg-zinc-50/80 font-black">
                  <td colSpan={2} className="px-6 py-4 text-sm text-zinc-900 text-right">TOTALS:</td>
                  <td className="px-6 py-4 text-sm text-zinc-900">{totals.salaryA.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-zinc-900">{totals.salaryB.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-red-600">({totals.epf.toLocaleString()})</td>
                  <td className="px-6 py-4 text-sm text-red-600">({totals.advances.toLocaleString()})</td>
                  <td className="px-6 py-4 text-sm text-green-600">{totals.intensive.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-zinc-900">{totals.travelling.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-orange-600">{totals.netSalary.toLocaleString()}</td>
                </tr>
              )}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <CreditCard size={48} strokeWidth={1} />
                      <p className="font-medium">No payroll records found for this period</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Modal */}
      <AnimatePresence>
        {showInputForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900">Generate Monthly Payroll</h2>
                  <p className="text-zinc-500 font-medium">Input variables for {new Date(0, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}</p>
                </div>
                <button 
                  onClick={() => setShowInputForm(false)}
                  className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                      <th className="pb-4 pr-4">Employee</th>
                      <th className="pb-4 px-2">Salary-A</th>
                      <th className="pb-4 px-2">Salary-B</th>
                      <th className="pb-4 px-2">EPF</th>
                      <th className="pb-4 px-2">Advances</th>
                      <th className="pb-4 px-2">Cover Ded.</th>
                      <th className="pb-4 px-2">Intensive</th>
                      <th className="pb-4 px-2">Travelling</th>
                      <th className="pb-4 pl-4 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {employees.map(emp => {
                      const input = payrollInputs[emp.uid] || {};
                      return (
                        <tr key={emp.uid}>
                          <td className="py-4 pr-4">
                            <p className="text-sm font-bold text-zinc-900">{emp.name}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">{emp.branch}</p>
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.salaryA || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'salaryA', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.salaryB || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'salaryB', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.epf || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'epf', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.advances || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'advances', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.coverDedication || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'coverDedication', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.intensive || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'intensive', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 px-1">
                            <input 
                              type="number" 
                              value={input.travelling || 0}
                              onChange={(e) => handleInputChange(emp.uid, 'travelling', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-4 pl-4 text-right">
                            <p className="text-sm font-black text-zinc-900">{(input.netSalary || 0).toLocaleString()}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-8 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-4">
                <button 
                  onClick={() => setShowInputForm(false)}
                  className="px-8 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGeneratePayroll}
                  disabled={submitting}
                  className="px-12 py-4 rounded-2xl bg-orange-500 text-white font-black hover:bg-orange-600 transition-all shadow-xl shadow-orange-100 flex items-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-b-white rounded-full animate-spin" /> : <Save size={20} />}
                  Confirm & Generate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
