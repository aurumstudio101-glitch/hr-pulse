import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  LogOut, User, LayoutDashboard, Calendar, Users, Menu, X, 
  Clock, CheckSquare, UserCircle, Sun, Moon, Briefcase,
  CreditCard, BarChart3, Search
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, uid, loading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!uid) {
      if (location.pathname !== '/login') {
        navigate('/login');
      }
    } else if (user?.mustResetPassword && location.pathname !== '/reset-password') {
      navigate('/reset-password');
    }
  }, [uid, user, loading, navigate, location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('hr_pulse_demo_user');
    await logout();
    navigate('/login');
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: <Sun className="text-orange-500" size={24} /> };
    if (hour < 18) return { text: 'Good Afternoon', icon: <Sun className="text-orange-400" size={24} /> };
    return { text: 'Good Evening', icon: <Moon className="text-indigo-400" size={24} /> };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          <p className="text-zinc-500 font-medium">Loading HR...</p>
        </div>
      </div>
    );
  }

  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password';
  if (isAuthPage) return <>{children}</>;
  if (!user) return null;

  const navItems = [
    { label: 'Dashboard', path: user.role === 'employee' ? '/dashboard' : '/admin', icon: LayoutDashboard, roles: ['employee', 'hr', 'owner', 'super'] },
    { label: 'Attendance', path: '/attendance', icon: Clock, roles: ['employee'] },
    { label: 'Tasks', path: '/tasks', icon: CheckSquare, roles: ['employee'] },
    { label: 'Calendar', path: '/calendar', icon: Calendar, roles: ['employee', 'hr', 'owner', 'super'] },
    { label: 'Employees', path: '/admin/employees', icon: Users, roles: ['hr', 'owner', 'super'] },
    { label: 'Leave Requests', path: '/admin/leaves', icon: Briefcase, roles: ['hr', 'owner', 'super'] },
    { label: 'Payroll', path: '/admin/payroll', icon: CreditCard, roles: ['hr', 'owner', 'super'] },
    { label: 'Performance', path: '/admin/performance', icon: BarChart3, roles: ['hr', 'owner', 'super'] },
    { label: 'My Performance', path: '/performance', icon: BarChart3, roles: ['employee'] },
    { label: 'Profile', path: '/profile', icon: UserCircle, roles: ['employee', 'hr', 'owner', 'super'] },
  ];

  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">H</div>
          <span className="text-lg font-bold tracking-tight text-zinc-900">HR</span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-200">H</div>
            <span className="text-xl font-bold tracking-tight text-zinc-900">HR</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 mt-4">
            {navItems.filter(item => item.roles.includes(user.role)).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  location.pathname === item.path
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
                    : "text-zinc-500 hover:bg-orange-50 hover:text-orange-600"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-100">
            <div className="bg-zinc-50 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center overflow-hidden">
                  {user.profilePic ? (
                    <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{user.role}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-zinc-200 p-4 px-8 items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-orange-50 rounded-xl">
              {greeting.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">{greeting.text}, {user.name.split(' ')[0]}!</h2>
              <p className="text-xs text-zinc-500 font-medium">Welcome to your HR portal</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" 
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
