import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ListTodo, Plus, Trash2, CheckCircle2, Circle, Search, Filter } from 'lucide-react';
import { Task } from '../types';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../hooks/useAuth';
import * as supabaseService from '../services/supabaseService';

export default function Tasks() {
  const { user, uid, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadData = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await supabaseService.getTasks(uid);
      setTasks(data || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      toast.error('Failed to sync tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [uid]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !uid) return;

    try {
      await supabaseService.saveTask({
        userId: uid,
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setNewTaskTitle('');
      toast.success('Task added successfully');
      loadData();
    } catch (e: any) {
      console.error('Add task error:', e);
      toast.error('Failed to add task');
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await supabaseService.toggleTask(id);
      loadData();
    } catch (e: any) {
      console.error('Toggle task error:', e);
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await supabaseService.deleteTask(id);
      toast.success('Task deleted');
      loadData();
    } catch (e: any) {
      console.error('Delete task error:', e);
      toast.error('Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'active' ? !task.completed : 
      task.completed;
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading your tasks...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Daily Tasks</h1>
          <p className="text-zinc-500 font-medium">Manage your priorities and stay productive</p>
        </div>
        <div className="flex p-1.5 bg-zinc-100/50 rounded-2xl w-fit">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm sticky top-24">
            <h3 className="font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Plus size={20} className="text-orange-500" />
              Add Task
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Task Title</label>
                <textarea
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-100 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all resize-none font-medium"
                  placeholder="What needs to be done?"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
              >
                Add to List
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-zinc-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Progress</span>
                <span className="text-xs font-black text-zinc-900">
                  {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0}%` }}
                  className="h-full bg-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-zinc-100 rounded-4xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
            />
          </div>

          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-white rounded-4xl border border-zinc-100 shadow-sm"
              >
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 mx-auto mb-4">
                  <ListTodo size={32} />
                </div>
                <p className="text-zinc-500 font-medium">No tasks found in this category</p>
              </motion.div>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "group flex items-center gap-4 p-6 bg-white rounded-4xl border transition-all shadow-sm",
                    task.completed ? "border-zinc-100 opacity-60" : "border-zinc-100 hover:border-orange-200"
                  )}
                >
                  <button 
                    onClick={() => toggleTask(task.id!, task.completed)}
                    className={cn(
                      "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
                      task.completed ? "bg-orange-500 border-orange-500 text-white" : "border-zinc-200 group-hover:border-orange-400"
                    )}
                  >
                    {task.completed && <CheckCircle2 size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-base font-bold transition-all",
                      task.completed ? "line-through text-zinc-400" : "text-zinc-900"
                    )}>
                      {task.title}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                      Added {formatDate(task.createdAt)}
                    </p>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id!)}
                    className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={20} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
