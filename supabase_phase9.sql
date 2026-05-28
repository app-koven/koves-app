-- ════════════════════════════════════════════════════════════
-- KOves - Fase 9: Gastos, Deudas y Comprobantes
-- ════════════════════════════════════════════════════════════

-- 1. Añadir columna para la url del comprobante de pago
ALTER TABLE public.expense_splits
ADD COLUMN IF NOT EXISTS proof_url text;

-- 2. Asegurar que el bucket de comprobantes existe (si no existía ya)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expense-proofs', 'expense-proofs', false) 
ON CONFLICT DO NOTHING;

-- 3. Políticas de seguridad para el bucket de comprobantes
-- Solo los usuarios autenticados pueden subir comprobantes
DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;
CREATE POLICY "Users can upload proofs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'expense-proofs' AND auth.uid() IS NOT NULL);

-- Los usuarios autenticados pueden ver los comprobantes
DROP POLICY IF EXISTS "Expense proofs accessible by members" ON storage.objects;
CREATE POLICY "Expense proofs accessible by members" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'expense-proofs' AND auth.uid() IS NOT NULL);

-- Los usuarios pueden actualizar sus propios comprobantes
DROP POLICY IF EXISTS "Users can update own proofs" ON storage.objects;
CREATE POLICY "Users can update own proofs" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'expense-proofs' AND auth.uid() = owner);
