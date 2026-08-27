-- ============================================================
-- Migración: confirmed_at, rejected_at en payments e índices
-- Sloty | Patch v5
-- ============================================================

-- Agregar si no existen
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Índice para performance en consultas de pagos pendientes y confirmados
CREATE INDEX IF NOT EXISTS idx_payments_building_status
ON payments(building_id, status);
