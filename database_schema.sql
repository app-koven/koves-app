-- Schema para KOves App
-- Puedes copiar y pegar todo este archivo en el SQL Editor de Supabase y darle a "Run"

-- 1. Tabla de Usuarios (Profiles)
CREATE TABLE public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security para Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Tabla de Grupos
CREATE TABLE public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id)
);

-- 3. Tabla de Miembros del Grupo (Members)
CREATE TABLE public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- 4. Tabla de Planes (Eventos)
CREATE TABLE public.plans (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  title text not null,
  description text,
  event_date timestamp with time zone not null,
  created_by uuid references public.profiles(id),
  status text default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Asistencia a Planes (Attendance)
CREATE TABLE public.plan_attendance (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('voy', 'novoy', 'tarde', 'quizas', 'pendiente')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(plan_id, user_id)
);

-- 6. Tabla de Gastos (Expenses)
CREATE TABLE public.expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  plan_id uuid references public.plans(id) on delete set null,
  payer_id uuid references public.profiles(id) not null,
  title text not null,
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending', 'validated')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Deudas / Transferencias (Debts)
CREATE TABLE public.expense_debts (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  debtor_id uuid references public.profiles(id) not null,
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending', 'paid', 'confirmed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Sanciones (Discipline / Bote)
CREATE TABLE public.sanctions (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  type text check (type in ('amarilla', 'roja')),
  reason text,
  amount numeric(10,2) not null,
  status text default 'active' check (status in ('active', 'history')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Desactivar RLS en estas tablas temporalmente para simplificar el prototipo
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions DISABLE ROW LEVEL SECURITY;

-- Insertar datos de prueba básicos para arrancar
INSERT INTO public.groups (name, description) VALUES ('EL CLUB', 'Creado en enero 2025');
