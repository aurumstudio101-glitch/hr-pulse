import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Filter, MoreVertical, Edit2, Trash2, 
  Mail, Phone, MapPin, Calendar as CalendarIcon,
  Download, Upload, UserPlus, XCircle, DollarSign,
  ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIncentiveModalOpen, setIsIncentiveModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<UserProfile | null>(null);
  const [selectedEmpForIncentive, setSelectedEmpForIncentive] = useState<UserProfile | null>(null);
  const [incentiveType, setIncentiveType] = useState<'incentive' | 'deduction'>('incentive');
  const [incentiveAmount, setIncentiveAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const canAccess = user && ['super', 'owner', 'hr'].includes(user.role);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getEmployees();
      setEmployees(data || []);
    } catch (err) {
      console.error('Error loading employees:', err);
      toast.error('Failed to sync employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const branches = ['All', ...new Set(employees.map(e => e.branch))];

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                         emp.email.toLowerCase().includes(search.toLowerCase()) ||
                         emp.username.toLowerCase().includes(search.toLowerCase());
    const matchesBranch = filterBranch === 'All' || emp.branch === filterBranch;
    return matchesSearch && matchesBranch;
  });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (uid: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      await supabaseService.deleteEmployee(uid);
      toast.success('Employee deleted');
      loadEmployees();
    }
  };

  const handleIncentiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForIncentive || !incentiveAmount) return;

    const success = await supabaseService.addIncentiveDeduction(
      selectedEmpForIncentive.uid, 
      Number(incentiveAmount), 
      incentiveType
    );

    if (success) {
      toast.success(`${incentiveType === 'incentive' ? 'Incentive' : 'Deduction'} added successfully`);
      setIsIncentiveModalOpen(false);
      setIncentiveAmount('');
      loadEmployees();
    } else {
      toast.error('Failed to update payroll');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Branch', 'Name', 'Join Date', 'Salary A', 'Salary B', 'EPF', 
      'Advances', 'Cover Dedication', 'Intensive', 'Travelling', 'Net Salary', 'Username', 'Role'
    ];
    
    const rows = filteredEmployees.map(emp => [
      emp.branch,
      emp.name,
      emp.joinDate,
      emp.salaryA,
      emp.salaryB,
      emp.epf,
      emp.advances,
      emp.cover,
      emp.intensive,
      emp.travelling,
      emp.net,
      emp.username,
      emp.role
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
          <XCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-zinc-900">Access Denied</h2>
        <p className="text-zinc-500 max-w-md">
          You do not have permission to view this page. Only Super Admin, Owner, and HR Manager can access employee management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Employee Management</h1>
          <p className="text-zinc-500 font-medium">Manage workforce, payroll details, and login credentials</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="bg-white border border-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all"
          >
            <FileSpreadsheet size={18} />
            Export CSV
          </button>
          <button 
            onClick={() => { setEditingEmp(null); setIsModalOpen(true); }}
            className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
          >
            <UserPlus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-4xl border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or username..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={filterBranch}
            onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
            className="px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-orange-500"
          >
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-400 hover:text-zinc-600 transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Branch</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Join Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Salary A</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Salary B</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">EPF</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Advances</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Cover Dedication</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Intensive</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Travelling</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Net Salary</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paginatedEmployees.map((emp) => (
                <tr key={emp.uid} className="hover:bg-zinc-50/30 transition-all group">
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-lg">{emp.branch}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xs">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-zinc-900">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-zinc-500">{formatDate(emp.joinDate)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-zinc-900 text-right">{emp.salaryA.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-zinc-500 text-right">{emp.salaryB.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-zinc-500 text-right">{emp.epf.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-red-600 text-right">{emp.advances.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-red-600 text-right">{emp.cover.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-green-600 text-right">{emp.intensive.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-green-600 text-right">{emp.travelling.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-black text-zinc-900 text-right bg-zinc-50/50">{emp.net.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-medium text-zinc-500">{emp.username}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      emp.role === 'super' ? 'bg-purple-100 text-purple-600' :
                      emp.role === 'owner' ? 'bg-blue-100 text-blue-600' :
                      emp.role === 'hr' ? 'bg-orange-100 text-orange-600' :
                      'bg-zinc-100 text-zinc-500'
                    )}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setEditingEmp(emp); setIsModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                        title="Edit Employee"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => { setSelectedEmpForIncentive(emp); setIncentiveType('incentive'); setIsIncentiveModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                        title="Add Incentive"
                      >
                        <DollarSign size={16} />
                      </button>
                      <button 
                        onClick={() => { setSelectedEmpForIncentive(emp); setIncentiveType('deduction'); setIsIncentiveModalOpen(true); }}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Add Deduction"
                      >
                        <Trash2 size={16} className="rotate-180" />
                      </button>
                      <button 
                        onClick={() => handleDelete(emp.uid)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Employee"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-6 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/30">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
          </p>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-2 border border-zinc-200 rounded-xl disabled:opacity-30 hover:bg-white transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-10 h-10 rounded-xl font-bold text-xs transition-all",
                    currentPage === i + 1 ? "bg-zinc-900 text-white" : "hover:bg-white border border-transparent hover:border-zinc-200 text-zinc-500"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 border border-zinc-200 rounded-xl disabled:opacity-30 hover:bg-white transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
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
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900">
                    {editingEmp ? 'Edit Employee Profile' : 'Register New Employee'}
                  </h2>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Employee & Payroll Information</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all">
                  <XCircle size={24} />
                </button>
              </div>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSaving(true);
                  try {
                    const formData = new FormData(e.currentTarget);
                    const data = Object.fromEntries(formData.entries()) as any;
                    
                    const salaryA = Number(data.salaryA) || 0;
                    const salaryB = Number(data.salaryB) || 0;
                    const epf = Number(data.epf) || 0;
                    const advances = Number(data.advances) || 0;
                    const cover = Number(data.cover) || 0;
                    const intensive = Number(data.intensive) || 0;
                    const travelling = Number(data.travelling) || 0;

                    const newEmp: UserProfile = {
                      uid: editingEmp?.uid || `emp-${Date.now()}`,
                      name: data.name,
                      email: data.email,
                      username: data.username || data.name.toLowerCase().replace(/\s+/g, '.'),
                      password: data.password || undefined,
                      role: data.role,
                      branch: data.branch,
                      joinDate: data.joinDate,
                      salaryA,
                      salaryB,
                      epf,
                      advances,
                      cover,
                      intensive,
                      travelling,
                      net: salaryA + salaryB + intensive + travelling - epf - advances - cover,
                      performanceScore: editingEmp?.performanceScore || 0,
                      leaveQuotas: editingEmp?.leaveQuotas || { annual: 20, sick: 10, casual: 7, short: 2 },
                      usedLeaves: editingEmp?.usedLeaves || { annual: 0, sick: 0, casual: 0, short: 0 },
                    };

                    if (editingEmp) {
                      await supabaseService.saveEmployee(newEmp);
                      toast.success('Employee updated successfully');
                    } else {
                      await supabaseService.registerFullEmployee(newEmp, data.password);
                      toast.success('New employee registered with login credentials');
                    }
                    setIsModalOpen(false);
                    loadEmployees();
                  } catch (error: any) {
                    console.error('Error saving employee:', error);
                    toast.error(error.message || 'Failed to save employee profile');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="p-8 space-y-8 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar"
                key={editingEmp?.uid || 'new'}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-zinc-900 border-l-4 border-orange-500 pl-3">Basic Information</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input name="name" defaultValue={editingEmp?.name} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
                        <input name="email" type="email" defaultValue={editingEmp?.email} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Branch</label>
                          <input name="branch" defaultValue={editingEmp?.branch} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Join Date</label>
                          <input name="joinDate" type="date" defaultValue={editingEmp?.joinDate} required className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                        <select name="role" defaultValue={editingEmp?.role || 'employee'} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-600 outline-none">
                          <option value="employee">Employee</option>
                          <option value="hr">HR Manager</option>
                          <option value="owner">Owner</option>
                          <option value="super">Super Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Login Management */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-zinc-900 border-l-4 border-purple-500 pl-3">Login Management</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Username</label>
                        <input name="username" defaultValue={editingEmp?.username} placeholder="Auto-generated if empty" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Password</label>
                        <input name="password" type="password" placeholder={editingEmp ? "Leave blank to keep current" : "Default: employee123"} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none" />
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-zinc-900 border-l-4 border-green-500 pl-3 mt-8">Payroll Details</h3>
                    <div className="grid grid-cols-2 gap-4" id="payroll-fields">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Salary A</label>
                        <input 
                          name="salaryA" 
                          type="number" 
                          defaultValue={editingEmp?.salaryA} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number(e.target.value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Salary B</label>
                        <input 
                          name="salaryB" 
                          type="number" 
                          defaultValue={editingEmp?.salaryB} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number(e.target.value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">EPF</label>
                        <input 
                          name="epf" 
                          type="number" 
                          defaultValue={editingEmp?.epf} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number(e.target.value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Advances</label>
                        <input 
                          name="advances" 
                          type="number" 
                          defaultValue={editingEmp?.advances} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number(e.target.value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cover Dedication</label>
                        <input 
                          name="cover" 
                          type="number" 
                          defaultValue={editingEmp?.cover} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number(e.target.value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Intensive</label>
                        <input 
                          name="intensive" 
                          type="number" 
                          defaultValue={editingEmp?.intensive} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number(e.target.value);
                              const travelling = Number((form.elements.namedItem('travelling') as HTMLInputElement).value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Travelling</label>
                        <input 
                          name="travelling" 
                          type="number" 
                          defaultValue={editingEmp?.travelling} 
                          required 
                          onChange={(e) => {
                            const form = e.target.form;
                            if (form) {
                              const sA = Number((form.elements.namedItem('salaryA') as HTMLInputElement).value);
                              const sB = Number((form.elements.namedItem('salaryB') as HTMLInputElement).value);
                              const intensive = Number((form.elements.namedItem('intensive') as HTMLInputElement).value);
                              const travelling = Number(e.target.value);
                              const epf = Number((form.elements.namedItem('epf') as HTMLInputElement).value);
                              const advances = Number((form.elements.namedItem('advances') as HTMLInputElement).value);
                              const cover = Number((form.elements.namedItem('cover') as HTMLInputElement).value);
                              (form.elements.namedItem('net') as HTMLInputElement).value = (sA + sB + intensive + travelling - epf - advances - cover).toString();
                            }
                          }}
                          className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Net Salary</label>
                        <input 
                          name="net" 
                          type="number" 
                          defaultValue={editingEmp?.net} 
                          required 
                          readOnly
                          className="w-full px-5 py-3 bg-zinc-100 border border-zinc-100 rounded-2xl text-sm font-black text-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-8 flex gap-4 border-t border-zinc-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 transition-all">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 bg-zinc-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      editingEmp ? 'Update Employee' : 'Register Employee'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Incentive/Deduction Modal */}
      <AnimatePresence>
        {isIncentiveModalOpen && selectedEmpForIncentive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsIncentiveModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 bg-zinc-50/50">
                <h2 className="text-2xl font-black text-zinc-900">
                  Add {incentiveType === 'incentive' ? 'Incentive' : 'Deduction'}
                </h2>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Updating payroll for {selectedEmpForIncentive.name}</p>
              </div>
              <form onSubmit={handleIncentiveSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex p-1 bg-zinc-100 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setIncentiveType('incentive')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                        incentiveType === 'incentive' ? "bg-white text-green-600 shadow-sm" : "text-zinc-400"
                      )}
                    >
                      INCENTIVE
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIncentiveType('deduction')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                        incentiveType === 'deduction' ? "bg-white text-red-600 shadow-sm" : "text-zinc-400"
                      )}
                    >
                      DEDUCTION
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Amount (LKR)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input 
                        type="number" 
                        value={incentiveAmount}
                        onChange={(e) => setIncentiveAmount(e.target.value)}
                        required 
                        autoFocus
                        placeholder="Enter amount..."
                        className="w-full pl-12 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none" 
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsIncentiveModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 transition-all">Cancel</button>
                  <button 
                    type="submit" 
                    className={cn(
                      "flex-1 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg",
                      incentiveType === 'incentive' ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-red-600 hover:bg-red-700 shadow-red-100"
                    )}
                  >
                    Apply {incentiveType === 'incentive' ? 'Incentive' : 'Deduction'}
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
