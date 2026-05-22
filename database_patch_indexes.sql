-- Parche de Índices de Base de Datos para Escalabilidad
-- Ejecutar en Supabase SQL Editor para evitar Full Table Scans

-- Índices para la tabla group_members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Índices para la tabla plans
CREATE INDEX IF NOT EXISTS idx_plans_group_id ON public.plans(group_id);
CREATE INDEX IF NOT EXISTS idx_plans_event_date ON public.plans(event_date);

-- Índices para plan_attendance
CREATE INDEX IF NOT EXISTS idx_plan_attendance_plan_id ON public.plan_attendance(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_attendance_user_id ON public.plan_attendance(user_id);

-- Índices para expenses y expense_splits
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer_id ON public.expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_debtor_id ON public.expense_splits(debtor_id);

-- Índices para notificaciones y mensajes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_group_id ON public.notifications(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Índices para sanciones y tribunal
CREATE INDEX IF NOT EXISTS idx_sanctions_group_id ON public.sanctions(group_id);
CREATE INDEX IF NOT EXISTS idx_sanction_votes_sanction_id ON public.sanction_votes(sanction_id);

-- Índices para plan_rankings
CREATE INDEX IF NOT EXISTS idx_plan_rankings_plan_id ON public.plan_rankings(plan_id);
