-- Create enum types for the platform
CREATE TYPE public.user_role AS ENUM ('migrant', 'company', 'mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin');
CREATE TYPE public.legal_status AS ENUM ('regularized', 'pending', 'not_regularized', 'refugee');
CREATE TYPE public.work_status AS ENUM ('employed', 'unemployed_seeking', 'unemployed_not_seeking', 'student', 'self_employed');
CREATE TYPE public.housing_status AS ENUM ('stable', 'temporary', 'precarious', 'homeless');
CREATE TYPE public.language_level AS ENUM ('native', 'advanced', 'intermediate', 'basic', 'none');
CREATE TYPE public.session_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.job_status AS ENUM ('active', 'paused', 'closed', 'pending_review');
CREATE TYPE public.application_status AS ENUM ('submitted', 'viewed', 'interview', 'accepted', 'rejected');

-- Profiles table for all users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'migrant',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Triage data for migrants
CREATE TABLE public.triage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  legal_status legal_status,
  work_status work_status,
  housing_status housing_status,
  language_level language_level,
  interests TEXT[] DEFAULT '{}',
  urgencies TEXT[] DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Company profiles with additional business info
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  nif TEXT,
  sector TEXT,
  description TEXT,
  location TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Sessions/appointments
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migrant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL, -- 'mediacao', 'juridico', 'psicologico'
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status session_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Learning trails
CREATE TABLE public.trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'trabalho', 'saude', 'direitos', 'cultura', 'empreendedorismo'
  modules_count INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'beginner',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trail modules/content
CREATE TABLE public.trail_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'video', 'text', 'pdf', 'quiz'
  content_url TEXT,
  content_text TEXT,
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User trail progress
CREATE TABLE public.user_trail_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE NOT NULL,
  modules_completed INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, trail_id)
);

-- Job offers
CREATE TABLE public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  salary_range TEXT,
  contract_type TEXT,
  sector TEXT,
  status job_status DEFAULT 'pending_review',
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Job applications
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status application_status DEFAULT 'submitted',
  cover_letter TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(job_id, applicant_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trail_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- CPC team can view all profiles
CREATE POLICY "CPC can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin')
    )
  );

-- Triage policies
CREATE POLICY "Users can view their own triage" ON public.triage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own triage" ON public.triage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own triage" ON public.triage
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "CPC can view all triage" ON public.triage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin')
    )
  );

-- Companies policies
CREATE POLICY "Companies can view their own profile" ON public.companies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Companies can insert their own profile" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Companies can update their own profile" ON public.companies
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view verified companies" ON public.companies
  FOR SELECT USING (verified = true);

-- Sessions policies
CREATE POLICY "Users can view their sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = migrant_id OR auth.uid() = professional_id);
CREATE POLICY "Users can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = migrant_id);
CREATE POLICY "CPC can view all sessions" ON public.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin')
    )
  );
CREATE POLICY "CPC can update sessions" ON public.sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin')
    )
  );

-- Trails policies (public read)
CREATE POLICY "Anyone can view active trails" ON public.trails
  FOR SELECT USING (is_active = true);
CREATE POLICY "CPC can manage trails" ON public.trails
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('manager', 'coordinator', 'admin')
    )
  );

-- Trail modules policies (public read)
CREATE POLICY "Anyone can view trail modules" ON public.trail_modules
  FOR SELECT USING (true);
CREATE POLICY "CPC can manage trail modules" ON public.trail_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('manager', 'coordinator', 'admin')
    )
  );

-- User progress policies
CREATE POLICY "Users can view their progress" ON public.user_trail_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their progress" ON public.user_trail_progress
  FOR ALL USING (auth.uid() = user_id);

-- Job offers policies
CREATE POLICY "Anyone can view active jobs" ON public.job_offers
  FOR SELECT USING (status = 'active');
CREATE POLICY "Companies can manage their jobs" ON public.job_offers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );
CREATE POLICY "CPC can manage all jobs" ON public.job_offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role IN ('manager', 'coordinator', 'admin')
    )
  );

-- Job applications policies
CREATE POLICY "Users can view their applications" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);
CREATE POLICY "Users can create applications" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Companies can view applications for their jobs" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_offers j 
      JOIN public.companies c ON j.company_id = c.id 
      WHERE j.id = job_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "Companies can update applications for their jobs" ON public.job_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_offers j 
      JOIN public.companies c ON j.company_id = c.id 
      WHERE j.id = job_id AND c.user_id = auth.uid()
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'migrant')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON public.triage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trails_updated_at BEFORE UPDATE ON public.trails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_offers_updated_at BEFORE UPDATE ON public.job_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();