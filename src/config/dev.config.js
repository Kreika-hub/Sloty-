/**
 * Configuración de desarrollo — SOLO disponible en VITE_DEV
 * NUNCA se incluye en builds de producción
 */
export const DEV_CONFIG = {
  enabled: import.meta.env?.DEV === true,
  masterBypass: {
    email: 'nucita',
    password: 'nucita123'
  },
  adminBypass: {
    email: 'nucita.admin',
    password: '1234'
  },
  demoBuilding: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Edificio Demo Sloty',
    code: 'DEV-001',
    plan: 'ORO',
    membership_status: 'ACTIVE'
  }
};

export const isDevBypass = () => DEV_CONFIG.enabled;
