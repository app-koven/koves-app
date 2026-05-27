-- Añadir nuevas opciones de reglas de grupo
ALTER TABLE public.group_settings ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'private' CHECK (privacy IN ('public', 'private'));
ALTER TABLE public.group_settings ADD COLUMN IF NOT EXISTS allow_invites TEXT DEFAULT 'all' CHECK (allow_invites IN ('all', 'admins'));
