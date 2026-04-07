-- 1. Create a table for public profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super', 'owner', 'hr', 'employee')),
  branch TEXT,
  department TEXT,
  phone TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Busy', 'On Leave', 'Remote', 'Meeting')),
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  salary_a NUMERIC(15, 2) DEFAULT 0,
  salary_b NUMERIC(15, 2) DEFAULT 0,
  epf NUMERIC(15, 2) DEFAULT 0,
  advances NUMERIC(15, 2) DEFAULT 0,
  cover NUMERIC(15, 2) DEFAULT 0,
  intensive NUMERIC(15, 2) DEFAULT 0,
  travelling NUMERIC(15, 2) DEFAULT 0,
  net NUMERIC(15, 2) DEFAULT 0,
  performance_score NUMERIC(5, 2) DEFAULT 0,
  must_reset_password BOOLEAN DEFAULT TRUE,
  leave_quotas JSONB DEFAULT '{"annual": 14, "sick": 7, "casual": 7, "short": 0}'::JSONB,
  used_leaves JSONB DEFAULT '{"annual": 0, "sick": 0, "casual": 0, "short": 0}'::JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create attendance table
CREATE TABLE public.attendance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMP WITH TIME ZONE NOT NULL,
  check_out TIMESTAMP WITH TIME ZONE,
  is_late BOOLEAN DEFAULT FALSE,
  is_early_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date)
);

-- 3. Create leave requests table
CREATE TABLE public.leave_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Annual', 'Sick', 'Casual', 'Short')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  is_urgent BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create tasks table
CREATE TABLE public.tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create payroll table
CREATE TABLE public.payroll (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  salary_a NUMERIC(15, 2) NOT NULL,
  salary_b NUMERIC(15, 2) NOT NULL,
  epf NUMERIC(15, 2) NOT NULL,
  advances NUMERIC(15, 2) NOT NULL,
  cover NUMERIC(15, 2) NOT NULL,
  intensive NUMERIC(15, 2) NOT NULL,
  travelling NUMERIC(15, 2) NOT NULL,
  net_salary NUMERIC(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),
  branch TEXT NOT NULL,
  incentives NUMERIC(15, 2) DEFAULT 0,
  bonus NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create performance table
CREATE TABLE public.performance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID REFERENCES public.profiles(id) NOT NULL,
  score INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  feedback TEXT,
  hr_feedback TEXT,
  self_evaluation TEXT,
  goals JSONB DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Completed', 'Self-Evaluated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTION FOR MANAGEMENT CHECK
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (role IN ('super', 'owner', 'hr'))
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLICIES: PROFILES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Management can manage all profiles" ON public.profiles FOR ALL USING (is_management());

-- POLICIES: ATTENDANCE
CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id OR is_management());
CREATE POLICY "Users insert own checkin" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own checkout" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Management manage attendance" ON public.attendance FOR ALL USING (is_management());

-- POLICIES: LEAVE REQUESTS
CREATE POLICY "Users view own leaves" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id OR is_management());
CREATE POLICY "Users insert own leave" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Management manage leaves" ON public.leave_requests FOR ALL USING (is_management());

-- POLICIES: TASKS
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id OR is_management());

-- POLICIES: PAYROLL
CREATE POLICY "Users view own payroll" ON public.payroll FOR SELECT USING (auth.uid() = user_id OR is_management());
CREATE POLICY "Management manage payroll" ON public.payroll FOR ALL USING (is_management());

-- POLICIES: PERFORMANCE
CREATE POLICY "Users view own performance" ON public.performance FOR SELECT USING (auth.uid() = user_id OR is_management());
CREATE POLICY "Management manage performance" ON public.performance FOR ALL USING (is_management());

-- ─── STORAGE SETUP (Profile Pictures) ───────────────────────────────────────

-- Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Avatar public access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
