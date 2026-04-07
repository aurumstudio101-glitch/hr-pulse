import React, { useState, useRef, useEffect } from 'react';
import { 
  User, Mail, MapPin, Calendar, 
  Briefcase, Shield, LogOut, Edit3,
  Phone, Globe, Github, Linkedin, Save, X,
  Camera, CheckCircle2, UserCircle2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import * as supabaseService from '../services/supabaseService';
import { toast } from 'sonner';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    photoUrl: '',
    department: '',
    status: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Initialize form data when entering edit mode
  useEffect(() => {
    if (isEditing && user) {
      const nameParts = user.name.split(' ');
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        photoUrl: user.photoUrl || '',
        department: user.department || 'Operations',
        status: user.status || 'Available',
      });
    }
  }, [isEditing, user]);

  if (!user) return null;

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    
    try {
      let finalPhotoUrl = formData.photoUrl || user.photoUrl || '';

      // 1. If a new file was selected, upload it to Supabase Storage first
      if (selectedFile && user.uid) {
        toast.loading('Uploading photo...');
        finalPhotoUrl = await supabaseService.uploadAvatar(user.uid, selectedFile);
      }

      // 2. Prepare the updated user profile
      const updatedUser = {
        ...user,
        name: fullName || user.name,
        email: user.email,
        phone: formData.phone || user.phone || '',
        photoUrl: finalPhotoUrl,
        department: formData.department || user.department || 'Operations',
        status: (formData.status as any) || user.status || 'Available',
      };
      
      await supabaseService.saveEmployee(updatedUser);
      updateUser(updatedUser);
      setIsEditing(false);
      setSelectedFile(null);
      toast.dismiss();
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Profile Update Error:', err);
      toast.error('Failed to update profile sync');
    }
  };

  const statusColors = {
    'Available': 'bg-green-500',
    'Busy': 'bg-red-500',
    'On Leave': 'bg-amber-500',
    'Remote': 'bg-blue-500',
    'Meeting': 'bg-purple-500',
  };

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">My Profile</h1>
          <p className="text-zinc-500 font-medium tracking-tight">Manage your professional identity and workspace settings</p>
        </div>
        <button 
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
        >
          <Edit3 size={18} />
          Edit Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Staff Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm text-center">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-50 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-zinc-300 uppercase">{user.name.charAt(0)}</span>
                )}
              </div>
              <div className={cn(
                "absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white shadow-sm",
                statusColors[user.status as keyof typeof statusColors] || 'bg-zinc-400'
              )} />
            </div>
            
            <h2 className="text-2xl font-black text-zinc-900 leading-tight">{user.name}</h2>
            <div className="flex items-center justify-center gap-2 mb-8">
              <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200">
                {user.status}
              </span>
            </div>
            
            <div className="space-y-3">
              <button className="w-full py-4 bg-zinc-50 text-zinc-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all border border-zinc-100">
                <Shield size={18} />
                Security
              </button>
              <button 
                onClick={logout}
                className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all border border-red-50"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-zinc-200">
            <h3 className="font-black text-lg mb-6 flex items-center gap-2">
              <Briefcase size={20} className="text-blue-400" />
              Work Info
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Department</p>
                  <p className="font-bold text-sm text-zinc-200">{user.department || 'Operations'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Joined Date</p>
                  <p className="font-bold text-sm text-zinc-200">{formatDate(user.joinDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Branch Location</p>
                  <p className="font-bold text-sm text-zinc-200">{user.branch} Sri Lanka</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Information Grid */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm min-h-[400px]">
            <h3 className="text-xl font-black text-zinc-900 mb-8 flex items-center gap-2">
              <User size={22} className="text-blue-500" />
              Identity Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Official Name</label>
                <div className="px-5 py-4 bg-zinc-50/50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100">
                  {user.name}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="px-5 py-4 bg-zinc-50/50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100">
                  {user.email}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Mobile Contact</label>
                <div className="px-5 py-4 bg-zinc-50/50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100">
                  {user.phone || 'Not set'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Access Level</label>
                <div className="px-5 py-4 bg-zinc-50/50 rounded-2xl text-sm font-bold text-blue-600 border border-blue-50 capitalize">
                  {user.role}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 Edit Profile Modal (Matches Screenshot) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
            {/* Modal Header */}
            <div className="p-8 pb-0 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                  <Edit3 size={20} className="text-blue-600" />
                  Edit Profile
                </h2>
                <p className="text-sm text-zinc-500 font-medium mt-1">Update your personal details. Changes are saved immediately.</p>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400">
                <X size={20} />
              </button>
            </div>

            {/* Avatar Picker Section */}
            <div className="px-8 py-10 flex flex-col items-center">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-orange-50 border-2 border-dashed border-orange-200 flex items-center justify-center overflow-hidden">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-orange-600 uppercase">
                      {formData.firstName.charAt(0)}{formData.lastName ? formData.lastName.charAt(0) : '?'}
                    </span>
                  )}
                </div>
                <button 
                  onClick={handlePhotoClick}
                  className="absolute bottom-0 right-0 p-2 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-all border-4 border-white"
                >
                  <Camera size={14} />
                </button>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">Click the camera icon to upload a new photo</p>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>

            {/* Form Fields */}
            <div className="px-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest ml-1">First Name</label>
                  <input 
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-5 py-4 bg-zinc-50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-300"
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest ml-1">Last Name</label>
                  <input 
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-5 py-4 bg-zinc-50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-300"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest ml-1">Phone Number</label>
                <input 
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 rounded-2xl text-sm font-bold text-zinc-700 border border-zinc-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  placeholder="077 123 4567"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-8 flex items-center justify-end gap-3 mt-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
