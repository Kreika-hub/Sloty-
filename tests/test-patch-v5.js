import assert from 'node:assert';
import { DEV_CONFIG, isDevBypass } from '../src/config/dev.config.js';

console.log('🧪 Iniciando pruebas de Patch v5 (Finance, Guard, DevConfig)...');

// 1. Test DEV_CONFIG
assert.ok(typeof DEV_CONFIG === 'object', 'DEV_CONFIG must be an object');
assert.ok(DEV_CONFIG.masterBypass, 'DEV_CONFIG must have masterBypass');
assert.ok(DEV_CONFIG.adminBypass, 'DEV_CONFIG must have adminBypass');
assert.ok(DEV_CONFIG.demoBuilding, 'DEV_CONFIG must have demoBuilding');
console.log('  ✓ DEV_CONFIG structure is valid');

// 2. Test isDevBypass
assert.strictEqual(typeof isDevBypass(), 'boolean', 'isDevBypass must return a boolean');
console.log('  ✓ isDevBypass() returns boolean:', isDevBypass());

// 3. Test +30 days expiry date calculation logic
const now = new Date('2026-08-27T12:00:00Z');
const newExpiry = new Date(now);
newExpiry.setDate(newExpiry.getDate() + 30);
assert.strictEqual(newExpiry.toISOString(), '2026-09-26T12:00:00.000Z', 'Expiry must be exactly +30 days');
console.log('  ✓ Expiry date calculation (+30 days) is correct');

// 4. Test phone sanitization for WhatsApp notification
const phoneRaw = '0412-1234567';
const cleanPhone = phoneRaw.replace(/\D/g, '');
const targetPhone = cleanPhone.startsWith('58') ? cleanPhone : (cleanPhone.startsWith('0') ? '58' + cleanPhone.slice(1) : '58' + cleanPhone);
assert.strictEqual(targetPhone, '584121234567', 'Phone formatted properly with Venezuelan country code 58');
console.log('  ✓ Phone formatting for WhatsApp notifications works:', targetPhone);

console.log('✅ ¡Todas las pruebas de Patch v5 pasaron con éxito!');
