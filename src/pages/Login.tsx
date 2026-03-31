import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, query, where, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogIn, ShieldCheck, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../types';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error('Please enter a username');
      setLoading(false);
      return;
    }

    // Map username to email convention
    const email = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername}@hrpulse.com`;

    try {
      // Dummy Login Bypass for Demo
      const isDemo = (trimmedUsername === 'owner' || trimmedUsername === 'hr' || trimmedUsername === 'employee' || trimmedUsername === 'super') && 
                    (trimmedUsername === 'super' ? password === '1234' : password === '4321');
      
      if (isDemo) {
        const mockUid = `demo_${trimmedUsername}`;
        const defaultQuotas = { annual: 14, sick: 7, casual: 7, short: 4 };
        const defaultUsed = { annual: 0, sick: 0, casual: 0, short: 0 };
        let role: UserRole = trimmedUsername as any;
        let name = trimmedUsername === 'owner' ? 'Company Owner' : 
                   trimmedUsername === 'hr' ? 'HR Manager' : 
                   trimmedUsername === 'super' ? 'Super Admin' : 'Demo Employee';
        
        const userData = {
          uid: mockUid,
          username: trimmedUsername,
          name: name,
          email: `${trimmedUsername}@demo.com`,
          role: role,
          salary: role === 'owner' ? 0 : 5000,
          leaveQuotas: defaultQuotas,
          usedLeaves: defaultUsed,
          performanceScore: 100,
          mustResetPassword: false,
          createdAt: new Date()
        };
        
        localStorage.setItem('hr_pulse_demo_user', JSON.stringify(userData));
        toast.success(`Demo Mode: Welcome, ${userData.name}!`);
        navigate('/dashboard');
        return;
      }

      // Basic email validation before sending to Firebase
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Invalid username or email format');
        setLoading(false);
        return;
      }

      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.mustResetPassword) {
          toast.info('First login detected. Please reset your password.');
          navigate('/reset-password');
        } else {
          toast.success(`Welcome back, ${userData.name}!`);
          navigate('/dashboard');
        }
      } else {
        // Bootstrap pre-created accounts if they don't exist in Firestore yet
        const defaultQuotas = { annual: 14, sick: 7, casual: 7, short: 4 };
        const defaultUsed = { annual: 0, sick: 0, casual: 0, short: 0 };
        
        let role: 'owner' | 'hr' | 'employee' = 'employee';
        let name = 'Employee';
        
        if (username === 'owner') {
          role = 'owner';
          name = 'Company Owner';
        } else if (username === 'hr') {
          role = 'hr';
          name = 'HR Manager';
        }

        const newUser = {
          uid: user.uid,
          username: username,
          name: name,
          email: email,
          role: role,
          salary: role === 'owner' ? 0 : 5000,
          leaveQuotas: defaultQuotas,
          usedLeaves: defaultUsed,
          performanceScore: 100,
          mustResetPassword: password === '4321', // Force reset if using default password
          createdAt: new Date()
        };

        await setDoc(docRef, newUser);
        
        if (newUser.mustResetPassword) {
          toast.info('First login detected. Please reset your password.');
          navigate('/reset-password');
        } else {
          toast.success(`Welcome back, ${newUser.name}!`);
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const seedDemoData = async () => {
    setLoading(true);
    try {
      const demoUsers = [
        { username: 'super', password: '1234', role: 'super', name: 'Super Admin' },
        { username: 'owner', password: '4321', role: 'owner', name: 'Company Owner' },
        { username: 'hr', password: '4321', role: 'hr', name: 'HR Manager' },
        { username: 'employee', password: '4321', role: 'employee', name: 'Demo Employee' },
      ];

      const defaultQuotas = { annual: 14, sick: 7, casual: 7, short: 4 };
      const defaultUsed = { annual: 0, sick: 0, casual: 0, short: 0 };

      for (const demo of demoUsers) {
        const mockUid = `demo_${demo.username}`;
        const docRef = doc(db, 'users', mockUid);
        const userData = {
          uid: mockUid,
          username: demo.username,
          name: demo.name,
          email: `${demo.username}@demo.com`,
          role: demo.role,
          salary: demo.role === 'owner' ? 0 : 5000,
          leaveQuotas: defaultQuotas,
          usedLeaves: defaultUsed,
          performanceScore: 100,
          mustResetPassword: false,
          createdAt: new Date()
        };
        await setDoc(docRef, userData);
      }
      toast.success('Demo data initialized successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to initialize demo data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="flex justify-center mb-10">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-200">
              <ShieldCheck size={36} />
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-center text-zinc-900 mb-2">HR</h1>
          <p className="text-zinc-500 text-center mb-10 font-medium">Enterprise Management Portal</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-orange-100 active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-b-white rounded-full animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
              Sign In
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={seedDemoData}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl border border-zinc-200 text-zinc-500 text-sm font-bold hover:bg-zinc-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Initialize Demo Data
            </button>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-50 text-center">
            <p className="text-xs text-zinc-400 font-medium">
              Protected by Enterprise Security. <br/>
              Contact HR if you've lost your access.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
