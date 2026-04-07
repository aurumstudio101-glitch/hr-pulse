import React, { useState, useEffect, createContext, useContext } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  uid: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setUser(null);
      } else if (data) {
        // Map snake_case from Postgres to camelCase for the app
        const profile: UserProfile = {
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
        setUser(profile);
      }
    } catch (err) {
      console.error('Profile fetch unexpected error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUid(session.user.id);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUid(session.user.id);
        fetchProfile(session.user.id);
      } else {
        setUid(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateUser = (userData: UserProfile) => {
    setUser(userData);
    setUid(userData.uid);
  };

  return (
    <AuthContext.Provider value={{ user, uid, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
