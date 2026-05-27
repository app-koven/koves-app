-- ==========================================
-- KOves App - Supabase Setup (Fase 6)
-- Tablas para Tarjetas, Etiquetas y Ruleta
-- ==========================================

-- 1. Tarjetas Personalizadas del Grupo
CREATE TABLE IF NOT EXISTS public.group_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#C07000',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tarjetas Asignadas (Propuestas en un plan)
CREATE TABLE IF NOT EXISTS public.assigned_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
    group_card_id UUID REFERENCES public.group_cards(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    proposed_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Votos de Tarjetas Asignadas
CREATE TABLE IF NOT EXISTS public.assigned_card_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assigned_card_id UUID REFERENCES public.assigned_cards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote TEXT CHECK (vote IN ('favor', 'contra')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(assigned_card_id, user_id)
);

-- 4. Etiquetas Semanales del Grupo
CREATE TABLE IF NOT EXISTS public.group_labels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Votación Semanal (Votos individuales)
CREATE TABLE IF NOT EXISTS public.weekly_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    label_id UUID REFERENCES public.group_labels(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    voted_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, week_start_date, label_id, voter_id)
);

-- 6. Historial de Ganadores de Etiquetas (Vitrina)
CREATE TABLE IF NOT EXISTS public.label_winners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    label_id UUID REFERENCES public.group_labels(id) ON DELETE CASCADE,
    winner_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, week_start_date, label_id)
);

-- 7. Historial de Ruletas
CREATE TABLE IF NOT EXISTS public.roulette_spins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    winner TEXT NOT NULL,
    options JSONB NOT NULL,
    spun_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- Nota: Activa RLS en la interfaz gráfica de Supabase para estas tablas
-- o ejecuta lo siguiente si lo prefieres por código:
-- ==========================================
ALTER TABLE public.group_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_card_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

-- Por simplicidad (ya que RLS puede ser complejo de afinar), 
-- crearemos políticas que permitan a usuarios autenticados leer y escribir en todas estas tablas, 
-- delegando la lógica de negocio al cliente y Edge Functions.
CREATE POLICY "Enable read/write access for all authenticated users" ON public.group_cards FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.assigned_cards FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.assigned_card_votes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.group_labels FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.weekly_votes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.label_winners FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read/write access for all authenticated users" ON public.roulette_spins FOR ALL USING (auth.role() = 'authenticated');
