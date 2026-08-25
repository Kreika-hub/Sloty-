-- ============================================================
-- Migración: subscription_requests y RPCs atómicas
-- Sloty | Renovación Comercial - Flujo de Onboarding & Bóveda Master
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA PRINCIPAL DE SOLICITUDES
CREATE TABLE IF NOT EXISTS subscription_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_name TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('TRIAL', 'BRONCE', 'PLATA', 'ORO')),
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_bs NUMERIC(15,2) NOT NULL DEFAULT 0,
  bcv_rate_used NUMERIC(10,4) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  receipt_url TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  city TEXT,
  address TEXT,
  ip_address TEXT, -- Campo para rate-limiting backend futuro (Deuda técnica MVP)
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

-- 2. ÍNDICES CRÍTICOS PARA CONSULTAS Y CONCURRENCIA
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON subscription_requests(status);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_created_at ON subscription_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_plan_id ON subscription_requests(plan_id);

-- 3. POLÍTICAS DE SEGURIDAD RLS
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

-- Permitir inserción anónima / pública desde el Onboarding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_requests' AND policyname = 'Allow public insert for onboarding'
  ) THEN
    CREATE POLICY "Allow public insert for onboarding"
      ON subscription_requests FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Permitir lectura y actualización exclusivamente a usuarios autenticados del Panel Master
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_requests' AND policyname = 'Allow master users to read requests'
  ) THEN
    CREATE POLICY "Allow master users to read requests"
      ON subscription_requests FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_requests' AND policyname = 'Allow master users to update requests'
  ) THEN
    CREATE POLICY "Allow master users to update requests"
      ON subscription_requests FOR UPDATE
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. RPC ATÓMICA DE APROBACIÓN: approve_subscription_request()
CREATE OR REPLACE FUNCTION approve_subscription_request(
  p_request_id UUID,
  p_reviewed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_building_id UUID;
  v_membership_id UUID;
  v_activation_code TEXT;
  v_building_code TEXT;
  v_prefix TEXT;
  v_plan_features JSONB;
  v_result JSONB;
  v_code_exists BOOLEAN;
  v_attempts INT := 0;
BEGIN
  -- 1. Bloquear la fila para evitar concurrencia y condiciones de carrera
  SELECT * INTO v_request
  FROM subscription_requests
  WHERE id = p_request_id
    AND status = 'PENDING_APPROVAL'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solicitud no encontrada o ya procesada'
    );
  END IF;

  -- 2. Generar building_code único dentro de la base de datos (con verificación de unicidad)
  v_prefix := upper(regexp_replace(v_request.building_name, '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_prefix) < 3 THEN
    v_prefix := 'SLO';
  ELSE
    v_prefix := substr(v_prefix, 1, 4);
  END IF;

  LOOP
    v_building_code := v_prefix || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM buildings WHERE code = v_building_code) INTO v_code_exists;
    EXIT WHEN NOT v_code_exists OR v_attempts >= 10;
    v_attempts := v_attempts + 1;
  END LOOP;

  -- 3. Generar activation_code de 6 dígitos
  v_activation_code := lpad(floor(random() * 1000000)::text, 6, '0');

  -- 4. Definir features según el plan
  v_plan_features := CASE v_request.plan_id
    WHEN 'TRIAL' THEN '{"max_posts": 15, "guardia": false, "residents": false, "multi_level": false, "whatsapp_alerts": false, "audit": false, "billboard": false, "support_24_7": false}'::JSONB
    WHEN 'BRONCE' THEN '{"max_posts": 30, "guardia": true, "residents": true, "multi_level": false, "whatsapp_alerts": false, "audit": false, "billboard": false, "support_24_7": false}'::JSONB
    WHEN 'PLATA' THEN '{"max_posts": 150, "guardia": true, "residents": true, "multi_level": true, "whatsapp_alerts": true, "audit": false, "billboard": false, "support_24_7": false}'::JSONB
    WHEN 'ORO' THEN '{"max_posts": 999999, "guardia": true, "residents": true, "multi_level": true, "whatsapp_alerts": true, "audit": true, "billboard": true, "support_24_7": true}'::JSONB
    ELSE '{"max_posts": 30, "guardia": true, "residents": true, "multi_level": false, "whatsapp_alerts": false, "audit": false, "billboard": false, "support_24_7": false}'::JSONB
  END;

  -- 5. Crear el edificio en la tabla buildings (incluyendo coordenadas GPS y dirección)
  INSERT INTO buildings (
    name,
    code,
    admin_name,
    phone,
    admin_email,
    plan,
    membership_status,
    membership_expiry,
    features,
    lat,
    lng,
    city,
    address,
    is_first_login,
    monthly_rate,
    created_at
  ) VALUES (
    v_request.building_name,
    v_building_code,
    v_request.admin_name,
    v_request.phone,
    v_request.email,
    v_request.plan_id,
    'ACTIVE',
    NOW() + INTERVAL '30 days',
    v_plan_features,
    v_request.lat,
    v_request.lng,
    v_request.city,
    v_request.address,
    false,
    20,
    NOW()
  )
  RETURNING id INTO v_building_id;

  -- 6. Insertar en sloty_memberships
  INSERT INTO sloty_memberships (
    building_id,
    plan_key,
    activation_code,
    status,
    paid_at,
    expiry_date
  ) VALUES (
    v_building_id,
    v_request.plan_id,
    v_activation_code,
    'CONFIRMED',
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_membership_id;

  -- 7. Actualizar la solicitud a APPROVED
  UPDATE subscription_requests
  SET status = 'APPROVED',
      reviewed_at = NOW(),
      reviewed_by = p_reviewed_by,
      building_id = v_building_id
  WHERE id = p_request_id;

  -- 8. Construir respuesta atómica
  v_result := jsonb_build_object(
    'success', true,
    'building_id', v_building_id,
    'building_code', v_building_code,
    'activation_code', v_activation_code,
    'membership_id', v_membership_id,
    'plan_id', v_request.plan_id,
    'admin_name', v_request.admin_name,
    'admin_phone', v_request.phone
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- 5. RPC DE RECHAZO: reject_subscription_request()
CREATE OR REPLACE FUNCTION reject_subscription_request(
  p_request_id UUID,
  p_reviewed_by UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscription_requests
  SET status = 'REJECTED',
      reviewed_at = NOW(),
      reviewed_by = p_reviewed_by,
      rejection_reason = p_rejection_reason
  WHERE id = p_request_id
    AND status = 'PENDING_APPROVAL';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada o ya procesada');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
