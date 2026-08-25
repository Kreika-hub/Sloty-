import assert from 'node:assert';
import { generateBuildingCode, generateUniqueBuildingCode, validateEmail, validateVenezuelanPhone, validateReceiptFile } from '../src/modules/onboarding.js';
import { formatActivationWhatsAppMessage, formatRejectionWhatsAppMessage, sanitizePhoneNumber } from '../src/utils/notifier.js';

console.log('🧪 Iniciando pruebas de Onboarding y Master Bóveda...');

// 1. Test generateBuildingCode
const code1 = generateBuildingCode('Residencias Altamira Park');
console.log('  ✓ Generated building code:', code1);
assert.ok(code1.startsWith('RESIDEN-') || code1.startsWith('RESID-'), 'Building code must start with sanitized prefix');
assert.strictEqual(code1.length >= 8, true, 'Building code has sufficient length');

// 2. Test validateEmail
assert.strictEqual(validateEmail('admin@altamira.com'), true, 'Valid email must pass');
assert.strictEqual(validateEmail('invalid-email'), false, 'Invalid email must fail');
assert.strictEqual(validateEmail(''), false, 'Empty email must fail');

// 3. Test validateVenezuelanPhone
assert.strictEqual(validateVenezuelanPhone('04121234567'), true, '0412... must pass');
assert.strictEqual(validateVenezuelanPhone('+584141234567'), true, '+58414... must pass');
assert.strictEqual(validateVenezuelanPhone('0424-9876543'), true, '0424 with dash must pass');
assert.strictEqual(validateVenezuelanPhone('123456'), false, 'Short number must fail');

// 4. Test sanitizePhoneNumber
assert.strictEqual(sanitizePhoneNumber('0412-123-4567'), '584121234567', 'Sanitizes 0412 to 58412');
assert.strictEqual(sanitizePhoneNumber('+58 414 765 4321'), '584147654321', 'Sanitizes +58 prefix');

// 5. Test validateReceiptFile
const validMockFile = { name: 'recibo_pago.png', size: 1024 * 1024, type: 'image/png' };
const invalidMockFile = { name: 'script.exe', size: 1024, type: 'application/x-msdownload' };
const largeMockFile = { name: 'comprobante.pdf', size: 12 * 1024 * 1024, type: 'application/pdf' };

assert.strictEqual(validateReceiptFile(validMockFile).valid, true, 'Valid PNG must pass');
assert.strictEqual(validateReceiptFile(invalidMockFile).valid, false, 'EXE file must fail');
assert.strictEqual(validateReceiptFile(largeMockFile).valid, false, 'File > 10MB must fail');

// 6. Test formatActivationWhatsAppMessage
const activationMsg = formatActivationWhatsAppMessage({
  buildingName: 'Residencias Los Samanes',
  buildingCode: 'LOS-SAM-4912',
  planLabel: 'ORO',
  expiryDate: new Date('2026-12-31').toISOString(),
  activationCode: '839201',
  adminPhone: '04121234567'
});
assert.ok(activationMsg.messageText.includes('839201'), 'Activation message must contain the 6-digit code');
assert.ok(activationMsg.messageText.includes('LOS-SAM-4912'), 'Activation message must contain the building code');
assert.ok(activationMsg.whatsappUrl.includes('584121234567'), 'WhatsApp link must target clean phone number');

// 7. Test formatRejectionWhatsAppMessage
const rejectionMsg = formatRejectionWhatsAppMessage({
  buildingName: 'Residencias Los Samanes',
  adminName: 'Carlos Mendoza',
  adminPhone: '04121234567',
  planLabel: 'BRONCE',
  reason: 'Referencia bancaria no encontrada en la cuenta'
});
assert.ok(rejectionMsg.messageText.includes('Referencia bancaria no encontrada'), 'Rejection message must contain the reason');
// 8. Test generateUniqueBuildingCode (with mock supabase client)
const mockSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null })
      })
    })
  })
};

const uniqueCode = await generateUniqueBuildingCode('Torre Platinum', mockSupabase);
console.log('  ✓ Generated unique building code:', uniqueCode);
assert.ok(uniqueCode.startsWith('PLAT-') || uniqueCode.startsWith('TORR-'), 'Unique code starts with correct prefix');

console.log('✅ ¡Todas las pruebas unitarias y de integración pasaron satisfactoriamente!');

