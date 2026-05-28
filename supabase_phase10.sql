-- ════════════════════════════════════════════════════════════
-- KOves - Fase 10: Notificaciones y Triggers
-- ════════════════════════════════════════════════════════════

-- 1. Asegurar la tabla notificaciones
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

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true); -- Allow triggers to insert


-- 2. Función Trigger para Gastos y Deudas (expense_splits)
CREATE OR REPLACE FUNCTION notify_expense_splits()
RETURNS TRIGGER AS $$
DECLARE
  v_expense record;
  v_payer_name text;
  v_debtor_name text;
BEGIN
  -- Obtener información del gasto padre
  SELECT * INTO v_expense FROM public.expenses WHERE id = NEW.expense_id;
  
  -- Obtener nombres
  SELECT full_name INTO v_payer_name FROM public.profiles WHERE id = v_expense.payer_id;
  SELECT full_name INTO v_debtor_name FROM public.profiles WHERE id = NEW.debtor_id;
  
  IF v_payer_name IS NULL THEN v_payer_name := 'Un usuario'; END IF;
  IF v_debtor_name IS NULL THEN v_debtor_name := 'Un usuario'; END IF;

  -- CASO 1: Nueva deuda insertada (pendiente)
  IF (TG_OP = 'INSERT') AND NEW.status = 'pending' THEN
    -- Notificar al deudor que tiene un nuevo gasto
    IF NEW.debtor_id != v_expense.payer_id THEN
      INSERT INTO public.notifications (user_id, group_id, type, title, body, reference_id)
      VALUES (NEW.debtor_id, v_expense.group_id, 'gasto', v_payer_name || ' te ha incluido en un gasto', 'Importe: ' || NEW.amount || '€ - ' || v_expense.title, NEW.expense_id);
    END IF;
  
  -- CASO 2: Deuda enviada para revisión (requested)
  ELSIF (TG_OP = 'UPDATE') AND NEW.status = 'requested' AND OLD.status = 'pending' THEN
    -- Notificar al pagador original que alguien le ha enviado dinero
    INSERT INTO public.notifications (user_id, group_id, type, title, body, reference_id)
    VALUES (v_expense.payer_id, v_expense.group_id, 'pago', v_debtor_name || ' te ha liquidado una deuda', 'Por favor, confirma la recepción de ' || NEW.amount || '€.', NEW.expense_id);
    
  -- CASO 3: Deuda confirmada (paid)
  ELSIF (TG_OP = 'UPDATE') AND NEW.status = 'paid' AND OLD.status = 'requested' THEN
    -- Notificar al deudor de que el pagador ha confirmado la recepción
    INSERT INTO public.notifications (user_id, group_id, type, title, body, reference_id)
    VALUES (NEW.debtor_id, v_expense.group_id, 'pago_ok', v_payer_name || ' confirmó tu pago', 'Pago de ' || NEW.amount || '€ recibido correctamente.', NEW.expense_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar si existía
DROP TRIGGER IF EXISTS trg_notify_expense_splits ON public.expense_splits;
-- Crear trigger
CREATE TRIGGER trg_notify_expense_splits
AFTER INSERT OR UPDATE ON public.expense_splits
FOR EACH ROW
EXECUTE FUNCTION notify_expense_splits();


-- 3. Función Trigger para Sanciones (sanctions)
CREATE OR REPLACE FUNCTION notify_sanctions()
RETURNS TRIGGER AS $$
DECLARE
  v_proposer_name text;
BEGIN
  SELECT full_name INTO v_proposer_name FROM public.profiles WHERE id = NEW.proposed_by;
  IF v_proposer_name IS NULL THEN v_proposer_name := 'Alguien'; END IF;

  IF (TG_OP = 'INSERT') THEN
    -- Notificar a la persona afectada
    INSERT INTO public.notifications (user_id, group_id, type, title, body, reference_id)
    VALUES (NEW.target_user_id, NEW.group_id, 'tarjeta', v_proposer_name || ' te ha propuesto para una tarjeta ' || NEW.type, 'Motivo: ' || NEW.reason, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar si existía
DROP TRIGGER IF EXISTS trg_notify_sanctions ON public.sanctions;
-- Crear trigger
CREATE TRIGGER trg_notify_sanctions
AFTER INSERT ON public.sanctions
FOR EACH ROW
EXECUTE FUNCTION notify_sanctions();


-- 4. Habilitar tiempo real en notificaciones si no lo estaba
-- (Comentado porque suele dar error si la tabla ya está en la publicación)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
