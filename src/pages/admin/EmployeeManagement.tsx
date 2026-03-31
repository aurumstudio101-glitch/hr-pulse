import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { 
  collection, query, onSnapshot, doc, deleteDoc, 
  orderBy, setDoc, serverTimestamp, where, updateDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  Users, Search, Plus, Trash2, UserPlus, Mail, Briefcase, 
  XCircle, DollarSign, Calendar as CalendarIcon, Edit2
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../../hooks/useAuth';

export default function EmployeeManagement() {
  const { user, uid, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [salary, setSalary] = useState(0);
  const [salaryB, setSalaryB] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'owner' && user.role !== 'hr' && user.role !== 'super')) {
      navigate('/dashboard');
      return;
    }

    const isDemo = !!localStorage.getItem('hr_pulse_demo_user');
    if (isDemo) {
      setEmployees([
        { uid: 'super-uid', username: 'super', name: 'Super Admin', email: 'super@hrpulse.com', role: 'super', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 0, sick: 0, casual: 0, short: 0 }, performanceScore: 100, createdAt: new Date() as any },
        { uid: 'owner-uid', username: 'owner', name: 'Owner User', email: 'owner@hrpulse.com', role: 'owner', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 0, sick: 0, casual: 0, short: 0 }, performanceScore: 100, createdAt: new Date() as any },
        { uid: 'hr-uid', username: 'hr', name: 'HR User', email: 'hr@hrpulse.com', role: 'hr', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 0, sick: 0, casual: 0, short: 0 }, performanceScore: 100, createdAt: new Date() as any },
        { uid: 'employee-uid', username: 'employee', name: 'Employee User', email: 'employee@hrpulse.com', role: 'employee', salary: 5000, leaveQuotas: { annual: 20, sick: 10, casual: 5, short: 2 }, usedLeaves: { annual: 0, sick: 0, casual: 0, short: 0 }, performanceScore: 100, createdAt: new Date() as any }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, authLoading, navigate]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    
    if (!trimmedUsername) {
      toast.error('Username is required');
      setSubmitting(false);
      return;
    }

    try {
      const userEmail = trimmedEmail || `${trimmedUsername}@hrpulse.com`;
      const mockUid = `user_${Date.now()}`;
      
      const newUser: UserProfile = {
        uid: mockUid,
        username: trimmedUsername,
        name,
        email: userEmail,
        department,
        branch,
        startDate,
        role,
        salary,
        salaryB,
        leaveQuotas: {
          annual: 14,
          sick: 7,
          casual: 7,
          short: 12
        },
        usedLeaves: {
          annual: 0,
          sick: 0,
          casual: 0,
          short: 0
        },
        performanceScore: 0,
        mustResetPassword: true,
        createdAt: new Date() as any, // serverTimestamp() will be used in setDoc
      };

      await setDoc(doc(db, 'users', mockUid), {
        ...newUser,
        createdAt: serverTimestamp(),
      });

      toast.success('Employee added! Default password: 4321');
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', selectedEmployee.uid), {
        name,
        department,
        branch,
        startDate,
        role,
        salary,
        salaryB,
      });
      toast.success('Employee updated successfully');
      setIsEditModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEmployee = async (uid: string) => {
    if (!confirm('Are you sure you want to remove this employee? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Employee removed');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setEmail('');
    setDepartment('');
    setBranch('');
    setStartDate('');
    setRole('employee');
    setSalary(0);
    setSalaryB(0);
    setSelectedEmployee(null);
  };

  const openEditModal = (emp: UserProfile) => {
    setSelectedEmployee(emp);
    setName(emp.name);
    setUsername(emp.username);
    setEmail(emp.email);
    setDepartment(emp.department || '');
    setBranch(emp.branch || '');
    setStartDate(emp.startDate || '');
    setRole(emp.role);
    setSalary(emp.salary || 0);
    setSalaryB(emp.salaryB || 0);
    setIsEditModalOpen(true);
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.branch?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Employee Management</h1>
          <p className="text-zinc-500 font-medium">Manage your workforce, roles, and compensation</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
        >
          <UserPlus size={20} />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, username, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <Users size={16} />
            {filteredEmployees.length} Total Employees
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Branch & Dept</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Role</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Salary (A/B)</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.uid} className="hover:bg-zinc-50/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-lg shadow-sm">
                            {employee.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{employee.name}</p>
                            <p className="text-xs text-zinc-400 font-medium">{employee.email}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Joined: {employee.startDate || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-zinc-900">{employee.branch || 'N/A'}</p>
                          <p className="text-xs font-bold text-zinc-500">{employee.department || 'General'}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border",
                          employee.role === 'owner' ? "bg-purple-50 text-purple-700 border-purple-100" :
                          employee.role === 'hr' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          employee.role === 'super' ? "bg-orange-50 text-orange-700 border-orange-100" :
                          "bg-zinc-100 text-zinc-600 border-zinc-200"
                        )}>
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-zinc-900">A: {employee.salary?.toLocaleString() || '0'}</p>
                          <p className="text-xs font-bold text-zinc-500">B: {employee.salaryB?.toLocaleString() || '0'}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(employee)}
                        className="p-2.5 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                        title="Edit Employee"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteEmployee(employee.uid)}
                        className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Remove Employee"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
                <h2 className="text-2xl font-black text-zinc-900">
                  {isAddModalOpen ? 'Add New Employee' : 'Edit Employee Profile'}
                </h2>
                <button 
                  onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} 
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all"
                >
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={isAddModalOpen ? handleAddEmployee : handleEditEmployee} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                      <input
                        type="text"
                        required
                        disabled={isEditModalOpen}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium disabled:opacity-50"
                        placeholder="jdoe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                      <input
                        type="email"
                        disabled={isEditModalOpen}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium disabled:opacity-50"
                        placeholder="jdoe@company.com"
                      />
                    </div>
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
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Branch</label>
                      <input
                        type="text"
                        required
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                        placeholder="Borella"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Department</label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                        placeholder="Engineering"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                      >
                        <option value="employee">Employee</option>
                        <option value="hr">HR Admin</option>
                        <option value="super">Super Admin (Payroll)</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Salary-A</label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                          <input
                            type="number"
                            required
                            value={salary}
                            onChange={(e) => setSalary(Number(e.target.value))}
                            className="w-full pl-10 pr-4 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                            placeholder="27000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Salary-B</label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                          <input
                            type="number"
                            required
                            value={salaryB}
                            onChange={(e) => setSalaryB(Number(e.target.value))}
                            className="w-full pl-10 pr-4 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                            placeholder="30000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="flex-1 px-6 py-4 rounded-2xl border border-zinc-200 text-zinc-600 font-bold hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-orange-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : isAddModalOpen ? 'Create Account' : 'Save Changes'}
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
