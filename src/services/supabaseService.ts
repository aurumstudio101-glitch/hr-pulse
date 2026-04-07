import { supabase } from '../lib/supabase';
export { supabase };
import { UserProfile, AttendanceRecord, LeaveRequest, Task, PayrollRecord, PerformanceRecord } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapProfile(data: any): UserProfile {
  return {
    uid: data.id,
    name: data.name,
    email: data.email,
    username: data.username,
    role: data.role,
    branch: data.branch,
    department: data.department,
    phone: data.phone,
    photoUrl: data.photo_url,
    status: data.status,
    joinDate: data.join_date,
    salaryA: Number(data.salary_a),
    salaryB: Number(data.salary_b),
    epf: Number(data.epf),
    advances: Number(data.advances),
    cover: Number(data.cover),
    intensive: Number(data.intensive),
    travelling: Number(data.travelling),
    net: Number(data.net),
    performanceScore: Number(data.performance_score),
    leaveQuotas: data.leave_quotas,
    usedLeaves: data.used_leaves,
  };
}

// ─── Employees / Users ───────────────────────────────────────────────────────

export async function getEmployees(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function getEmployee(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) return null;
  return mapProfile(data);
}

export async function saveEmployee(emp: UserProfile): Promise<void> {
  const { uid, ...data } = emp;
  const { error } = await supabase.from('profiles').upsert({
    id: uid,
    name: data.name,
    email: data.email,
    username: data.username,
    role: data.role,
    branch: data.branch,
    department: data.department,
    phone: data.phone,
    photo_url: data.photoUrl,
    status: data.status,
    join_date: data.joinDate,
    salary_a: data.salaryA,
    salary_b: data.salaryB,
    epf: data.epf,
    advances: data.advances,
    cover: data.cover,
    intensive: data.intensive,
    travelling: data.travelling,
    net: data.net,
    performance_score: data.performanceScore,
    leave_quotas: data.leaveQuotas,
    used_leaves: data.usedLeaves,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteEmployee(uid: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', uid);
  if (error) throw error;
}

export async function registerFullEmployee(emp: UserProfile, password?: string): Promise<void> {
  const finalPassword = password || 'employee123';
  
  // Supabase Auth handles user creation. 
  // Note: signUp creates a user in auth.users and triggers RLS/Triggers if set up.
  // In our case, we also need to manually insert into public.profiles if no trigger exists.
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: emp.email,
    password: finalPassword,
    options: {
      data: {
        name: emp.name,
        role: emp.role
      }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create login account');

  // Insert profile record
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    name: emp.name,
    email: emp.email,
    username: emp.username,
    role: emp.role,
    branch: emp.branch,
    department: emp.department,
    phone: emp.phone,
    photo_url: emp.photoUrl,
    status: emp.status || 'Available',
    join_date: emp.joinDate,
    salary_a: emp.salaryA,
    salary_b: emp.salaryB,
    epf: emp.epf,
    advances: emp.advances,
    cover: emp.cover,
    intensive: emp.intensive,
    travelling: emp.travelling,
    net: emp.net,
    performance_score: emp.performanceScore,
    leave_quotas: emp.leaveQuotas,
    used_leaves: emp.usedLeaves,
  });

  if (profileError) throw profileError;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${uid}/avatar.${fileExt}`;
  const filePath = `${fileName}`;

  // 1. Upload the file
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { 
      upsert: true,
      contentType: file.type 
    });

  if (uploadError) throw uploadError;

  // 2. Get the public URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function addIncentiveDeduction(
  uid: string, amount: number, type: 'incentive' | 'deduction'
): Promise<boolean> {
  const emp = await getEmployee(uid);
  if (!emp) return false;

  const field = type === 'incentive' ? 'intensive' : 'advances';
  const updated = {
    ...emp,
    [field]: (emp[field] || 0) + amount,
  };
  updated.net = updated.salaryA + updated.salaryB + updated.intensive + updated.travelling
    - updated.epf - updated.advances - updated.cover;

  await saveEmployee(updated);
  return true;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getAttendance(uid?: string): Promise<AttendanceRecord[]> {
  let query = supabase.from('attendance').select('*').order('date', { ascending: false });
  if (uid) {
    query = query.eq('user_id', uid);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id.toString(),
    userId: d.user_id,
    date: d.date,
    checkIn: d.check_in,
    checkOut: d.check_out,
    isLate: d.is_late,
    isEarlyOut: d.is_early_out
  }));
}

export async function saveAttendance(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
  const { data, error } = await supabase.from('attendance').insert({
    user_id: record.userId,
    date: record.date,
    check_in: record.checkIn,
    check_out: record.checkOut,
    is_late: record.isLate,
    is_early_out: record.isEarlyOut
  }).select().single();
  
  if (error) throw error;
  return data.id.toString();
}

export async function updateAttendance(id: string, updates: Partial<AttendanceRecord>): Promise<void> {
  const { error } = await supabase.from('attendance').update({
    check_out: updates.checkOut,
    is_early_out: updates.isEarlyOut
  }).eq('id', id);
  if (error) throw error;
}

function getLocalToday(): string {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Colombo', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(new Date());
}

export async function checkIn(uid: string): Promise<boolean> {
  const today = getLocalToday();
  const existing = await getAttendance(uid);
  if (existing.find(a => a.date === today)) return false;

  const now = new Date();
  const slTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(now);
  
  const [hours, minutes] = slTime.split(':').map(Number);
  const isLate = hours > 9 || (hours === 9 && minutes > 0);
  
  await saveAttendance({ 
    userId: uid, 
    date: today, 
    checkIn: now.toISOString(), 
    isLate, 
    isEarlyOut: false 
  });
  return true;
}

export async function checkOut(uid: string): Promise<boolean> {
  const today = getLocalToday();
  const all = await getAttendance(uid);
  const existing = all.find(a => a.date === today && !a.checkOut);
  if (!existing?.id) return false;

  const now = new Date();
  const slTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).format(now);
  
  const [hours] = slTime.split(':').map(Number);
  const isEarlyOut = hours < 17;
  
  await updateAttendance(existing.id, { 
    checkOut: now.toISOString(), 
    isEarlyOut 
  });
  return true;
}

// ─── Leave Requests ──────────────────────────────────────────────────────────

export async function getLeaves(uid?: string): Promise<LeaveRequest[]> {
  let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
  if (uid) {
    query = query.eq('user_id', uid);
  }
  const { data, error } = await query;
  if (error) throw error;
  
  // Note: In Firestore variant, user profile data was sometimes embedded. 
  // In SQL, we usually join. For now, we'll return what's in the table.
  return (data || []).map(d => ({
    id: d.id.toString(),
    userId: d.user_id,
    userName: '', // Would require a join
    userRole: 'employee', // Would require a join
    leaveType: d.leave_type,
    startDate: d.start_date,
    endDate: d.end_date,
    reason: d.reason,
    status: d.status,
    approvedBy: d.approved_by,
    createdAt: d.created_at,
    isUrgent: d.is_urgent,
    imageUrl: d.image_url
  } as LeaveRequest));
}

export async function saveLeave(req: Omit<LeaveRequest, 'id'>): Promise<string> {
  const { data, error } = await supabase.from('leave_requests').insert({
    user_id: req.userId,
    leave_type: req.leaveType,
    start_date: req.startDate,
    end_date: req.endDate,
    reason: req.reason,
    status: req.status,
    is_urgent: req.isUrgent,
    image_url: req.imageUrl
  }).select().single();
  
  if (error) throw error;
  return data.id.toString();
}

export async function updateLeave(
  id: string, status: 'Approved' | 'Rejected', approvedBy: string
): Promise<void> {
  const { error } = await supabase.from('leave_requests').update({ 
    status, 
    approved_by: approvedBy,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasks(uid: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id.toString(),
    userId: d.user_id,
    title: d.title,
    completed: d.completed,
    createdAt: d.created_at
  }));
}

export async function saveTask(task: Omit<Task, 'id'>): Promise<string> {
  const { data, error } = await supabase.from('tasks').insert({
    user_id: task.userId,
    title: task.title,
    completed: task.completed
  }).select().single();
  if (error) throw error;
  return data.id.toString();
}

export async function toggleTask(id: string): Promise<void> {
  const { data: task, error: fetchError } = await supabase.from('tasks').select('completed').eq('id', id).single();
  if (fetchError) throw fetchError;
  const { error } = await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export async function getPayroll(uid?: string): Promise<PayrollRecord[]> {
  let query = supabase.from('payroll').select('*').order('created_at', { ascending: false });
  if (uid) {
    query = query.eq('user_id', uid);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id.toString(),
    userId: d.user_id,
    userName: '', // Would require join
    month: d.month,
    year: d.year,
    salaryA: Number(d.salary_a),
    salaryB: Number(d.salary_b),
    epf: Number(d.epf),
    advances: Number(d.advances),
    cover: Number(d.cover),
    intensive: Number(d.intensive),
    travelling: Number(d.travelling),
    netSalary: Number(d.net_salary),
    status: d.status,
    branch: d.branch,
    createdAt: d.created_at
  } as PayrollRecord));
}

export async function generatePayroll(month: number, year: number): Promise<void> {
  const employees = await getEmployees();
  const { data: existing, error: pError } = await supabase.from('payroll').select('user_id').eq('month', month).eq('year', year);
  if (pError) throw pError;

  for (const emp of employees) {
    const exists = existing?.find(p => p.user_id === emp.uid);
    if (!exists) {
      const { error } = await supabase.from('payroll').insert({
        user_id: emp.uid,
        month,
        year,
        salary_a: emp.salaryA,
        salary_b: emp.salaryB,
        epf: emp.epf,
        advances: emp.advances,
        cover: emp.cover,
        intensive: emp.intensive,
        travelling: emp.travelling,
        net_salary: emp.net,
        status: 'Pending',
        branch: emp.branch
      });
      if (error) console.error(`Failed to generate payroll for ${emp.uid}`, error);
    }
  }
}

export async function updatePayroll(id: string, updates: Partial<PayrollRecord>): Promise<void> {
  const { error } = await supabase.from('payroll').update({
    status: updates.status,
    incentives: updates.incentives,
    bonus: updates.bonus
  }).eq('id', id);
  if (error) throw error;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export async function getPerformance(uid?: string): Promise<PerformanceRecord[]> {
  let query = supabase.from('performance').select('*').order('created_at', { ascending: false });
  if (uid) {
    query = query.eq('user_id', uid);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id.toString(),
    userId: d.user_id,
    userName: '', // Join
    evaluatorId: d.evaluator_id,
    evaluatorName: '', // Join
    score: d.score,
    rating: d.rating,
    feedback: d.feedback,
    hrFeedback: d.hr_feedback,
    selfEvaluation: d.self_evaluation,
    goals: d.goals,
    status: d.status,
    createdAt: d.created_at
  } as PerformanceRecord));
}

export async function savePerformance(record: Omit<PerformanceRecord, 'id'>): Promise<string> {
  const { data, error } = await supabase.from('performance').insert({
    user_id: record.userId,
    evaluator_id: record.evaluatorId,
    score: record.score,
    rating: record.rating,
    feedback: record.feedback,
    hr_feedback: record.hrFeedback,
    self_evaluation: record.selfEvaluation,
    goals: record.goals,
    status: record.status
  }).select().single();
  
  if (error) throw error;
  return data.id.toString();
}

export async function updatePerformance(id: string, updates: Partial<PerformanceRecord>): Promise<void> {
  const { error } = await supabase.from('performance').update({
    score: updates.score,
    rating: updates.rating,
    feedback: updates.feedback,
    hr_feedback: updates.hrFeedback,
    self_evaluation: updates.selfEvaluation,
    goals: updates.goals,
    status: updates.status
  }).eq('id', id);
  if (error) throw error;
}
