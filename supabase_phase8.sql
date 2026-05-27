-- ==========================================
-- KOves App - Supabase Setup (Fase 8)
-- Actualización de Reglas de Grupo
-- ==========================================

-- 1. Añadir columnas a group_settings
ALTER TABLE public.group_settings 
ADD COLUMN IF NOT EXISTS pot_goal TEXT DEFAULT 'Cena de grupo',
ADD COLUMN IF NOT EXISTS show_info_if_private BOOLEAN DEFAULT true;

-- Asegurarnos de que las columnas de privacidad previas están correctas
-- (Si se ejecutó la fase 7, privacy y allow_invites ya existirán, pero por si acaso)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_settings' AND column_name='privacy') THEN
        ALTER TABLE public.group_settings ADD COLUMN privacy TEXT DEFAULT 'private' CHECK (privacy IN ('public', 'private'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_settings' AND column_name='allow_invites') THEN
        ALTER TABLE public.group_settings ADD COLUMN allow_invites TEXT DEFAULT 'all' CHECK (allow_invites IN ('admin', 'all'));
    END IF;
END $$;
