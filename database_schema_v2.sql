-- ═══════════════════════════════════════════════════════════════
-- KOves — Schema Completo v2.0 (CORREGIDO)
-- Pega TODO esto en una "New Query" limpia y pulsa "Run".
-- Hemos separado la creación de tablas y las reglas de seguridad
-- para evitar errores de dependencias.
-- ═══════════════════════════════════════════════════════════════

-- 1. CREACIÓN DE TABLAS (Sin reglas de seguridad todavía)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username text UNIQUE NOT NULL,
  full_name text,
  bio text,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  initials text DEFAULT 'GR',
  color text DEFAULT '#0A0A0A',
  visibility text DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  info_public boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL UNIQUE,
  yellow_card_amount numeric(10,2) DEFAULT 2.00,
  red_card_amount numeric(10,2) DEFAULT 10.00,
  invite_visibility text DEFAULT 'all' CHECK (invite_visibility IN ('all', 'admins')),
  member_limit integer DEFAULT 20,
  code_expiry text DEFAULT 'never' CHECK (code_expiry IN ('never', '24h', '7d', '30d'))
);

CREATE TABLE IF NOT EXISTS public.group_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  type text DEFAULT 'quedada' CHECK (type IN ('quedada', 'cena', 'fiesta', 'viaje', 'escapada', 'evento', 'otro')),
  event_date timestamptz NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  mode text DEFAULT 'confirmed' CHECK (mode IN ('confirmed', 'proposed')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plan_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pendiente' CHECK (status IN ('voy', 'novoy', 'tarde', 'quizas', 'pendiente')),
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.plan_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.plan_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  parent_comment_id uuid REFERENCES public.plan_comments(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plan_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  payer_id uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validated')),
  proof_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  debtor_id uuid REFERENCES public.profiles(id) NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed')),
  proof_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sanctions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  proposed_by uuid REFERENCES public.profiles(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('amarilla', 'roja')),
  reason text NOT NULL,
  status text DEFAULT 'voting' CHECK (status IN ('voting', 'active', 'history', 'rejected')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sanction_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sanction_id uuid REFERENCES public.sanctions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vote text NOT NULL CHECK (vote IN ('favor', 'contra')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(sanction_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.plan_rankings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  voter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('mvp', 'tardon')),
  target_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  position integer CHECK (position IN (1, 2, 3)),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.roulette_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  winner text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('gasto', 'tarjeta')),
  reference_id uuid NOT NULL,
  claimant_id uuid REFERENCES public.profiles(id) NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'validated', 'rejected')),
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean DEFAULT false,
  reference_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. HABILITAR RLS Y CREAR POLÍTICAS (Ahora que las tablas ya existen)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups viewable by members" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group admins can update" ON public.groups FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.groups.id AND user_id = auth.uid() AND role = 'admin'
  )
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by group members" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Can join groups" ON public.group_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update members" ON public.group_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);
CREATE POLICY "Admins can remove members" ON public.group_members FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by members" ON public.group_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON public.group_settings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.group_settings.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "Can insert settings" ON public.group_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invites viewable" ON public.group_invites FOR SELECT USING (true);
CREATE POLICY "Members can create invites" ON public.group_invites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update invites" ON public.group_invites FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.group_invites.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans viewable by group members" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Members can create plans" ON public.plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator or admin can update plans" ON public.plans FOR UPDATE USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.plans.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);

ALTER TABLE public.plan_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance viewable" ON public.plan_attendance FOR SELECT USING (true);
CREATE POLICY "Users can set own attendance" ON public.plan_attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attendance" ON public.plan_attendance FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.plan_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable" ON public.plan_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON public.plan_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.plan_likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable" ON public.plan_comments FOR SELECT USING (true);
CREATE POLICY "Members can comment" ON public.plan_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.plan_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.plan_comments FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.plan_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photos viewable by attendees" ON public.plan_photos FOR SELECT USING (true);
CREATE POLICY "Attendees can upload photos" ON public.plan_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Expenses viewable" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Members can create expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Payer or admin can update" ON public.expenses FOR UPDATE USING (
  payer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.expenses.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Splits viewable" ON public.expense_splits FOR SELECT USING (true);
CREATE POLICY "Can create splits" ON public.expense_splits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Debtor or payer can update" ON public.expense_splits FOR UPDATE USING (
  debtor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = public.expense_splits.expense_id AND e.payer_id = auth.uid()
  )
);

ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sanctions viewable" ON public.sanctions FOR SELECT USING (true);
CREATE POLICY "Members can propose sanctions" ON public.sanctions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "System can update sanctions" ON public.sanctions FOR UPDATE USING (auth.uid() IS NOT NULL);

ALTER TABLE public.sanction_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes viewable" ON public.sanction_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON public.sanction_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.plan_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rankings viewable" ON public.plan_rankings FOR SELECT USING (true);
CREATE POLICY "Users can vote rankings" ON public.plan_rankings FOR INSERT WITH CHECK (auth.uid() = voter_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT USING (
  sender_id = auth.uid() OR recipient_id = auth.uid() OR
  (recipient_id IS NULL AND EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = public.messages.group_id AND user_id = auth.uid()
  ))
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

ALTER TABLE public.roulette_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roulette viewable" ON public.roulette_sessions FOR SELECT USING (true);
CREATE POLICY "Members can create roulette" ON public.roulette_sessions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator can update" ON public.roulette_sessions FOR UPDATE USING (auth.uid() = created_by);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Claims viewable" ON public.claims FOR SELECT USING (true);
CREATE POLICY "Members can create claims" ON public.claims FOR INSERT WITH CHECK (auth.uid() = claimant_id);
CREATE POLICY "Admins can resolve claims" ON public.claims FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.claims.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 3. TRIGGERS Y VISTAS

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE VIEW public.user_balance AS
SELECT
  gm.group_id,
  gm.user_id,
  COALESCE(paid.total_paid, 0) as total_paid,
  COALESCE(owed.total_owed, 0) as total_owed,
  COALESCE(paid.total_paid, 0) - COALESCE(owed.total_owed, 0) as balance
FROM public.group_members gm
LEFT JOIN (
  SELECT e.group_id, e.payer_id as user_id, SUM(e.amount) as total_paid
  FROM public.expenses e
  WHERE e.status = 'validated'
  GROUP BY e.group_id, e.payer_id
) paid ON paid.group_id = gm.group_id AND paid.user_id = gm.user_id
LEFT JOIN (
  SELECT e.group_id, es.debtor_id as user_id, SUM(es.amount) as total_owed
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE e.status = 'validated'
  GROUP BY e.group_id, es.debtor_id
) owed ON owed.group_id = gm.group_id AND owed.user_id = gm.user_id;

-- 4. BUCKETS DE STORAGE

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-photos', 'plan-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-proofs', 'expense-proofs', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Plan photos are accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload plan photos" ON storage.objects;
DROP POLICY IF EXISTS "Expense proofs accessible by members" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Plan photos are accessible" ON storage.objects FOR SELECT USING (bucket_id = 'plan-photos');
CREATE POLICY "Users can upload plan photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'plan-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Expense proofs accessible by members" ON storage.objects FOR SELECT USING (bucket_id = 'expense-proofs' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can upload proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'expense-proofs' AND auth.uid() IS NOT NULL);

-- 5. REALTIME

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_comments;

-- ¡FIN!
