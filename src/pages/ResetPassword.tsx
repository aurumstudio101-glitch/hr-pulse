import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseService';

export default function ResetPassword() {
  const { user, uid, loading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      if (uid) {
        // Update password in Supabase Auth
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (authError) throw authError;

        // Update profile in database
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ must_reset_password: false })
          .eq('id', uid);

        if (dbError) throw dbError;

        toast.success('Password updated successfully!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-100">
              <ShieldAlert size={36} />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-center text-zinc-900 mb-2">Security Update</h1>
          <p className="text-zinc-500 text-center mb-10 font-medium">You must set a new password before continuing</p>

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-zinc-100"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-b-white rounded-full animate-spin" />
              ) : (
                <KeyRound size={20} />
              )}
              Update Password
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
