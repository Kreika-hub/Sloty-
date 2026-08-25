import { getParkingState, saveParkingState, logAudit, supabase, getExchangeRate } from '../db.js'
import { notifyMasterPayment, generateActivationCode, formatActivationWhatsAppMessage, formatRejectionWhatsAppMessage, sanitizePhoneNumber } from '../utils/notifier.js'
import { generateBuildingCode } from './onboarding.js'
import { escapeHTML } from '../utils/sanitize.js'

export const initMaster = (container) => {
  let activeTab = 'NOTIFICATIONS'
  let selectedBuilding = null
  let selectedBuildingData = null
  let buildingStats = null
  let recentMemberships = []
  let masterChannel = null
  let pendingProofsCount = 0
  let notifCount = 0
  let masterNotifyFilter = 'PENDING' // PENDING, CONFIRMED, REJECTED, ALL
  
  // DOM Cache
  let elContent = null
  let elShell = null

  const FEATURES = [
    { key: 'finance_module',         label: 'Módulo de Finanzas / Caja', icon: '💰' },
    { key: 'whatsapp_notifications', label: 'Notificaciones WhatsApp',   icon: '📱' },
    { key: 'reports_module',         label: 'Módulo de Reportes',        icon: '📊' },
    { key: 'debt_tracking',          label: 'Control de Deudas',         icon: '💸' },
    { key: 'frequent_visitors',      label: 'Visitantes Frecuentes',     icon: '🔁' },
    { key: 'audit_log',              label: 'Bitácora de Auditoría',     icon: '📋' },
    { key: 'multi_level',            label: 'Multinivel / Pisos',        icon: '🏢' },
  ]
  const PLANS = [
    { key: 'TRIAL',  label: 'Trial',  maxSlots: 15,  color: '#888' },
    { key: 'BRONCE', label: 'Bronce', maxSlots: 30,  color: '#cd7f32' },
    { key: 'PLATA',  label: 'Plata',  maxSlots: 150, color: '#aaa'    },
    { key: 'ORO',    label: 'Oro',    maxSlots: 999, color: '#F5C518' },
  ]

  const getState = () => getParkingState()

  const showActivationModal = ({ buildingName, planLabel, activationCode, expiryDate, whatsappUrl, messageText, phone }) => {
    const existing = document.getElementById('activation-modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'activation-modal-overlay';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:10001; padding:20px; font-family:Montserrat,sans-serif;';
    modal.innerHTML = `
      <div style="background:#1a1a2e; border:1.5px solid rgba(245,197,24,0.3); border-radius:28px; width:100%; max-width:440px; padding:30px; box-sizing:border-box; color:white; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.5);">
        <div style="font-size:3rem; margin-bottom:12px;">🎉</div>
        <div style="font-size:1.3rem; font-weight:900; color:#22c55e; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">¡Membresía Aprobada!</div>
        <div style="font-size:0.8rem; color:#bbb; margin-bottom:20px;">Edificio: <strong style="color:white;">${escapeHTML(buildingName)}</strong> · Plan <strong style="color:#F5C518;">${escapeHTML(planLabel)}</strong></div>
        
        <div style="background:rgba(255,255,255,0.05); border:2px dashed #F5C518; border-radius:18px; padding:16px; margin-bottom:20px;">
          <div style="font-size:0.65rem; color:#999; text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:4px;">Código de Activación Generado</div>
          <div style="font-size:2rem; font-weight:900; color:#F5C518; letter-spacing:4px; font-family:monospace;">${activationCode}</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button id="btn-copy-activation-msg" style="width:100%; padding:15px; background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:14px; font-weight:800; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
            📋 Copiar mensaje para WhatsApp
          </button>
          ${whatsappUrl ? `
            <a href="${whatsappUrl}" target="_blank" style="width:100%; padding:15px; background:#22c55e; color:white; border-radius:14px; font-weight:900; font-size:0.85rem; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; box-sizing:border-box;">
              💬 Enviar WhatsApp al Administrador (${phone || ''})
            </a>
          ` : ''}
          <button id="btn-close-activation-modal" style="width:100%; padding:12px; background:none; color:#888; border:none; font-weight:700; font-size:0.75rem; cursor:pointer; margin-top:5px;">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-copy-activation-msg').onclick = () => {
      navigator.clipboard.writeText(messageText).then(() => {
        const btn = modal.querySelector('#btn-copy-activation-msg');
        btn.innerHTML = '✅ ¡Mensaje copiado al portapapeles!';
        setTimeout(() => { btn.innerHTML = '📋 Copiar mensaje para WhatsApp'; }, 2000);
      });
    };

    modal.querySelector('#btn-close-activation-modal').onclick = () => modal.remove();
  };

  const showRejectionModal = ({ buildingName, planLabel, rejectionReason, whatsappUrl, messageText, phone }) => {
    const existing = document.getElementById('rejection-modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'rejection-modal-overlay';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:10001; padding:20px; font-family:Montserrat,sans-serif;';
    modal.innerHTML = `
      <div style="background:#1a1a2e; border:1.5px solid rgba(230,57,70,0.4); border-radius:28px; width:100%; max-width:440px; padding:30px; box-sizing:border-box; color:white; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.5);">
        <div style="font-size:3rem; margin-bottom:12px;">⚠️</div>
        <div style="font-size:1.2rem; font-weight:900; color:#e63946; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Solicitud Rechazada</div>
        <div style="font-size:0.8rem; color:#bbb; margin-bottom:16px;">Edificio: <strong style="color:white;">${escapeHTML(buildingName)}</strong> · Plan <strong style="color:#F5C518;">${escapeHTML(planLabel)}</strong></div>
        
        <div style="background:rgba(230,57,70,0.08); border:1px solid rgba(230,57,70,0.3); border-radius:14px; padding:14px; margin-bottom:20px; font-size:0.8rem; text-align:left; color:#ffccd5; line-height:1.4;">
          <b>Motivo de rechazo registrado:</b><br>${escapeHTML(rejectionReason)}
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button id="btn-copy-rejection-msg" style="width:100%; padding:14px; background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:14px; font-weight:800; font-size:0.8rem; cursor:pointer;">
            📋 Copiar mensaje para WhatsApp
          </button>
          ${whatsappUrl ? `
            <a href="${whatsappUrl}" target="_blank" style="width:100%; padding:14px; background:#25D366; color:white; border-radius:14px; font-weight:900; font-size:0.85rem; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; box-sizing:border-box;">
              💬 Notificar al Administrador por WhatsApp (${phone || ''})
            </a>
          ` : ''}
          <button id="btn-close-rejection-modal" style="width:100%; padding:10px; background:none; color:#888; border:none; font-weight:700; font-size:0.75rem; cursor:pointer;">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-copy-rejection-msg').onclick = () => {
      navigator.clipboard.writeText(messageText).then(() => {
        const btn = modal.querySelector('#btn-copy-rejection-msg');
        btn.innerHTML = '✅ ¡Mensaje copiado al portapapeles!';
        setTimeout(() => { btn.innerHTML = '📋 Copiar mensaje para WhatsApp'; }, 2000);
      });
    };

    modal.querySelector('#btn-close-rejection-modal').onclick = () => modal.remove();
  };

  // ─── SISTEMA DE MODALES NATIVOS ESTILIZADOS PARA MASTER ───────
  const showMasterAlert = (title, message, icon = 'ℹ️') => {
    const existing = document.getElementById('master-alert-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'master-alert-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;';
    modal.innerHTML = `
      <div style="background:#1a1a2e; border-radius:24px; padding:28px 24px; width:100%; max-width:380px; text-align:center; border:1px solid rgba(255,255,255,0.1); box-shadow:0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size:3rem; margin-bottom:12px;">${icon}</div>
        <div style="font-size:1.15rem; font-weight:900; color:white; margin-bottom:8px;">${escapeHTML(title)}</div>
        <div style="font-size:0.8rem; color:rgba(255,255,255,0.7); line-height:1.5; margin-bottom:24px;">${escapeHTML(message)}</div>
        <button id="master-alert-btn" style="width:100%; padding:15px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px;">ENTENDIDO</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#master-alert-btn').onclick = () => modal.remove();
  };

  const showMasterConfirm = ({ title, message, icon = '⚠️', confirmText = 'CONFIRMAR', cancelText = 'CANCELAR', isDestructive = false, onConfirm }) => {
    const existing = document.getElementById('master-confirm-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'master-confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;';
    modal.innerHTML = `
      <div style="background:#1a1a2e; border-radius:24px; padding:28px 24px; width:100%; max-width:380px; text-align:center; border:1px solid rgba(255,255,255,0.1); box-shadow:0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size:3rem; margin-bottom:12px;">${icon}</div>
        <div style="font-size:1.15rem; font-weight:900; color:white; margin-bottom:8px;">${escapeHTML(title)}</div>
        <div style="font-size:0.8rem; color:rgba(255,255,255,0.7); line-height:1.5; margin-bottom:24px;">${escapeHTML(message)}</div>
        <div style="display:flex; gap:10px;">
          <button id="master-confirm-cancel" style="flex:1; padding:14px; background:rgba(255,255,255,0.08); color:white; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">${escapeHTML(cancelText)}</button>
          <button id="master-confirm-ok" style="flex:1.5; padding:14px; background:${isDestructive ? '#e63946' : '#F5C518'}; color:${isDestructive ? 'white' : '#1a1a2e'}; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#master-confirm-cancel').onclick = () => modal.remove();
    modal.querySelector('#master-confirm-ok').onclick = async () => {
      modal.remove();
      if (onConfirm) await onConfirm();
    };
  };

  const showMasterPrompt = ({ title, message, placeholder = '', defaultValue = '', icon = '✏️', confirmText = 'GUARDAR', onConfirm }) => {
    const existing = document.getElementById('master-prompt-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'master-prompt-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;';
    modal.innerHTML = `
      <div style="background:#1a1a2e; border-radius:24px; padding:28px 24px; width:100%; max-width:380px; text-align:center; border:1px solid rgba(255,255,255,0.1); box-shadow:0 25px 60px rgba(0,0,0,0.6);">
        <div style="font-size:2.5rem; margin-bottom:10px;">${icon}</div>
        <div style="font-size:1.1rem; font-weight:900; color:white; margin-bottom:6px;">${escapeHTML(title)}</div>
        <div style="font-size:0.75rem; color:rgba(255,255,255,0.6); margin-bottom:16px;">${escapeHTML(message)}</div>
        <input id="master-prompt-input" type="text" value="${escapeHTML(defaultValue)}" placeholder="${escapeHTML(placeholder)}"
          style="width:100%; padding:14px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.06); color:white; font-weight:700; font-size:0.9rem; margin-bottom:20px; box-sizing:border-box; outline:none; text-align:center;">
        <div style="display:flex; gap:10px;">
          <button id="master-prompt-cancel" style="flex:1; padding:14px; background:rgba(255,255,255,0.08); color:white; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">CANCELAR</button>
          <button id="master-prompt-ok" style="flex:1.5; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const input = modal.querySelector('#master-prompt-input');
    input.focus();
    modal.querySelector('#master-prompt-cancel').onclick = () => modal.remove();
    modal.querySelector('#master-prompt-ok').onclick = async () => {
      const val = input.value.trim();
      modal.remove();
      if (onConfirm) await onConfirm(val);
    };
  };

  // ─── MODAL DE COTEJO Y COBRO MULTI-MONEDA / MULTI-MÉTODO ─────
  const showMasterPaymentModal = async ({ building, preselectedPlan = null, onConfirmed }) => {
    const existing = document.getElementById('master-payment-modal-overlay');
    if (existing) existing.remove();

    const bcvData = await getExchangeRate().catch(() => ({ rate: 40.0 }));
    const bcvRate = Number(bcvData?.rate || 40.0);

    const { data: proofs } = await supabase
      .from('building_payment_proofs')
      .select('*')
      .eq('building_id', building.id)
      .order('created_at', { ascending: false })
      .limit(6);

    const pendingProofs = (proofs || []).filter(p => p.status === 'PENDING');

    const PLAN_PRICES = { TRIAL: 0, BRONCE: 29, PLATA: 59, ORO: 99 };
    let currentPlan = preselectedPlan || building.plan || 'BRONCE';
    let currentMethod = 'EFECTIVO_USD';
    let currentAmount = PLAN_PRICES[currentPlan] || 29;

    const modal = document.createElement('div');
    modal.id = 'master-payment-modal-overlay';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:flex-end; justify-content:center; z-index:99999; overflow-y:auto; font-family:Montserrat,sans-serif;';
    
    modal.innerHTML = `
      <div style="background:#1a1a2e; border-radius:24px 24px 0 0; padding:24px; width:100%; max-width:540px; border:1px solid rgba(255,255,255,0.1); max-height:90vh; overflow-y:auto; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-size:0.65rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1.5px;">Gestión de Cobro & Membresía</div>
            <div style="font-size:1.15rem; font-weight:900; color:white;">${escapeHTML(building.name)}</div>
          </div>
          <button id="btn-close-pay-modal" style="background:rgba(255,255,255,0.08); color:white; border:none; border-radius:50%; width:36px; height:36px; font-weight:900; cursor:pointer;">✕</button>
        </div>

        <!-- SECCIÓN 1: COTEJO DE COMPROBANTES DE LA NUBE -->
        <div style="background:rgba(255,255,255,0.04); border-radius:16px; padding:14px; margin-bottom:18px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; display:flex; justify-content:space-between;">
            <span>🔍 Cotejo de Pagos Recibidos</span>
            <span style="color:${pendingProofs.length > 0 ? '#F5C518' : '#888'};">${pendingProofs.length} pendiente(s)</span>
          </div>

          ${pendingProofs.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${pendingProofs.map(p => `
                <div style="background:rgba(245,197,24,0.08); border:1px solid rgba(245,197,24,0.25); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <span style="font-weight:900; color:white; font-size:0.9rem;">$${Number(p.amount || 0).toFixed(2)} USD</span>
                      <span style="color:#bbb; font-size:0.7rem; margin-left:6px;">Plan ${escapeHTML(p.plan_key || currentPlan)}</span>
                    </div>
                    <span style="font-size:0.65rem; color:#999;">${new Date(p.created_at || p.submitted_at).toLocaleDateString('es-VE')}</span>
                  </div>
                  <div style="font-size:0.75rem; color:rgba(255,255,255,0.8);">
                    🏦 <strong>${escapeHTML(p.bank || 'Banco')}</strong> &middot; Ref: <code>${escapeHTML(p.reference || 'S/R')}</code>
                  </div>
                  ${p.proof_image ? `
                    <div style="position:relative; margin-top:4px;">
                      <img src="${escapeHTML(p.proof_image)}" style="width:100%; max-height:120px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="window.open('${escapeHTML(p.proof_image)}','_blank')" />
                      <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.7); color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px;">Toca para ampliar</div>
                    </div>
                  ` : ''}
                  <button class="btn-validate-proof" data-proof-id="${p.id}" data-proof-plan="${p.plan_key || currentPlan}"
                    style="width:100%; padding:10px; background:#22c55e; color:white; border:none; border-radius:10px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">
                    ✓ VALIDAR Y APROBAR ESTE COMPROBANTE
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.5); text-align:center; padding:10px 0;">
              No hay comprobantes pendientes en el sistema para este edificio.<br>Puedes registrar el pago manual a continuación:
            </div>
          `}
        </div>

        <!-- SECCIÓN 2: REGISTRO MANUAL DE PAGO (MULTI-MÉTODO / MULTI-MONEDA) -->
        <div style="background:rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">
            💵 Registro Manual de Cobro (Multi-Método)
          </div>

          <!-- SELECTOR DE PLAN -->
          <label style="color:#999; font-size:0.6rem; font-weight:900; display:block; margin-bottom:6px;">PLAN A RENOVAR / ASIGNAR</label>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:14px;">
            ${['TRIAL', 'BRONCE', 'PLATA', 'ORO'].map(pk => `
              <button type="button" class="btn-plan-select" data-plan="${pk}"
                style="padding:10px 4px; border-radius:10px; border:2px solid ${pk === currentPlan ? '#F5C518' : 'rgba(255,255,255,0.1)'};
                       background:${pk === currentPlan ? '#F5C518' : 'rgba(255,255,255,0.05)'};
                       color:${pk === currentPlan ? '#1a1a2e' : 'white'}; font-weight:900; font-size:0.7rem; cursor:pointer;">
                ${pk}<br><span style="font-size:0.6rem; opacity:0.8;">$${PLAN_PRICES[pk]}</span>
              </button>
            `).join('')}
          </div>

          <!-- MONTO USD & BCV CALCULATOR -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
            <div>
              <label style="color:#999; font-size:0.6rem; font-weight:900; display:block; margin-bottom:6px;">MONTO EN USD ($)</label>
              <input id="master-pay-amount-usd" type="number" step="0.01" value="${currentAmount}"
                style="width:100%; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; font-weight:900; font-size:1rem; box-sizing:border-box;">
            </div>
            <div>
              <label style="color:#999; font-size:0.6rem; font-weight:900; display:block; margin-bottom:6px;">EQUIVALENTE EN BS (BCV)</label>
              <div id="master-pay-amount-bs" style="padding:12px; border-radius:10px; background:rgba(245,197,24,0.1); border:1px solid rgba(245,197,24,0.3); color:#F5C518; font-weight:900; font-size:0.95rem; text-align:center;">
                Bs. ${(currentAmount * bcvRate).toFixed(2)}
              </div>
            </div>
          </div>

          <!-- MÉTODOS DE PAGO DISPONIBLES -->
          <label style="color:#999; font-size:0.6rem; font-weight:900; display:block; margin-bottom:6px;">MÉTODO DE PAGO RECIBIDO</label>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:14px;">
            ${[
              { key: 'EFECTIVO_USD', label: '💵 Efectivo $' },
              { key: 'PAGO_MOVIL',   label: '📲 Pago Móvil' },
              { key: 'PUNTO_DEBITO', label: '💳 Punto Débito' },
              { key: 'TRANSFERENCIA',label: '🏦 Transf. Bs' },
              { key: 'ZELLE',        label: '⚡ Zelle USD' },
              { key: 'BINANCE_USDT', label: '🟡 Binance Pay' },
            ].map(m => `
              <button type="button" class="btn-method-select" data-method="${m.key}"
                style="padding:10px 4px; border-radius:10px; border:1.5px solid ${m.key === currentMethod ? '#F5C518' : 'rgba(255,255,255,0.1)'};
                       background:${m.key === currentMethod ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.04)'};
                       color:${m.key === currentMethod ? '#F5C518' : 'rgba(255,255,255,0.8)'}; font-weight:800; font-size:0.65rem; cursor:pointer;">
                ${m.label}
              </button>
            `).join('')}
          </div>

          <!-- REFERENCIA O BANCO -->
          <label style="color:#999; font-size:0.6rem; font-weight:900; display:block; margin-bottom:6px;">REFERENCIA BANCARIA / BANCO EMISOR</label>
          <input id="master-pay-reference" type="text" placeholder="Ej: Banesco 49201 ó Efectivo directo"
            style="width:100%; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; font-weight:700; font-size:0.8rem; margin-bottom:18px; box-sizing:border-box;">

          <!-- BOTONES DE ACCIÓN -->
          <div style="display:flex; gap:10px;">
            <button id="btn-cancel-pay-modal" style="flex:1; padding:14px; background:rgba(255,255,255,0.08); color:white; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">
              CANCELAR
            </button>
            <button id="btn-submit-manual-pay" style="flex:2; padding:14px; background:#F5C518; color:#1a1a2e; border:none; border-radius:12px; font-weight:900; font-size:0.75rem; cursor:pointer; text-transform:uppercase;">
              CONFIRMAR Y ACTIVAR
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos
    modal.querySelector('#btn-close-pay-modal').onclick = () => modal.remove();
    modal.querySelector('#btn-cancel-pay-modal').onclick = () => modal.remove();

    // Evento de validación de comprobante directo
    modal.querySelectorAll('.btn-validate-proof').forEach(btn => {
      btn.onclick = async () => {
        const proofId = btn.dataset.proofId;
        const proofPlan = btn.dataset.proofPlan;
        modal.remove();
        await actions.APPROVE_PROOF(`${proofId}|${building.id}|${proofPlan}`);
      };
    });

    // Actualización de plan
    const amountInput = modal.querySelector('#master-pay-amount-usd');
    const amountBsDisplay = modal.querySelector('#master-pay-amount-bs');

    modal.querySelectorAll('.btn-plan-select').forEach(b => {
      b.onclick = () => {
        currentPlan = b.dataset.plan;
        currentAmount = PLAN_PRICES[currentPlan] || 0;
        amountInput.value = currentAmount;
        amountBsDisplay.textContent = `Bs. ${(currentAmount * bcvRate).toFixed(2)}`;
        modal.querySelectorAll('.btn-plan-select').forEach(x => {
          const isThis = x.dataset.plan === currentPlan;
          x.style.background = isThis ? '#F5C518' : 'rgba(255,255,255,0.05)';
          x.style.color = isThis ? '#1a1a2e' : 'white';
          x.style.border = `2px solid ${isThis ? '#F5C518' : 'rgba(255,255,255,0.1)'}`;
        });
      };
    });

    // Cambio en input de monto
    amountInput.oninput = () => {
      const val = parseFloat(amountInput.value) || 0;
      currentAmount = val;
      amountBsDisplay.textContent = `Bs. ${(val * bcvRate).toFixed(2)}`;
    };

    // Selección de método
    modal.querySelectorAll('.btn-method-select').forEach(b => {
      b.onclick = () => {
        currentMethod = b.dataset.method;
        modal.querySelectorAll('.btn-method-select').forEach(x => {
          const isThis = x.dataset.method === currentMethod;
          x.style.background = isThis ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.04)';
          x.style.color = isThis ? '#F5C518' : 'rgba(255,255,255,0.8)';
          x.style.border = `1.5px solid ${isThis ? '#F5C518' : 'rgba(255,255,255,0.1)'}`;
        });
      };
    });

    // Confirmación manual
    modal.querySelector('#btn-submit-manual-pay').onclick = async () => {
      const ref = modal.querySelector('#master-pay-reference').value.trim();
      const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 };
      const days = durations[currentPlan] || 30;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      const PLAN_FEATURES = {
        TRIAL:  { finance_module: true, whatsapp_notifications: false, reports_module: false, debt_tracking: false, max_guards: 2 },
        BRONCE: { finance_module: true, whatsapp_notifications: false, reports_module: false, debt_tracking: true, max_guards: 4 },
        PLATA:  { finance_module: true, whatsapp_notifications: true, reports_module: true, debt_tracking: true, max_guards: 8 },
        ORO:    { finance_module: true, whatsapp_notifications: true, reports_module: true, debt_tracking: true, expenses_module: true, max_guards: 999 }
      };

      await Promise.all([
        supabase.from('buildings').update({
          plan: currentPlan,
          membership_status: 'ACTIVE',
          membership_expiry: expiry.toISOString(),
          features: PLAN_FEATURES[currentPlan] || PLAN_FEATURES.BRONCE
        }).eq('id', building.id),
        supabase.from('sloty_memberships').insert({
          building_id: building.id,
          plan_key: currentPlan,
          status: 'CONFIRMED',
          amount: currentAmount,
          payment_method: currentMethod,
          payment_reference: ref || 'Cobro directo Master',
          paid_at: new Date().toISOString(),
          expiry_date: expiry.toISOString()
        })
      ]);

      modal.remove();
      showMasterAlert('✓ Pago y Membresía Registrados', `El edificio ${building.name} ha sido actualizado a Plan ${currentPlan} exitosamente.`, '🎉');
      
      if (document.getElementById('dossier-overlay')) {
        document.getElementById('dossier-overlay').remove();
        actions.OPEN_DOSSIER(building.id);
      }
      render();
    };
  };

  const actions = {
    TAB: (btn) => { activeTab = btn.dataset.tab; selectedBuilding = null; render() },
    SET_NOTIFY_FILTER: (id) => { masterNotifyFilter = id; render() },
    BACK: () => { selectedBuilding = null; render() },
    APPROVE_BUILDING: async (id) => {
      if (!id) return;
      await supabase.from('buildings').update({ membership_status: 'ACTIVE' }).eq('id', id);
      showMasterAlert('✓ Condominio Aprobado', 'El edificio ha sido aprobado y activado con éxito.', '✅');
      if (document.getElementById('dossier-overlay')) {
        document.getElementById('dossier-overlay').remove();
        actions.OPEN_DOSSIER(id);
      }
      render();
    },
    REJECT_BUILDING: async (id) => {
      if (!id) return;
      showMasterConfirm({
        title: '¿Rechazar Registro?',
        message: 'Esta acción marcará la solicitud del condominio como RECHAZADA.',
        icon: '⚠️',
        confirmText: 'SÍ, RECHAZAR',
        isDestructive: true,
        onConfirm: async () => {
          await supabase.from('buildings').update({ membership_status: 'REJECTED' }).eq('id', id);
          showMasterAlert('Registro Rechazado', 'El edificio ha sido marcado como RECHAZADO.', 'ℹ️');
          if (document.getElementById('dossier-overlay')) {
            document.getElementById('dossier-overlay').remove();
            actions.OPEN_DOSSIER(id);
          }
          render();
        }
      });
    },
    TOGGLE_FEATURE: async (param) => {
      const [bId, featKey] = (param || '').split('|');
      if (!bId || !featKey) return;
      const { data: bld } = await supabase.from('buildings').select('features').eq('id', bId).single();
      const currentFeatures = bld?.features || {};
      const currentVal = (currentFeatures[featKey] !== undefined) ? currentFeatures[featKey] : true;
      const updated = { ...currentFeatures, [featKey]: !currentVal };
      await supabase.from('buildings').update({ features: updated }).eq('id', bId);
      if (document.getElementById('dossier-overlay')) {
        document.getElementById('dossier-overlay').remove();
        actions.OPEN_DOSSIER(bId);
      }
    },
    SELECT_BUILDING: async (btn) => { 
      const id = btn.dataset.id;
      actions.OPEN_DOSSIER(id);
    },
    SET_PLAN: async (btn) => {
      const plan = btn.dataset.plan;
      await supabase.from('buildings').update({ plan }).eq('id', selectedBuilding);
      selectedBuildingData.plan = plan;
      render();
    },
    TOGGLE_STATUS: async (btnOrId) => {
      const id = typeof btnOrId === 'string' ? btnOrId : selectedBuilding;
      if (!id) return;
      const { data: bld } = await supabase.from('buildings').select('membership_status').eq('id', id).single();
      if (!bld) return;
      
      const newStatus = bld.membership_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await supabase.from('buildings').update({ membership_status: newStatus }).eq('id', id);
      
      if (id === selectedBuilding && selectedBuildingData) {
        selectedBuildingData.membership_status = newStatus;
      }
      
      if (document.getElementById('dossier-overlay')) {
          document.getElementById('dossier-overlay').remove();
          actions.OPEN_DOSSIER(id);
      }
      render();
    },
    CHANGE_PLAN: async (id) => {
      if (!id) return;
      const { data: bld } = await supabase.from('buildings').select('*').eq('id', id).single();
      if (!bld) return;
      showMasterPaymentModal({ building: bld });
    },
    REGISTER_PAYMENT: async (btn) => {
      const bId = btn.dataset.id;
      if (!bId) return;
      const { data: bld } = await supabase.from('buildings').select('*').eq('id', bId).single();
      if (!bld) return;
      showMasterPaymentModal({ building: bld });
    },
    CONTACT_COLLECTION: async (id) => {
      const { data: bld } = await supabase.from('buildings').select('id, name, phone, plan').eq('id', id).single();
      if (!bld) return;
      if (!bld.phone) {
        showMasterPrompt({
          title: 'Sin Teléfono Registrado',
          message: `El edificio "${bld.name}" no tiene número de WhatsApp. Ingresa el teléfono del administrador para contactarlo:`,
          placeholder: 'Ej: +584121234567',
          icon: '📱',
          confirmText: 'GUARDAR Y COBRAR',
          onConfirm: async (newPhone) => {
            if (!newPhone) return;
            await supabase.from('buildings').update({ phone: newPhone }).eq('id', id);
            const cleanPhone = newPhone.replace(/\D/g, '');
            const msg = encodeURIComponent(`Hola admin de ${bld.name}, te contactamos de Sloty. Tienes una deuda pendiente por tu plan ${bld.plan}. Por favor, realiza el pago a la brevedad para reactivar tu servicio.`);
            window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
            if (document.getElementById('dossier-overlay')) {
              document.getElementById('dossier-overlay').remove();
              actions.OPEN_DOSSIER(id);
            }
          }
        });
        return;
      }
      const phone = bld.phone.replace(/\D/g, '');
      const msg = encodeURIComponent(`Hola admin de ${bld.name}, te contactamos de Sloty. Tienes una deuda pendiente por tu plan ${bld.plan}. Por favor, realiza el pago a la brevedad para reactivar tu servicio.`);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    },
    ACTIVATE_CASH: (btn) => {
      const bId = btn.dataset.id;
      actions.REGISTER_PAYMENT({ dataset: { id: bId } });
    },
    EDIT_PHONE: async (id) => {
      const { data: bld } = await supabase.from('buildings').select('name, phone').eq('id', id).single();
      showMasterPrompt({
        title: 'Editar Teléfono WhatsApp',
        message: `Ingresa el número de WhatsApp para "${bld?.name || 'el edificio'}":`,
        placeholder: 'Ej: +584121234567',
        defaultValue: bld?.phone || '',
        icon: '📱',
        confirmText: 'GUARDAR TELÉFONO',
        onConfirm: async (val) => {
          await supabase.from('buildings').update({ phone: val || null }).eq('id', id);
          showMasterAlert('Teléfono Actualizado', 'El número de teléfono ha sido guardado con éxito.', '✅');
          if (document.getElementById('dossier-overlay')) {
            document.getElementById('dossier-overlay').remove();
            actions.OPEN_DOSSIER(id);
          }
        }
      });
    },
    EDIT_CITY: async (id) => {
      const { data: bld } = await supabase.from('buildings').select('name, city').eq('id', id).single();
      showMasterPrompt({
        title: 'Editar Ubicación Geográfica',
        message: `Ciudad o zona del edificio "${bld?.name || ''}":`,
        placeholder: 'Ej: Caracas, Las Mercedes',
        defaultValue: bld?.city || '',
        icon: '📍',
        confirmText: 'GUARDAR CIUDAD',
        onConfirm: async (val) => {
          await supabase.from('buildings').update({ city: val || null }).eq('id', id);
          showMasterAlert('Ubicación Actualizada', 'La ciudad ha sido guardada con éxito.', '✅');
          if (document.getElementById('dossier-overlay')) {
            document.getElementById('dossier-overlay').remove();
            actions.OPEN_DOSSIER(id);
          }
        }
      });
    },
      

    APPROVE_SUBSCRIPTION_REQUEST: async (btn) => {
      const requestId = typeof btn === 'string' ? btn : (btn.dataset?.id || btn);
      if (!requestId) return;

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      if (btn.tagName) {
        btn.disabled = true;
        btn.textContent = '⏳ Aprobando...';
      }

      try {
        // 1. Intentar llamar a la RPC atómica de PostgreSQL (approve_subscription_request)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('approve_subscription_request', {
          p_request_id: requestId,
          p_reviewed_by: currentUserId
        });

        if (rpcErr || !rpcRes?.success) {
          console.warn('[Sloty Master] RPC falló o no está instalada, ejecutando fallback transaccional:', rpcErr || rpcRes?.error);
          
          // Fallback en cliente consistente
          const { data: req } = await supabase.from('subscription_requests').select('*').eq('id', requestId).single();
          if (!req) throw new Error('Solicitud no encontrada');

          const buildingCode = generateBuildingCode(req.building_name);
          const activationCode = generateActivationCode(6);
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + 30);

          const { data: bldCreated, error: bldErr } = await supabase.from('buildings').insert({
            name: req.building_name,
            code: buildingCode,
            admin_name: req.admin_name,
            phone: req.phone,
            admin_email: req.email,
            plan: req.plan_id || 'BRONCE',
            membership_status: 'ACTIVE',
            membership_expiry: expiry.toISOString(),
            lat: req.lat,
            lng: req.lng,
            city: req.city,
            address: req.address,
            is_first_login: false,
            monthly_rate: 20
          }).select().single();

          if (bldErr) throw bldErr;

          await supabase.from('sloty_memberships').insert({
            building_id: bldCreated.id,
            plan_key: req.plan_id || 'BRONCE',
            activation_code: activationCode,
            status: 'CONFIRMED',
            paid_at: new Date().toISOString(),
            expiry_date: expiry.toISOString()
          });

          await supabase.from('subscription_requests').update({
            status: 'APPROVED',
            building_id: bldCreated.id,
            reviewed_at: new Date().toISOString(),
            reviewed_by: currentUserId
          }).eq('id', requestId);

          logAudit(`Master aprobó solicitud de condominio: ${req.building_name} (Plan: ${req.plan_id}, Código: ${buildingCode})`);

          const waData = formatActivationWhatsAppMessage({
            buildingName: req.building_name,
            buildingCode,
            planLabel: req.plan_id,
            expiryDate: expiry.toISOString(),
            activationCode,
            adminPhone: req.phone
          });

          showActivationModal({
            buildingName: req.building_name,
            planLabel: req.plan_id,
            activationCode,
            expiryDate: expiry,
            whatsappUrl: waData.whatsappUrl,
            messageText: waData.messageText,
            phone: waData.cleanPhone
          });
        } else {
          // Éxito por RPC
          const res = rpcRes;
          logAudit(`Master aprobó solicitud por RPC: ${res.building_code} (Plan: ${res.plan_id})`);

          const waData = formatActivationWhatsAppMessage({
            buildingName: res.building_code,
            buildingCode: res.building_code,
            planLabel: res.plan_id,
            expiryDate: res.expiry_date,
            activationCode: res.activation_code,
            adminPhone: res.admin_phone
          });

          showActivationModal({
            buildingName: res.building_code,
            planLabel: res.plan_id,
            activationCode: res.activation_code,
            expiryDate: res.expiry_date,
            whatsappUrl: waData.whatsappUrl,
            messageText: waData.messageText,
            phone: waData.cleanPhone
          });
        }

        render();
      } catch (err) {
        console.error('[Sloty Master] Error en aprobación:', err);
        showMasterAlert('Error al Aprobar', 'No se pudo aprobar la solicitud: ' + err.message, '❌');
        if (btn.tagName) {
          btn.disabled = false;
          btn.textContent = '✓ APROBAR Y CREAR CONDOMINIO';
        }
      }
    },

    REJECT_SUBSCRIPTION_REQUEST: async (btn) => {
      const requestId = typeof btn === 'string' ? btn : (btn.dataset?.id || btn);
      if (!requestId) return;

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      showMasterPrompt({
        title: 'Rechazar Solicitud de Registro',
        message: 'Ingresa el motivo del rechazo para notificar al administrador:',
        placeholder: 'Ej: Comprobante no coincide con registros bancarios o datos incompletos',
        icon: '⚠️',
        confirmText: 'RECHAZAR SOLICITUD',
        onConfirm: async (reason) => {
          if (!reason || reason.trim().length < 4) {
            showMasterAlert('Motivo Requerido', 'Debes indicar un motivo de rechazo válido.', '⚠️');
            return;
          }

          try {
            const { data: req } = await supabase.from('subscription_requests').select('*').eq('id', requestId).single();

            // Llamar RPC de rechazo o fallback
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('reject_subscription_request', {
              p_request_id: requestId,
              p_reviewed_by: currentUserId,
              p_rejection_reason: reason.trim()
            });

            if (rpcErr || !rpcRes?.success) {
              await supabase.from('subscription_requests').update({
                status: 'REJECTED',
                reviewed_at: new Date().toISOString(),
                reviewed_by: currentUserId,
                rejection_reason: reason.trim()
              }).eq('id', requestId);
            }

            logAudit(`Master rechazó solicitud: ${req?.building_name || requestId} (${reason})`);

            const waData = formatRejectionWhatsAppMessage({
              buildingName: req?.building_name,
              adminName: req?.admin_name,
              adminPhone: req?.phone,
              planLabel: req?.plan_id,
              reason: reason.trim()
            });

            showRejectionModal({
              buildingName: req?.building_name || 'Edificio',
              planLabel: req?.plan_id || 'BRONCE',
              rejectionReason: reason.trim(),
              whatsappUrl: waData.whatsappUrl,
              messageText: waData.messageText,
              phone: waData.cleanPhone
            });

            render();
          } catch (err) {
            console.error('[Sloty Master] Error rechazando solicitud:', err);
            showMasterAlert('Error', 'No se pudo rechazar la solicitud: ' + err.message, '❌');
          }
        }
      });
    },

    APPROVE_PROOF: async (raw) => {
      // Support both old object call and new pipe-string call from dossier
      const isRaw = typeof raw === 'string'
      const proofId    = isRaw ? raw.split('|')[0] : raw?.id
      const buildingId = isRaw ? raw.split('|')[1] : raw?.building_id
      const planKey    = isRaw ? raw.split('|')[2] : raw?.plan_key
      if (!proofId || !buildingId) return

      const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30, ANUAL: 365 }
      const days = durations[planKey] || 30
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + days)

      const activationCode = generateActivationCode(6)

      const { data: bld } = await supabase.from('buildings').select('*').eq('id', buildingId).single()

      await Promise.all([
        supabase.from('building_payment_proofs').update({
          status: 'CONFIRMED',
          reviewed_at: new Date().toISOString(),
          activation_code: activationCode
        }).eq('id', proofId),
        supabase.from('buildings').update({
          membership_status: 'ACTIVE',
          plan: planKey || 'BRONCE',
          membership_expiry: expiry.toISOString()
        }).eq('id', buildingId),
        supabase.from('sloty_memberships').insert({
          building_id: buildingId, plan_key: planKey || 'BRONCE', status: 'CONFIRMED',
          paid_at: new Date().toISOString(), expiry_date: expiry.toISOString(),
          activation_code: activationCode
        })
      ])

      logAudit(`Master aprobó comprobante de pago para edificio: ${bld?.name || buildingId} (Plan: ${planKey || 'BRONCE'}, Código: ${activationCode})`)

      // Notificar al administrador del edificio sobre la activación (Push)
      supabase.functions.invoke('send-push', {
        body: {
          building_id: buildingId,
          role: 'ADMIN',
          title: '✅ ¡Plan Activado!',
          body: `El pago de tu edificio ha sido aprobado. El plan ${planKey || 'BRONCE'} ya se encuentra activo (Código: ${activationCode}).`
        }
      }).catch(e => console.warn('[Sloty] push notification error:', e));

      // Generar mensaje de WhatsApp para el cliente y mostrar modal interactivo de confirmación
      const waData = formatActivationWhatsAppMessage({
        buildingName: bld?.name,
        buildingCode: bld?.code,
        planLabel: planKey || 'BRONCE',
        expiryDate: expiry.toISOString(),
        activationCode: activationCode,
        adminPhone: bld?.phone
      })

      showActivationModal({
        buildingName: bld?.name || 'Edificio',
        planLabel: planKey || 'BRONCE',
        activationCode,
        expiryDate: expiry,
        whatsappUrl: waData.whatsappUrl,
        messageText: waData.messageText,
        phone: waData.cleanPhone
      })

      document.getElementById('dossier-overlay')?.remove()
      render()
    },
    REJECT_PROOF: async (raw) => {
      const isRaw = typeof raw === 'string'
      const proofId    = isRaw ? raw.split('|')[0] : raw?.id
      const buildingId = isRaw ? raw.split('|')[1] : raw?.building_id
      if (!proofId || !buildingId) return

      showMasterPrompt({
        title: 'Rechazar Comprobante',
        message: 'Ingresa el motivo del rechazo para informar al administrador del edificio:',
        placeholder: 'Ej: Referencia no encontrada en cuenta bancaria',
        icon: '⚠️',
        confirmText: 'RECHAZAR PAGO',
        onConfirm: async (reason) => {
          await Promise.all([
            supabase.from('building_payment_proofs').update({
              status: 'REJECTED',
              reviewed_at: new Date().toISOString(),
              rejection_reason: reason || null,
              reference: reason ? `RECHAZADO: ${reason}` : 'RECHAZADO'
            }).eq('id', proofId),
            supabase.from('buildings').update({
              membership_status: 'SUSPENDED'
            }).eq('id', buildingId)
          ]);

          logAudit(`Master rechazó comprobante de pago para edificio: ${buildingId} (${reason || 'Sin motivo'})`);

          // Notificar al administrador del edificio sobre el rechazo
          supabase.functions.invoke('send-push', {
            body: {
              building_id: buildingId,
              role: 'ADMIN',
              title: '❌ Pago de Membresía Rechazado',
              body: `El pago de membresía fue rechazado.${reason ? ` Motivo: ${reason}` : ' Por favor, revisa los datos suministrados o contacta con soporte.'}`
            }
          }).catch(e => console.warn('[Sloty] push notification error:', e));

          showMasterAlert('Comprobante Rechazado', 'El comprobante ha sido marcado como rechazado y el condominio suspendido.', 'ℹ️');
          document.getElementById('dossier-overlay')?.remove();
          render();
        }
      });
    },
    ACTIVATE_CASH: async (buildingId) => {
      if (!buildingId) return;

      const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 };
      const { data: bld } = await supabase.from('buildings')
        .select('plan').eq('id', buildingId).single();

      const days = durations[bld?.plan] || 30;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      await supabase.from('buildings').update({
        membership_status: 'ACTIVE',
        membership_expiry: expiry.toISOString()
      }).eq('id', buildingId);

      await supabase.from('sloty_memberships').insert({
        building_id:  buildingId,
        plan_key:     bld?.plan || 'TRIAL',
        amount:       0,
        payment_method: 'CASH',
        status:       'CONFIRMED',
        paid_at:      new Date().toISOString(),
        expiry_date:  expiry.toISOString()
      });

      render();
    },
    UPDATE_BCV_RATE: async () => {
      const input = document.getElementById('bcv-manual-input');
      const rate  = parseFloat(input?.value);

      if (!rate || rate < 10) {
        showMasterAlert('Tasa Inválida', 'Ingresa una tasa válida mayor a 10', '⚠️');
        return;
      }

      const { error } = await supabase.from('system_config').update({
        bcv_rate:           rate,
        bcv_fecha:          new Date().toISOString().slice(0, 10),
        bcv_source:         'manual',
        last_manual_update: new Date().toISOString()
      }).eq('id', 'global');

      if (error) {
        showMasterAlert('Error al actualizar', error.message, '❌');
        return;
      }

      const { invalidateBCVCache } = await import('../db.js');
      invalidateBCVCache();

      const display = document.getElementById('bcv-current-display');
      if (display) display.textContent =
        `Bs. ${rate.toLocaleString('es-VE', {minimumFractionDigits:2})} · Manual ⚠️`;
      if (input) input.value = '';
      showMasterAlert('✓ Tasa Actualizada', `La tasa oficial fue actualizada a Bs. ${rate.toLocaleString('es-VE')}`, '✅');
    },
    OPEN_DOSSIER: async (btn) => {
      const buildingId = typeof btn === 'string' ? btn : btn.dataset.id
      const today    = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      const [
        { data: bld },
        { data: subs },
        { data: pays },
        { data: personnel },
        { data: shifts },
        { data: proofs },
        { data: incidents },
        { count: slotsCount }
      ] = await Promise.all([
        supabase.from('buildings').select('*').eq('id', buildingId).single(),
        supabase.from('subscriptions').select('id,resident_name,plate,expiry_date,status').eq('building_id', buildingId),
        supabase.from('payments').select('amount,status,payment_date,method').eq('building_id', buildingId).gte('payment_date', firstDay),
        supabase.from('personnel').select('name,role,pin').eq('building_id', buildingId),
        supabase.from('guard_shifts').select('guard_name,ended_at,total_cash,total_mobile,total_bs,entries,exits,absences').eq('building_id', buildingId).order('ended_at', { ascending: false }).limit(5),
        supabase.from('building_payment_proofs').select('*, buildings(name, phone, admin_email, city, code)').eq('building_id', buildingId).order('created_at', { ascending: false }).limit(10),
        supabase.from('incidents').select('id,type,description,guard_name,created_at,resolved').eq('building_id', buildingId).eq('resolved', false).limit(10),
        supabase.from('parking_slots').select('*', { count: 'exact', head: true }).eq('building_id', buildingId)
      ])

      const confirmedPays   = (pays || []).filter(p => p.status === 'CONFIRMED')
      const pendingPays     = (pays || []).filter(p => p.status === 'PENDING')
      const totalIncome     = confirmedPays.reduce((a, p) => a + (Number(p.amount) || 0), 0)
      const activeResidents = (subs || []).filter(s => new Date(s.expiry_date) > today).length
      const expiredResidents = (subs || []).length - activeResidents
      const pendingProofs   = (proofs || []).filter(p => p.status === 'PENDING')

      const expiryDate  = bld?.membership_expiry ? new Date(bld.membership_expiry) : null
      const daysLeft    = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null
      const expiryColor = !daysLeft ? '#999' : daysLeft < 0 ? '#e63946' : daysLeft <= 7 ? '#F5C518' : '#22c55e'

      document.getElementById('dossier-overlay')?.remove()
      const overlay = document.createElement('div')
      overlay.id = 'dossier-overlay'
      overlay.style.cssText = `position:fixed;inset:0;background:#0f0f1a;z-index:9999;overflow-y:auto;font-family:'Montserrat',sans-serif;`
      overlay.innerHTML = `
        <div style="max-width:600px; margin:0 auto; padding:20px; padding-bottom:80px;">

          <!-- HEADER -->
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding-top:10px;">
            <button onclick="document.getElementById('dossier-overlay').remove()"
              style="background:rgba(255,255,255,0.08); color:white; border:none;
                     border-radius:50px; padding:8px 16px; font-size:0.7rem;
                     font-weight:900; cursor:pointer;">&#8592; VOLVER</button>
            <div>
              <div style="font-size:1.1rem; font-weight:900; color:white;">${escapeHTML(bld?.name || 'Edificio')}</div>
              <div style="font-size:0.65rem; color:#999; font-weight:700;">${escapeHTML(bld?.code || '')} &middot; ${escapeHTML(bld?.city || '')}</div>
            </div>
          </div>

          <!-- ALERTA COMPROBANTES PENDIENTES -->
          ${pendingProofs.length > 0 ? `
            <div style="background:rgba(245,197,24,0.12); border:1.5px solid #F5C518;
                        border-radius:16px; padding:14px 16px; margin-bottom:16px;
                        display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.4rem;">&#128206;</span>
              <div style="flex:1;">
                <div style="font-size:0.8rem; font-weight:900; color:#F5C518;">
                  ${pendingProofs.length} comprobante${pendingProofs.length > 1 ? 's' : ''} pendiente${pendingProofs.length > 1 ? 's' : ''} de revisi&oacute;n
                </div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-top:2px;">
                  Desliza abajo para revisar y aprobar
                </div>
              </div>
            </div>` : ''}

          <!-- M&Eacute;TRICAS PRINCIPALES -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#F5C518;">$${totalIncome.toFixed(2)}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS ESTE MES</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:white;">${slotsCount || 0}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">PUESTOS TOTALES</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#22c55e;">${activeResidents}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">RESIDENTES AL D&Iacute;A</div>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; text-align:center;">
              <div style="font-size:1.6rem; font-weight:900; color:#e63946;">${expiredResidents}</div>
              <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">VENCIDOS</div>
            </div>
          </div>

          <!-- MEMBRES&Iacute;A SLOTY -->
          <div style="background:rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:16px;">
            <div style="font-size:0.65rem; font-weight:900; color:#999;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Membres&iacute;a Sloty</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.9rem; font-weight:900; color:white;">Plan ${escapeHTML(bld?.plan || 'TRIAL')}</div>
                <div style="font-size:0.65rem; color:${expiryColor}; font-weight:700; margin-top:2px;">
                  ${daysLeft === null ? 'Sin fecha de vencimiento' :
                    daysLeft < 0 ? `Vencido hace ${Math.abs(daysLeft)} d&iacute;as` :
                    daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft} d&iacute;as`}
                </div>
              </div>
          <div style="display:flex; gap:8px;">
            ${(bld?.membership_status === 'SUSPENDED' || bld?.membership_status === 'PENDING_CASH') ? `
              <button onclick="window.handleMasterAction('CONTACT_COLLECTION','${buildingId}')"
                style="background:rgba(230,57,70,0.1); color:#e63946; border:1px solid #e63946;
                       border-radius:8px; padding:8px 12px; font-size:0.65rem;
                       font-weight:900; cursor:pointer; display:flex; align-items:center; gap:6px;">
                💬 COBRAR DEUDA
              </button>
            ` : ''}
            <button onclick="window.handleMasterAction('CHANGE_PLAN','${buildingId}')"
              style="background:rgba(245,197,24,0.1); color:#F5C518; border:1px solid #F5C518;
                     border-radius:8px; padding:8px 12px; font-size:0.65rem;
                     font-weight:900; cursor:pointer;">
              CAMBIAR PLAN
            </button>
            <button onclick="window.handleMasterAction('TOGGLE_STATUS','${buildingId}')"
              style="background:${bld?.membership_status === 'SUSPENDED' ? 'rgba(34,197,94,0.1)' : 'rgba(230,57,70,0.1)'};
                     color:${bld?.membership_status === 'SUSPENDED' ? '#22c55e' : '#e63946'};
                     border:1px solid ${bld?.membership_status === 'SUSPENDED' ? '#22c55e' : '#e63946'};
                     border-radius:8px; padding:8px 12px; font-size:0.65rem;
                     font-weight:900; cursor:pointer;">
              ${bld?.membership_status === 'SUSPENDED' ? 'ACTIVAR' : 'SUSPENDER'}
            </button>
          </div>
        </div>
      </div>

          <!-- SOLICITUD DE CUENTA / ESTADO DE APROBACIÓN -->
          ${bld?.membership_status === 'PENDING' || bld?.membership_status === 'PENDING_APPROVAL' ? `
            <div style="background:rgba(245,197,24,0.12); border:2px solid #F5C518; border-radius:18px; padding:18px; margin-bottom:16px; text-align:center;">
              <div style="font-size:2rem; margin-bottom:6px;">⏳</div>
              <div style="font-size:0.95rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                SOLICITUD DE REGISTRO PENDIENTE
              </div>
              <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); margin-bottom:14px;">
                Este condominio se ha registrado y está esperando aprobación del Master para comenzar a operar.
              </div>
              <div style="display:flex; gap:10px;">
                <button onclick="window.handleMasterAction('APPROVE_BUILDING','${buildingId}')"
                  style="flex:2; padding:14px; background:#22c55e; color:white; border:none; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; text-transform:uppercase;">
                  ✓ APROBAR CONDOMINIO
                </button>
                <button onclick="window.handleMasterAction('REJECT_BUILDING','${buildingId}')"
                  style="flex:1; padding:14px; background:rgba(230,57,70,0.2); color:#e63946; border:1px solid #e63946; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; text-transform:uppercase;">
                  RECHAZAR
                </button>
              </div>
            </div>
          ` : ''}

          <!-- FEATURE FLAGS / RESTRICCIÓN DE MÓDULOS -->
          <div style="background:rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:16px;">
            <div style="font-size:0.65rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">
              ⚡ Control de Módulos (Feature Flags)
            </div>
            <div style="display:grid; gap:8px;">
              ${FEATURES.map(f => {
                const isEnabled = bld?.features ? (bld.features[f.key] !== false) : true;
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:1.1rem;">${f.icon}</span>
                      <span style="font-size:0.8rem; font-weight:800; color:white;">${f.label}</span>
                    </div>
                    <button onclick="window.handleMasterAction('TOGGLE_FEATURE','${buildingId}|${f.key}')"
                      style="padding:6px 14px; border-radius:20px; font-size:0.65rem; font-weight:900; cursor:pointer; border:none; transition:all 0.2s;
                             background:${isEnabled ? '#22c55e' : 'rgba(255,255,255,0.1)'};
                             color:${isEnabled ? 'white' : 'rgba(255,255,255,0.4)'};">
                      ${isEnabled ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

      <!-- COMPROBANTES PENDIENTES -->
      ${pendingProofs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#F5C518;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
            Comprobantes Pendientes
          </div>
          ${pendingProofs.map(p => `
            <div style="background:rgba(245,197,24,0.06); border:1px solid rgba(245,197,24,0.2);
                        border-radius:14px; padding:14px; margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <div>
                  <div style="font-size:0.8rem; font-weight:900; color:white;">
                    Plan ${escapeHTML(p.plan_key || '—')} · $${Number(p.amount || 0).toFixed(2)}
                  </div>
                  <div style="font-size:0.65rem; color:#999; margin-top:2px;">
                    ${escapeHTML(p.reference || 'Sin referencia')} ·
                    ${new Date(p.created_at || p.submitted_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
                  </div>
                </div>
              </div>
              ${p.proof_image ? `
                <img src="${escapeHTML(p.proof_image)}" alt="Comprobante"
                     style="width:100%; border-radius:10px; margin-bottom:10px;
                            max-height:200px; object-fit:cover; cursor:pointer;"
                     onclick="window.open('${escapeHTML(p.proof_image)}','_blank')" />` : ''}
              <div style="display:flex; gap:8px;">
                <button onclick="window.handleMasterAction('APPROVE_PROOF','${p.id}|${buildingId}|${p.plan_key}')"
                  style="flex:1; background:#22c55e; color:white; border:none;
                         border-radius:10px; padding:10px; font-size:0.7rem;
                         font-weight:900; cursor:pointer;">
                  ✓ APROBAR
                </button>
                <button onclick="window.handleMasterAction('REJECT_PROOF','${p.id}|${buildingId}')"
                  style="flex:1; background:#e63946; color:white; border:none;
                         border-radius:10px; padding:10px; font-size:0.7rem;
                         font-weight:900; cursor:pointer;">
                  ✗ RECHAZAR
                </button>
                ${bld?.phone ? `
                  <a href="https://wa.me/${bld.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hola, revisamos tu comprobante de pago para el plan ' + (p.plan_key || '') + '.')}"
                     target="_blank"
                     style="background:rgba(255,255,255,0.08); color:white; border:none;
                            border-radius:10px; padding:10px 12px; font-size:0.75rem;
                            font-weight:900; cursor:pointer; text-decoration:none;
                            display:flex; align-items:center;">
                    💬
                  </a>` : ''}
              </div>
            </div>`).join('')}
        </div>` : ''}

      <!-- PAGOS PENDIENTES DEL MES -->
      ${pendingPays.length > 0 ? `
        <div style="background:rgba(230,57,70,0.06); border:1px solid rgba(230,57,70,0.2);
                    border-radius:14px; padding:14px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#e63946;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            ${pendingPays.length} Pago${pendingPays.length > 1 ? 's' : ''} de Residente Pendiente${pendingPays.length > 1 ? 's' : ''}
          </div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.5);">
            El admin del edificio tiene pagos de residentes sin aprobar este mes.
          </div>
        </div>` : ''}

      <!-- INCIDENTES SIN RESOLVER -->
      ${(incidents || []).length > 0 ? `
        <div style="background:rgba(230,57,70,0.06); border:1px solid rgba(230,57,70,0.2);
                    border-radius:14px; padding:14px; margin-bottom:16px;">
          <div style="font-size:0.65rem; font-weight:900; color:#e63946;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            ${incidents.length} Incidente${incidents.length > 1 ? 's' : ''} Sin Resolver
          </div>
          ${incidents.map(i => `
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.6); margin-bottom:4px;">
              ⚠️ ${escapeHTML(i.type || '')} — ${escapeHTML(i.description?.slice(0,60) || '')}${i.description?.length > 60 ? '...' : ''}
            </div>`).join('')}
        </div>` : ''}

      <!-- PERSONAL -->
      <div style="background:rgba(255,255,255,0.06); border-radius:14px;
                  padding:14px; margin-bottom:16px;">
        <div style="font-size:0.65rem; font-weight:900; color:#999;
                    text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
          Personal (${(personnel || []).length})
        </div>
        ${(personnel || []).length === 0 ?
          `<div style="color:rgba(255,255,255,0.3); font-size:0.75rem;">Sin personal registrado</div>` :
          (personnel || []).map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="color:white; font-size:0.8rem; font-weight:700;">${escapeHTML(p.name || '')}</div>
              <span style="background:rgba(245,197,24,0.1); color:#F5C518; font-size:0.6rem;
                           font-weight:900; padding:2px 8px; border-radius:6px;">
                ${escapeHTML(p.role || 'GUARDIA')}
              </span>
            </div>`).join('')}
      </div>

      <!-- ÚLTIMOS TURNOS -->
      <div style="background:rgba(255,255,255,0.06); border-radius:14px;
                  padding:14px; margin-bottom:16px;">
        <div style="font-size:0.65rem; font-weight:900; color:#999;
                    text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
          Últimos Turnos de Guardia
        </div>
        ${(shifts || []).length === 0 ?
          `<div style="color:rgba(255,255,255,0.3); font-size:0.75rem;">Sin turnos registrados</div>` :
          (shifts || []).map(s => {
            const earned = (s.total_cash||0) + (s.total_mobile||0) + (s.total_bs||0);
            const absMin = (s.absences||[]).reduce((a, ab) => a + (ab.duration_min||0), 0);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center;
                          padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div>
                  <div style="color:white; font-size:0.8rem; font-weight:700;">${escapeHTML(s.guard_name || '')}</div>
                  <div style="color:#999; font-size:0.6rem; font-weight:700; margin-top:2px;">
                    ${new Date(s.ended_at).toLocaleString('es-VE',{dateStyle:'short',timeStyle:'short'})}
                    · ${s.entries||0} entradas
                    ${absMin > 0 ? `· <span style="color:#e63946;">⏸${absMin}min</span>` : ''}
                  </div>
                </div>
                <div style="color:#F5C518; font-size:0.85rem; font-weight:900;">
                  $${earned.toFixed(2)}
                </div>
              </div>`;
          }).join('')}
      </div>

      <!-- CONTACTO & DETALLES DE CONEXIÓN -->
      <div style="background:rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:16px;">
        <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">
          Contacto & Datos de Conexión
        </div>
        
        <div style="display:flex; flex-direction:column; gap:10px;">
          <!-- TELÉFONO WHATSAPP -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">📱</span>
              <div>
                <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">Teléfono WhatsApp</div>
                <div style="font-size:0.85rem; font-weight:900; color:white;">${bld?.phone ? escapeHTML(bld.phone) : '<span style="color:#e63946;">Sin registrar</span>'}</div>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              ${bld?.phone ? `
                <a href="https://wa.me/${bld.phone.replace(/\D/g,'')}" target="_blank" style="background:#22c55e; color:white; padding:6px 12px; border-radius:10px; font-size:0.7rem; font-weight:900; text-decoration:none; display:flex; align-items:center; gap:4px;">
                  💬 Chat
                </a>` : ''}
              <button onclick="window.handleMasterAction('EDIT_PHONE','${buildingId}')" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:6px 12px; border-radius:10px; font-size:0.7rem; font-weight:800; cursor:pointer;">
                ${bld?.phone ? '✏️ Editar' : '+ Agregar Teléfono'}
              </button>
            </div>
          </div>

          <!-- EMAIL ADMINISTRADOR -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">✉️</span>
              <div>
                <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">Email Administrador</div>
                <div style="font-size:0.85rem; font-weight:900; color:white;">${escapeHTML(bld?.admin_email || 'Sin email registrado')}</div>
              </div>
            </div>
            ${bld?.admin_email ? `
              <a href="mailto:${bld.admin_email}" style="background:rgba(255,255,255,0.1); color:white; padding:6px 12px; border-radius:10px; font-size:0.7rem; font-weight:800; text-decoration:none;">
                ✉️ Enviar Correo
              </a>` : ''}
          </div>

          <!-- UBICACIÓN GEOGRÁFICA -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">📍</span>
              <div>
                <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">Ubicación Geográfica / Ciudad</div>
                <div style="font-size:0.85rem; font-weight:900; color:white;">${escapeHTML(bld?.city || 'Venezuela (Sin especificar)')}</div>
              </div>
            </div>
            <button onclick="window.handleMasterAction('EDIT_CITY','${buildingId}')" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:6px 12px; border-radius:10px; font-size:0.7rem; font-weight:800; cursor:pointer;">
              ✏️ Editar
            </button>
          </div>

          <!-- DISPOSITIVO / PLATAFORMA -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">💻</span>
              <div>
                <div style="font-size:0.55rem; color:#999; font-weight:800; text-transform:uppercase;">Dispositivo / Plataforma</div>
                <div style="font-size:0.85rem; font-weight:900; color:#F5C518;">Web App PWA · Conexión En Línea</div>
              </div>
            </div>
            <span style="background:rgba(34,197,94,0.15); color:#22c55e; font-size:0.65rem; font-weight:900; padding:4px 10px; border-radius:8px;">
              ACTIVO
            </span>
          </div>
        </div>
      </div>

    </div>`;

  document.body.appendChild(overlay);
},


    EXPORT_PDF: async () => {
      const { data: blds } = await supabase.from('buildings').select('*')
      const { data: mems } = await supabase.from('sloty_memberships').select('amount')
      const pendingCash = (blds||[]).filter(b => b.membership_status === 'PENDING_CASH').length
      const activeBld = (blds||[]).filter(b => b.membership_status === 'ACTIVE').length
      const totalIncome = (mems||[]).reduce((a,b)=>a+(Number(b.amount)||0), 0)
      
      const expiredList = (blds||[]).filter(b => b.membership_status === 'ACTIVE' && b.plan !== 'TRIAL')
        .map(b => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${escapeHTML(b.name || '')}</td><td style="padding:8px; border-bottom:1px solid #eee;">${escapeHTML(b.phone||'N/A')}</td><td style="padding:8px; border-bottom:1px solid #eee; color:red;">Sujeto a Cobro</td></tr>`).join('')
      
      const toExport = `
      <html><head><title>Reporte de Recaudación - Sloty</title>
      <style>body{ font-family:sans-serif; padding:40px; color:#333; } table{ width:100%; border-collapse:collapse; margin-top:10px; } th,td{ text-align:left; }</style>
      </head><body>
      <h1>Reporte Mensual Sloty Master</h1>
      <p>Fecha de emisión: ${new Date().toLocaleString()}</p>
      <hr>
      <h3>Métricas Generales</h3>
      <ul>
        <li><b>Ingresos Totales (Histórico):</b> $${totalIncome.toFixed(2)}</li>
        <li><b>Edificios Activos:</b> ${activeBld}</li>
        <li><b>Total Edificios Registrados:</b> ${(blds||[]).length}</li>
      </ul>
      <h3>Pendientes por Aprobación</h3>
      <ul>
        <li>Pagos en Efectivo Pendientes: ${pendingCash}</li>
      </ul>
      <h3>Edificios Sujetos a Revisión (Morosos)</h3>
      ${expiredList ? `<table><tr><th>Edificio</th><th>Teléfono</th><th>Estado</th></tr>${expiredList}</table>` : '<p>Ninguno actualmente.</p>'}
      <br><br>
      <p style="text-align:center; font-size:0.8rem; color:#666;">Generado automáticamente por Sloty Premium</p>
      </body></html>
      `
      const w = window.open('', '_blank')
      w.document.write(toExport)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 500)
    },
    EDIT_BUILDING_MASTER: (bld) => {
      const overlay = document.createElement('div')
      overlay.id = 'master-modal'
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);
        z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`
      overlay.innerHTML = `
        <div style="background:#1a1a2e; border-radius:32px; width:100%; max-width:440px; border:1px solid rgba(255,255,255,0.1); padding:28px;">
          <div style="font-size:1.1rem; font-weight:900; color:white; margin-bottom:20px;">Editar Datos: ${escapeHTML(bld.name)}</div>
          
          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">NOMBRE EDIFICIO</label>
          <input id="edit-b-name" value="${escapeHTML(bld.name)}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">EMAIL ADMINISTRADOR</label>
          <input id="edit-b-email" value="${escapeHTML(bld.admin_email || '')}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">TELÉFONO CONTACTO</label>
          <input id="edit-b-phone" value="${escapeHTML(bld.phone || '')}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:16px; box-sizing:border-box;" />

          <label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:8px;">CIUDAD</label>
          <input id="edit-b-city" value="${escapeHTML(bld.city || '')}" style="width:100%; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; margin-bottom:24px; box-sizing:border-box;" />

          <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px;">
             <button id="edit-b-cancel" style="padding:16px; background:rgba(255,255,255,0.05); color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer;">CANCELAR</button>
             <button id="edit-b-save" style="padding:16px; background:#F5C518; color:#1a1a2e; border:none; border-radius:14px; font-weight:900; cursor:pointer;">GUARDAR CAMBIOS</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      document.getElementById('edit-b-cancel').onclick = () => overlay.remove()
      document.getElementById('edit-b-save').onclick = async () => {
         const updates = {
            name: document.getElementById('edit-b-name').value,
            admin_email: document.getElementById('edit-b-email').value,
            phone: document.getElementById('edit-b-phone').value,
            city: document.getElementById('edit-b-city').value
         }
         await supabase.from('buildings').update(updates).eq('id', bld.id)
         overlay.remove(); render()
      }
    },
    ADD_AD: async (file) => {
      if (!file) return
      try {
        const ext      = file.name.split('.').pop()
        const filePath = `ads/${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('ads')
          .upload(filePath, file, { upsert: true })

        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('ads')
          .getPublicUrl(filePath)

        const target = document.getElementById('ad-target-bld')?.value
        const bId = target === 'GLOBAL' ? null : target

        await supabase.from('ads').insert({
          image_url: urlData.publicUrl,
          active: true,
          building_id: bId,
          timestamp: new Date().toISOString()
        })
        render()
      } catch(e) {
        console.error('Error subiendo anuncio:', e)
        showMasterAlert('Error', 'Error al subir el anuncio. Intenta de nuevo.', '❌');
      }
    },
    TOGGLE_AD: async (btn) => {
      const id = btn.dataset.id;
      const isActive = btn.dataset.active === 'true';
      await supabase.from('ads').update({ active: !isActive }).eq('id', id)
      render()
    },
    REPOST_AD: async (btn) => {
      const id = btn.dataset.id;
      await supabase.from('ads').update({ timestamp: new Date().toISOString() }).eq('id', id)
      render()
    },
    DELETE_AD: async (btn) => {
      const id = btn.dataset.id;
      showMasterConfirm({
        title: '¿Borrar Anuncio?',
        message: '¿Estás seguro de eliminar este anuncio definitivamente?',
        icon: '🗑️',
        confirmText: 'SÍ, BORRAR',
        isDestructive: true,
        onConfirm: async () => {
          await supabase.from('ads').delete().eq('id', id);
          render();
        }
      });
    },
    ADD_BUILDING: () => {
      const overlay = document.createElement('div');
      overlay.id = 'master-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999;display:flex;align-items:flex-end;justify-content:center;overflow-y:auto;';
      overlay.innerHTML =
        '<div id="nb-sheet" style="background:#1a1a2e; border-radius:24px 24px 0 0; padding:28px;'
        + ' width:100%; max-width:500px; border:1px solid rgba(255,255,255,0.1); padding-bottom:40px;">'
        + '<div style="font-size:1rem; font-weight:900; color:white; margin-bottom:4px;">Nuevo Edificio</div>'
        + '<div style="font-size:0.7rem; color:#999; margin-bottom:20px;">Registro manual desde Master Panel</div>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">NOMBRE *</label>'
        + '<input id="nb-name" placeholder="Ej. Residencial El Prado" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">CÓDIGO ÚNICO *</label>'
        + '<input id="nb-code" placeholder="Ej: SLO-0042" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">EMAIL ADMINISTRADOR</label>'
        + '<input id="nb-email" type="email" placeholder="admin@edificio.com" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">TELÉFONO CONTACTO</label>'
        + '<input id="nb-phone" placeholder="+584129135799" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">CIUDAD</label>'
        + '<input id="nb-city" placeholder="Caracas" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">PLAN</label>'
        + '<select id="nb-plan" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;appearance:none;">'
        + '<option value="TRIAL">Trial (Gratis · 15 días)</option>'
        + '<option value="BRONCE">Bronce ($29/mes)</option>'
        + '<option value="PLATA">Plata ($59/mes)</option>'
        + '<option value="ORO">Oro ($99/mes)</option>'
        + '</select>'
        + '<div id="nb-payment-section" style="display:none;">'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">MONTO PAGADO ($)</label>'
        + '<input id="nb-amount" type="number" placeholder="0.00" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:12px;box-sizing:border-box;"/>'
        + '<label style="color:#999;font-size:0.6rem;font-weight:900;display:block;margin-bottom:6px;">MÉTODO DE PAGO</label>'
        + '<select id="nb-method" style="width:100%;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:0.85rem;font-weight:700;margin-bottom:20px;box-sizing:border-box;appearance:none;">'
        + '<option value="EFECTIVO">Efectivo</option>'
        + '<option value="PAGO_MOVIL">Pago Móvil</option>'
        + '<option value="TRANSFERENCIA">Transferencia</option>'
        + '<option value="ZELLE">Zelle</option>'
        + '</select>'
        + '</div>'
        + '<div style="display:flex; gap:10px;">'
        + '<button id="nb-cancel" style="flex:1;padding:14px;background:rgba(255,255,255,0.08);color:white;border:none;border-radius:12px;font-weight:900;cursor:pointer;">CANCELAR</button>'
        + '<button id="nb-confirm" style="flex:2;padding:14px;background:#F5C518;color:#1a1a2e;border:none;border-radius:12px;font-weight:900;cursor:pointer;">CREAR EDIFICIO</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(overlay);

      const planSel = document.getElementById('nb-plan');
      const paySection = document.getElementById('nb-payment-section');
      planSel.onchange = () => {
        paySection.style.display = planSel.value === 'TRIAL' ? 'none' : 'block';
      };

      document.getElementById('nb-cancel').onclick = () => overlay.remove();
      document.getElementById('nb-confirm').onclick = async () => {
        const name   = document.getElementById('nb-name').value.trim();
        const code   = document.getElementById('nb-code').value.trim();
        const city   = document.getElementById('nb-city').value.trim();
        const phone  = document.getElementById('nb-phone').value.trim();
        const email  = document.getElementById('nb-email').value.trim();
        const plan   = document.getElementById('nb-plan').value;
        const amount = parseFloat(document.getElementById('nb-amount')?.value) || 0;
        const method = document.getElementById('nb-method')?.value || 'EFECTIVO';
        if (!name || !code) {
          document.getElementById('nb-name').style.border = '1px solid #e63946';
          document.getElementById('nb-code').style.border = '1px solid #e63946';
          return;
        }
        const durations = { TRIAL: 15, BRONCE: 30, PLATA: 30, ORO: 30 };
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (durations[plan] || 30));
        const { data: newBld, error } = await supabase.from('buildings').insert({
          name, code, city, phone: phone || null,
          admin_email: email || null,
          plan, membership_status: 'ACTIVE',
          membership_expiry: expiry.toISOString(),
          created_at: new Date().toISOString()
        }).select().single();
        if (error) { showMasterAlert('Error', 'Error al crear el edificio: ' + error.message, '❌'); return; }
        if (plan !== 'TRIAL' && amount > 0 && newBld) {
          await supabase.from('sloty_memberships').insert({
            building_id: newBld.id, plan_key: plan, status: 'CONFIRMED',
            amount, payment_method: method,
            paid_at: new Date().toISOString(), expiry_date: expiry.toISOString()
          });
        }
        overlay.remove();
        render();
        // Ofrecer envío de enlace si hay teléfono
        if (phone && newBld) {
          showMasterConfirm({
            title: '¿Enviar Acceso por WhatsApp?',
            message: `¿Deseas abrir WhatsApp para enviar las credenciales y el enlace al administrador de "${name}"?`,
            icon: '💬',
            confirmText: 'SÍ, ENVIAR',
            cancelText: 'DESPUÉS',
            onConfirm: () => {
              const loginUrl = window.location.origin + window.location.pathname;
              const msg = encodeURIComponent(
                'Hola! Bienvenido a Sloty \u{1F680}\n\nTu edificio *' + name + '* ya est\u00e1 activo.\n\n'
                + '\u{1F449} Accede aqu\u00ed: ' + loginUrl + '\n'
                + '\u{1F511} C\u00f3digo de edificio: *' + code + '*\n'
                + (email ? '\u{1F4E7} Email admin: *' + email + '*\n' : '')
                + '\n\u00a1\u00c9xito con tu gesti\u00f3n! \u{1F680}'
              );
              window.open('https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + msg, '_blank');
            }
          });
        }
      };
    },
    DELETE_BUILDING: async (btn) => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name || 'este edificio';
      showMasterConfirm({
        title: `¿Eliminar ${name}?`,
        message: 'Esta acción es IRREVERSIBLE y borrará en cascada todos los datos asociados (residentes, abonos, pagos, comprobantes y garitas) de este condominio.',
        icon: '🗑️',
        confirmText: 'SÍ, ELIMINAR',
        isDestructive: true,
        onConfirm: async () => {
          try {
            // 1. Desvincular perfiles asociados a este edificio
            await supabase.from('profiles').update({ building_id: null }).eq('building_id', id);

            // 2. Eliminar en cascada todas las tablas hijas vinculadas por Foreign Key
            await Promise.allSettled([
              supabase.from('subscriptions').delete().eq('building_id', id),
              supabase.from('payments').delete().eq('building_id', id),
              supabase.from('movements').delete().eq('building_id', id),
              supabase.from('guard_shifts').delete().eq('building_id', id),
              supabase.from('personnel').delete().eq('building_id', id),
              supabase.from('building_payment_proofs').delete().eq('building_id', id),
              supabase.from('sloty_memberships').delete().eq('building_id', id),
              supabase.from('ads').delete().eq('building_id', id),
              supabase.from('daily_closures').delete().eq('building_id', id),
              supabase.from('audit_logs').delete().eq('building_id', id)
            ]);

            // 3. Eliminar el registro principal en buildings
            const { error } = await supabase.from('buildings').delete().eq('id', id);
            if (error) {
              showMasterAlert('Error al eliminar', error.message, '❌');
              return;
            }

            showMasterAlert('Edificio Eliminado', `El edificio ${name} y todos sus datos fueron eliminados correctamente.`, '✅');
            render();
          } catch (err) {
            console.error('[Sloty Master] Error en eliminación en cascada:', err);
            showMasterAlert('Error', 'Ocurrió un error inesperado al eliminar: ' + err.message, '❌');
          }
        }
      });
    },
    SEND_ACCESS_LINK: async (id) => {
      if (!id) return
      const { data: bld } = await supabase.from('buildings').select('name, phone, code, admin_email').eq('id', id).single()
      if (!bld) return showMasterAlert('Error', 'No se encontró el edificio.', '❌')
      if (!bld.phone) return showMasterAlert('Sin Teléfono', 'El edificio no tiene teléfono registrado.', '⚠️')
      const phone = bld.phone.replace(/\D/g, '')
      const loginUrl = `${window.location.origin}${window.location.pathname}`
      const msg = encodeURIComponent(
        `Hola! Bienvenido a Sloty 🚀\n\nTu edificio *${bld.name}* ya está activo.\n\n` +
        `👉 Accede aquí: ${loginUrl}\n` +
        `🔑 Código de edificio: *${bld.code}*\n\n` +
        `Inicia sesión con tu email *${bld.admin_email || '(el que registraste)'}* y configura tu panel.`
      )
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    },
    RESET_FULL: () => {
      showMasterConfirm({
        title: '⚠ RESET FULL SYSTEM',
        message: 'Esto borrará el caché local por completo y reiniciará la aplicación. ¿Deseas continuar?',
        icon: '⚠️',
        confirmText: 'SÍ, RESETEAR',
        isDestructive: true,
        onConfirm: () => {
          localStorage.clear();
          location.reload();
        }
      });
    },
    LOGOUT: () => {
      if (window.slotyLogout) window.slotyLogout()
      else {
        localStorage.clear()
        location.reload()
      }
    }
  }

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]')
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn)
  })

  // --- RENDERING ---
  const getBadge = (plan, status) => {
      if (status === 'SUSPENDED') return `<span style="background:#e63946; color:white; padding:2px 6px; border-radius:6px; font-size:0.6rem; font-weight:900;">SUSPENDIDO</span>`;
      const colors = { 'TRIAL': '#888', 'BRONCE': '#cd7f32', 'PLATA': '#aaa', 'ORO': '#F5C518' };
      const bg = colors[plan] || '#888';
      const c = plan === 'ORO' ? '#1a1a2e' : 'white';
      return `<span style="background:${bg}; color:${c}; padding:2px 6px; border-radius:6px; font-size:0.6rem; font-weight:900;">${plan}</span>`;
  }

  const tabBar = () => `
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.1);overflow-x:auto;background:#1a1a2e;position:sticky;top:0;z-index:90;">
      ${[
        { k:'NOTIFICATIONS', l:'🔔 Actividad' },
        { k:'BUILDINGS',     l:'Edificios'    },
        { k:'MEMBERSHIPS',   l:'Membresías'   },
        { k:'ADS',           l:'Anuncios'     },
        { k:'SYSTEM',        l:'Sistema'      }
      ].map(t => `
        <div data-action="TAB" data-tab="${t.k}"
             style="padding:14px 16px; font-size:0.72rem; font-weight:900;
                    cursor:pointer; white-space:nowrap; letter-spacing:0.5px;
                    border-bottom:3px solid ${activeTab === t.k ? '#F5C518' : 'transparent'};
                    color:${activeTab === t.k ? '#F5C518' : 'rgba(255,255,255,0.4)'};
                    position:relative;">
          ${t.l}
          ${t.k === 'NOTIFICATIONS' && notifCount > 0 ? `
            <span id="master-notif-badge"
                  style="position:absolute; top:8px; right:2px;
                         background:#e63946; color:white; font-size:9px;
                         font-weight:900; width:16px; height:16px;
                         border-radius:50%; display:inline-flex;
                         align-items:center; justify-content:center;">
              ${notifCount}
            </span>` : ''}
          ${t.k === 'MEMBERSHIPS' && pendingProofsCount > 0 ? `
            <span id="master-pending-badge"
                  style="position:absolute; top:8px; right:4px;
                         background:#e63946; color:white; font-size:9px;
                         font-weight:900; width:16px; height:16px;
                         border-radius:50%; display:inline-flex;
                         align-items:center; justify-content:center;">
              ${pendingProofsCount}
            </span>` : ''}
        </div>`).join('')}
    </div>`

  const renderNotifications = (subscriptionRequests = [], proofs = [], newBuildings = []) => {
    const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#F5C518', ORO:'#ffd700' };
    const planPrices = { TRIAL:'Gratis', BRONCE:'$180/mes', PLATA:'$250/mes', ORO:'$380/mes' };

    // Filtrar solicitudes de suscripción
    const filteredRequests = subscriptionRequests.filter(r => {
      if (masterNotifyFilter === 'ALL') return true;
      if (masterNotifyFilter === 'PENDING') return !r.status || r.status === 'PENDING_APPROVAL';
      if (masterNotifyFilter === 'CONFIRMED') return r.status === 'APPROVED';
      return r.status === masterNotifyFilter;
    });

    // Filtrar comprobantes de edificios existentes
    const filteredProofs = proofs.filter(p => {
      if (masterNotifyFilter === 'ALL') return true;
      if (masterNotifyFilter === 'PENDING') return !p.status || p.status === 'PENDING';
      return p.status === masterNotifyFilter;
    });

    const pendingCount = subscriptionRequests.filter(r => !r.status || r.status === 'PENDING_APPROVAL').length
                       + proofs.filter(p => !p.status || p.status === 'PENDING').length;
    const approvedCount = subscriptionRequests.filter(r => r.status === 'APPROVED').length
                        + proofs.filter(p => p.status === 'CONFIRMED').length;
    const rejectedCount = subscriptionRequests.filter(r => r.status === 'REJECTED').length
                        + proofs.filter(p => p.status === 'REJECTED').length;
    const totalCount = subscriptionRequests.length + proofs.length;

    // Filters UI
    const filterHtml = `
      <div style="display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; padding-bottom:4px;">
        ${[
          {id:'PENDING', label:'Pendientes', count:pendingCount},
          {id:'CONFIRMED', label:'Aprobados', count:approvedCount},
          {id:'REJECTED', label:'Rechazados', count:rejectedCount},
          {id:'ALL', label:'Todos', count:totalCount}
        ].map(f => `
          <button onclick="window.handleMasterAction('SET_NOTIFY_FILTER','${f.id}')"
            style="padding:10px 16px; border-radius:12px; border:none; font-weight:900; font-size:0.7rem; white-space:nowrap; cursor:pointer;
            transition:all 0.2s;
            background:${masterNotifyFilter === f.id ? '#F5C518' : 'rgba(255,255,255,0.05)'};
            color:${masterNotifyFilter === f.id ? '#1a1a2e' : 'rgba(255,255,255,0.4)'};">
            ${f.label} (${f.count})
          </button>
        `).join('')}
      </div>
    `;

    if (filteredRequests.length === 0 && filteredProofs.length === 0) return `
      <div style="padding:40px 20px; text-align:center;">
        ${filterHtml}
        <div style="font-size:3rem; margin-bottom:12px; margin-top:20px;">📭</div>
        <div style="font-size:0.8rem; font-weight:900; color:rgba(255,255,255,0.4);
                    text-transform:uppercase; letter-spacing:2px;">
          Sin solicitudes recientes para este filtro
        </div>
      </div>`;

    let html = `<div style="padding:16px; padding-bottom:100px;">
      ${filterHtml}

      <!-- SECCIÓN 1: BÓVEDA DE SOLICITUDES DE REGISTRO (NUEVOS CONDOMINIOS) -->
      ${filteredRequests.length > 0 ? `
        <div style="margin-bottom:24px;">
          <div style="font-size:0.75rem; font-weight:900; color:#F5C518; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span>📥 Solicitudes de Registro (Nuevos Condominios)</span>
            <span style="background:#F5C518; color:#1a1a2e; font-size:0.65rem; padding:2px 8px; border-radius:10px;">${filteredRequests.length}</span>
          </div>
          ${filteredRequests.map(req => renderSubscriptionRequestCard(req)).join('')}
        </div>
      ` : ''}

      <!-- SECCIÓN 2: COMPROBANTES DE PAGOS (CONDOMINIOS EXISTENTES) -->
      ${filteredProofs.length > 0 ? `
        <div>
          <div style="font-size:0.75rem; font-weight:900; color:#aaa; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span>💳 Comprobantes de Membresía</span>
            <span style="background:rgba(255,255,255,0.1); color:white; font-size:0.65rem; padding:2px 8px; border-radius:10px;">${filteredProofs.length}</span>
          </div>
          ${filteredProofs.map(p => {
            const isPending = !p.status || p.status === 'PENDING';
            return renderProofCard(p, isPending);
          }).join('')}
        </div>
      ` : ''}
    </div>`;

    return html;
  };

  // Render Card para Solicitud de Suscripción (Bóveda Master)
  const renderSubscriptionRequestCard = (req) => {
    const isPending = !req.status || req.status === 'PENDING_APPROVAL';
    const isApproved = req.status === 'APPROVED';
    const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#F5C518', ORO:'#ffd700' };
    const planColor = planColors[req.plan_id] || '#888';

    const submitted = req.created_at
      ? new Date(req.created_at).toLocaleString('es-VE', { dateStyle:'medium', timeStyle:'short' })
      : 'Fecha desconocida';

    const phoneClean = (req.phone || '').replace(/\D/g, '');
    const mapsUrl = (req.lat && req.lng) ? `https://maps.google.com/?q=${req.lat},${req.lng}` : null;
    const locationStr = [req.city, req.address].filter(Boolean).join(' - ');

    return `
      <div style="background:#0f1127; border:1.5px solid ${isPending ? 'rgba(245,197,24,0.3)' : (isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(230,57,70,0.3)')};
                  border-radius:20px; overflow:hidden; margin-bottom:18px; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
        
        <!-- HEADER SOLICITUD -->
        <div style="padding:16px 18px 12px; background:${isPending ? 'rgba(245,197,24,0.06)' : 'rgba(255,255,255,0.02)'}; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-size:1.05rem; font-weight:900; color:white; margin-bottom:2px;">
              ${escapeHTML(req.building_name)}
            </div>
            <div style="font-size:0.65rem; color:#aaa; font-weight:700;">
              Solicitado por: <b style="color:white;">${escapeHTML(req.admin_name)}</b> &middot; ${submitted}
            </div>
          </div>
          <span style="background:${planColor}; color:${req.plan_id === 'ORO' ? '#1a1a2e' : 'white'}; padding:4px 10px; border-radius:8px; font-size:0.65rem; font-weight:900;">
            Plan ${escapeHTML(req.plan_id)}
          </span>
        </div>

        <!-- CONTACTO Y UBICACIÓN -->
        <div style="padding:12px 18px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:0.75rem; color:rgba(255,255,255,0.8);">
            ${req.phone ? `<div>📱 <b>${escapeHTML(req.phone)}</b></div>` : ''}
            ${req.email ? `<div>✉️ <b>${escapeHTML(req.email)}</b></div>` : ''}
          </div>

          ${(mapsUrl || locationStr) ? `
            <div style="display:flex; align-items:center; gap:8px; font-size:0.7rem; color:#F5C518;">
              <span>📍</span>
              <span>${escapeHTML(locationStr || 'Coordenadas GPS capturadas')}</span>
              ${mapsUrl ? `
                <a href="${mapsUrl}" target="_blank" style="color:#F5C518; text-decoration:underline; font-weight:800; font-size:0.65rem; margin-left:auto;">
                  Abrir en Google Maps ↗
                </a>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- DETALLES FINANCIEROS Y DE PAGO -->
        <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
            <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
              <div style="font-size:1.15rem; font-weight:900; color:#F5C518;">
                $${Number(req.amount_usd || 0).toFixed(2)} USD
              </div>
              <div style="font-size:0.65rem; color:#aaa; font-weight:700; margin-top:2px;">
                Bs. ${Number(req.amount_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa: ${Number(req.bcv_rate_used || 40).toFixed(2)})
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
              <div style="font-size:0.75rem; font-weight:900; color:white; word-break:break-all;">
                ${escapeHTML(req.payment_method || 'N/A')}
              </div>
              <div style="font-size:0.65rem; color:#aaa; font-weight:700; margin-top:2px;">
                Ref: <code>${escapeHTML(req.payment_reference || 'S/R')}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- COMPROBANTE DE PAGO -->
        ${req.receipt_url ? `
          <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
              Comprobante de Pago
            </div>
            ${req.receipt_url.toLowerCase().endsWith('.pdf') ? `
              <a href="${escapeHTML(req.receipt_url)}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(255,255,255,0.08); border-radius:10px; color:#F5C518; text-decoration:none; font-weight:800; font-size:0.75rem;">
                📄 Abrir Documento PDF del Comprobante ↗
              </a>
            ` : `
              <img src="${escapeHTML(req.receipt_url)}" alt="Comprobante"
                   style="width:100%; border-radius:12px; max-height:260px; object-fit:contain; background:rgba(255,255,255,0.03); cursor:pointer;"
                   onclick="window.open('${escapeHTML(req.receipt_url)}','_blank')" />
            `}
          </div>
        ` : `
          <div style="padding:10px 18px; font-size:0.7rem; color:rgba(255,255,255,0.4); text-align:center;">
            Sin archivo adjunto (Pago en efectivo o solicitud directa)
          </div>
        `}

        <!-- BOTONES DE ACCIÓN O ESTADO FINAL -->
        <div style="padding:14px 18px;">
          ${isPending ? `
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px;">
              <button onclick="window.handleMasterAction('APPROVE_SUBSCRIPTION_REQUEST','${req.id}')"
                style="background:#22c55e; color:white; border:none; border-radius:12px; padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer; text-transform:uppercase;">
                ✓ APROBAR Y CREAR CONDOMINIO
              </button>
              <button onclick="window.handleMasterAction('REJECT_SUBSCRIPTION_REQUEST','${req.id}')"
                style="background:#e63946; color:white; border:none; border-radius:12px; padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer; text-transform:uppercase;">
                ✕ RECHAZAR
              </button>
            </div>
            ${phoneClean ? `
              <div style="margin-top:8px;">
                <a href="https://wa.me/${phoneClean}" target="_blank"
                   style="display:block; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; font-size:0.65rem; font-weight:800; text-decoration:none; text-align:center;">
                  💬 Contactar por WhatsApp al Administrador
                </a>
              </div>
            ` : ''}
          ` : `
            <div style="text-align:center; padding:6px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:0.65rem; color:#888; font-weight:800; text-transform:uppercase;">Estado:</span>
              <span style="font-size:0.8rem; font-weight:900; color:${isApproved ? '#22c55e' : '#e63946'}; margin-left:6px;">
                ${isApproved ? 'APROBADO & ACTIVADO' : 'RECHAZADO'}
              </span>
              ${req.rejection_reason ? `<div style="font-size:0.65rem; color:#ffccd5; margin-top:4px;">Motivo: ${escapeHTML(req.rejection_reason)}</div>` : ''}
            </div>
          `}
        </div>
      </div>
    `;
  };

  // Helper hidden from loop to avoid being redefined
  const renderProofCard = (p, isPending) => {
    const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#F5C518', ORO:'#ffd700' }
    const planPrices = { TRIAL:'Gratis', BRONCE:'$180/mes', PLATA:'$250/mes', ORO:'$380/mes' }
    const bld = p.buildings || {}
    const proofImg = p.proof_image || p.proof_url || null

    const submitted = p.created_at
      ? new Date(p.created_at).toLocaleString('es-VE', { dateStyle:'medium', timeStyle:'short' })
      : 'Fecha desconocida'
    const planColor = planColors[p.plan_key] || '#888'
    const planPrice = planPrices[p.plan_key] || ''
    const raw = `${escapeHTML(p.id)}|${escapeHTML(p.building_id)}|${escapeHTML(p.plan_key)}`
    const phone = (bld.phone || '').replace(/\D/g, '')
    const loginUrl = window.location.origin + window.location.pathname
    const welcomeMsg = encodeURIComponent(
      '✅ *¡Bienvenido a Sloty!*\n\n' +
      'Hola, tu comprobante fue aprobado y tu edificio *' + (bld.name || 'tu edificio') + '* ya está activo en la plataforma.\n\n' +
      '📱 *Accede aquí:* ' + loginUrl + '\n' +
      '🔑 *Código de edificio:* ' + (bld.code || '—') + '\n' +
      '📦 *Plan activado:* ' + (p.plan_key || '') + ' (' + planPrice + ')\n\n' +
      'Si tienes alguna duda estamos aquí para ayudarte. ¡Éxito con tu gestión! 🚀'
    )
          const rejectMsg = encodeURIComponent(
            '\u274c *Comprobante Rechazado \u2014 Sloty*\n\n' +
            'Hola, revisamos tu comprobante de pago para el plan *' + (p.plan_key || '') + '* y no pudimos aprobarlo.\n\n' +
            'Por favor verifica los datos y vuelve a intentarlo. Si crees que es un error, escr\u00edbenos aqu\u00ed mismo.'
          )

          let actionsHtml = '';
          if (isPending) {
             actionsHtml = `
              <!-- ACCIONES -->
              <div style="padding:14px 18px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                  <button onclick="window.handleMasterAction('APPROVE_PROOF','${raw}')"
                    style="background:#22c55e; color:white; border:none; border-radius:12px;
                           padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer;">
                    \u2713 APROBAR
                  </button>
                  <button onclick="window.handleMasterAction('REJECT_PROOF','${p.id}|${p.building_id}')"
                    style="background:#e63946; color:white; border:none; border-radius:12px;
                           padding:12px; font-size:0.75rem; font-weight:900; cursor:pointer;">
                    \u2717 RECHAZAR
                  </button>
                </div>
                ${phone ? `
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <a href="https://wa.me/${phone}?text=${welcomeMsg}" target="_blank"
                       style="background:#25D366; color:white; border-radius:12px; padding:10px;
                              font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center; display:block;">
                      \ud83d\udcac WS Bienvenida
                    </a>
                    <a href="https://wa.me/${phone}?text=${rejectMsg}" target="_blank"
                       style="background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6);
                              border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:10px;
                              font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center; display:block;">
                      \ud83d\udcac WS Rechazo
                    </a>
                  </div>
                  <a href="https://wa.me/${phone}" target="_blank"
                     style="display:block; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.4);
                            border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px;
                            font-size:0.65rem; font-weight:900; text-decoration:none; text-align:center;">
                    \ud83d\udcac Abrir chat directo con el admin
                  </a>` : `
                  <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px; text-align:center;">
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.3); font-weight:700;">
                      Sin tel\u00e9fono registrado \u2014 edita el edificio para agregar contacto
                    </div>
                  </div>`}
              </div>
             `;
          } else {
             // Historial actions
             const sColor = p.status === 'CONFIRMED' ? '#22c55e' : '#e63946';
             const sLabel = p.status === 'CONFIRMED' ? 'APROBADO' : 'RECHAZADO';
             actionsHtml = `
              <div style="padding:14px 18px; text-align:center;">
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                   <span style="font-size:0.65rem; color:#999; font-weight:800; text-transform:uppercase;">Estado Final:</span><br>
                   <span style="font-size:0.9rem; font-weight:900; color:${sColor};">${sLabel}</span>
                </div>
              </div>
             `;
          }

          return `
            <div style="background:#0f1127; border:1px solid ${isPending ? 'rgba(245,197,24,0.2)' : 'rgba(255,255,255,0.1)'};
                        border-radius:20px; overflow:hidden; margin-bottom:20px; opacity:${isPending ? '1' : '0.8'};">

              <!-- HEADER EDIFICIO -->
              <div style="padding:16px 18px 12px; background:${isPending ? 'rgba(245,197,24,0.05)' : 'rgba(255,255,255,0.02)'};
                          border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <div style="font-size:1rem; font-weight:900; color:white; margin-bottom:2px;">
                      ${escapeHTML(bld.name || 'Edificio sin nombre')}
                    </div>
                    <div style="font-size:0.65rem; color:#999; font-weight:700;">
                      ${escapeHTML(bld.code || '—')} · ${escapeHTML(bld.city || 'Ciudad no registrada')}
                    </div>
                  </div>
                  <span style="background:${planColor}; color:${p.plan_key === 'ORO' ? '#1a1a2e' : 'white'};
                               padding:4px 10px; border-radius:8px; font-size:0.65rem; font-weight:900;">
                    ${escapeHTML(p.plan_key || 'TRIAL')}
                  </span>
                </div>
              </div>

              <!-- DATOS DE CONTACTO -->
              <div style="padding:12px 18px; border-bottom:1px solid rgba(255,255,255,0.06);
                          display:flex; gap:16px; flex-wrap:wrap;">
                ${bld.admin_email ? `
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span>✉️</span>
                    <span style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-weight:700;">${escapeHTML(bld.admin_email)}</span>
                  </div>` : ''}
                ${bld.phone ? `
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span>📱</span>
                    <span style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-weight:700;">${escapeHTML(bld.phone)}</span>
                  </div>` : ''}
              </div>

              <!-- DATOS DEL PAGO -->
              <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:0.6rem; font-weight:900; color:#999;
                            text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
                  Detalles del Pago
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px;">
                    <div style="font-size:1.1rem; font-weight:900; color:#F5C518;">
                      $${Number(p.amount || 0).toFixed(2)}
                    </div>
                    <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">MONTO</div>
                  </div>
                  <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px;">
                    <div style="font-size:0.75rem; font-weight:900; color:white; word-break:break-all;">
                      ${escapeHTML(p.reference || 'Sin referencia')}
                    </div>
                    <div style="font-size:0.6rem; color:#999; font-weight:700; margin-top:2px;">REFERENCIA</div>
                  </div>
                </div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.3); font-weight:700; margin-top:8px;">
                  📅 Enviado: ${submitted}
                </div>
              </div>

              <!-- COMPROBANTE -->
              ${proofImg ? `
                <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="font-size:0.6rem; font-weight:900; color:#999;
                              text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                    Comprobante
                  </div>
                  <img src="${escapeHTML(proofImg)}" alt="Comprobante de pago"
                       style="width:100%; border-radius:12px; max-height:280px;
                              object-fit:contain; background:rgba(255,255,255,0.03); cursor:pointer;"
                       onclick="window.open('${escapeHTML(proofImg)}','_blank')" />
                  <div style="font-size:0.6rem; color:rgba(255,255,255,0.3); font-weight:700;
                              margin-top:6px; text-align:center;">
                    Toca la imagen para verla completa
                  </div>
                </div>` : `
                <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="background:rgba(230,57,70,0.08); border:1px dashed rgba(230,57,70,0.3);
                              border-radius:10px; padding:12px; text-align:center;">
                    <div style="font-size:0.7rem; color:#e63946; font-weight:700;">
                      \u26a0\ufe0f Sin comprobante adjunto
                    </div>
                  </div>
                </div>`}

              ${actionsHtml}
            </div>`
    };


  const renderBuildings = (buildings = []) => {
    return `<div style="padding:20px 20px 0;">
      <button data-action="ADD_BUILDING"
        style="width:100%; background:#F5C518; color:#1a1a2e; border:none;
               border-radius:14px; padding:14px; font-size:0.8rem;
               font-weight:900; cursor:pointer; letter-spacing:1px;
               text-transform:uppercase; margin-bottom:16px;">
        + NUEVO EDIFICIO
      </button>

      ${buildings.map(b => `
        <div style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div data-action="SELECT_BUILDING" data-id="${b.id}" style="flex:1; cursor:pointer;">
            <div style="font-size:1rem;font-weight:900;color:white;">${escapeHTML(b.name || '')}</div>
            <div style="font-size:0.6rem;color:#999;margin-top:4px;">${escapeHTML(b.code || '')}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span>${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}</span>
            <button data-action="DELETE_BUILDING" data-id="${b.id}" data-name="${escapeHTML(b.name || '')}"
              style="background:rgba(230,57,70,0.1); border:1px solid rgba(230,57,70,0.3); color:#e63946;
                     width:34px; height:34px; border-radius:10px; cursor:pointer; font-size:0.9rem;
                     display:flex; align-items:center; justify-content:center;">
              🗑️
            </button>
          </div>
        </div>
      `).join('')}
      ${!buildings.length ? '<div style="color:rgba(255,255,255,0.2);text-align:center;padding:40px;">No hay edificios registrados en Supabase</div>' : ''}
    </div>`
  }

  const renderMemberships = (buildings = [], eco = {}, pendingCash = []) => {
    const today = new Date();
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiredCount = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'expired' && b.membership_status === 'ACTIVE').length;
    const soonCount    = buildings.filter(b => getExpiryStatus(b.last_expiry) === 'soon' && b.membership_status === 'ACTIVE').length;

    const pendingProofs = eco.proofs || [];

    const sorted = [...buildings].filter(b => b.membership_status === 'ACTIVE' || b.membership_status === 'SUSPENDED').sort((a, b) => {
      const order = { expired: 0, soon: 1, none: 2, ok: 3 };
      return order[getExpiryStatus(a.last_expiry)] - order[getExpiryStatus(b.last_expiry)];
    });

    const renderProofModal = (proof) => {
        const l = document.createElement('div')
        l.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:20px;'
        l.innerHTML = `
            <div style="background:#1a1a2e; border-radius:32px; width:100%; max-width:400px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                <div style="padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <div style="color:white; font-weight:900;">Comprobante de Pago</div>
                    <button class="close-p" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">×</button>
                </div>
                <div style="padding:10px; max-height:60vh; overflow-y:auto;">
                    <img src="${escapeHTML(proof.proof_image)}" style="width:100%; border-radius:12px;">
                </div>
                <div style="padding:20px; background:rgba(0,0,0,0.2); display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <button class="approve-p" style="padding:16px; background:#22c55e; color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">Aprobar</button>
                    <button class="reject-p" style="padding:16px; background:#e63946; color:white; border:none; border-radius:14px; font-weight:900; cursor:pointer; font-size:0.75rem;">Rechazar</button>
                </div>
            </div>
        `
        document.body.appendChild(l)
        l.querySelector('.close-p').onclick = () => l.remove()
        l.querySelector('.approve-p').onclick = () => { actions.APPROVE_PROOF(proof); l.remove() }
        l.querySelector('.reject-p').onclick = () => { actions.REJECT_PROOF(proof); l.remove() }
    }
    
    // Inyectar helper a window temporalmente para que el HTML string pueda llamarlo
    window.viewProof = (idx) => renderProofModal(pendingProofs[idx])

    return `
      <div style="padding:20px; padding-bottom:100px;">
        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          CONTROL DE MEMBRESÍAS
        </div>

        <!-- 💰 SECCIÓN: COMPROBANTES DE PAGO (NEW) -->
        ${pendingProofs.length > 0 ? `
        <div style="margin-bottom:24px;">
            <div style="font-size:0.6rem; font-weight:900; color:#F5C518; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Comprobantes Pendientes (${pendingProofs.length})</div>
            <div style="display:grid; gap:10px;">
                ${pendingProofs.map((p, i) => `
                    <div style="background:rgba(34,197,94,0.05); border:1px solid rgba(34,197,94,0.2); border-radius:16px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:12px; align-items:center;">
                           <div onclick="window.viewProof(${i})" style="width:45px; height:45px; border-radius:10px; background:rgba(255,255,255,0.05); cursor:pointer; overflow:hidden; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                               <img src="${escapeHTML(p.proof_image)}" style="width:100%; height:100%; object-fit:cover;">
                           </div>
                           <div>
                               <div style="font-size:0.85rem; font-weight:900; color:white;">${escapeHTML(p.buildings?.name || 'Cargando...')}</div>
                               <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); font-weight:700;">Ref: ${escapeHTML(p.reference || '—')} · $${p.amount}</div>
                           </div>
                        </div>
                        <button onclick="window.viewProof(${i})" style="background:#F5C518; color:#1a1a2e; border:none; border-radius:10px; padding:8px 12px; font-size:0.65rem; font-weight:900; cursor:pointer;">REVISAR</button>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- 💵 SECCIÓN: PAGOS EN EFECTIVO (NEW) -->
        ${pendingCash && pendingCash.length > 0 ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:0.65rem; font-weight:900; color:#22c55e;
                        text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">
              💵 ${pendingCash.length} Pago${pendingCash.length > 1 ? 's' : ''} en Efectivo Pendiente${pendingCash.length > 1 ? 's' : ''}
            </div>
            ${pendingCash.map(b => `
              <div style="background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.2);
                          border-radius:14px; padding:14px 16px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div>
                    <div style="font-size:0.9rem; font-weight:900; color:white;">${escapeHTML(b.name || '')}</div>
                    <div style="font-size:0.65rem; color:#999; font-weight:700;">
                      ${escapeHTML(b.code || '—')} · Plan ${escapeHTML(b.plan || 'TRIAL')} · Espera confirmación de pago en efectivo
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="window.handleMasterAction('ACTIVATE_CASH','${b.id}')"
                    style="flex:1; background:#22c55e; color:white; border:none;
                           border-radius:10px; padding:10px; font-size:0.7rem;
                           font-weight:900; cursor:pointer;">
                    ✓ CONFIRMAR PAGO
                  </button>
                  ${b.phone ? `
                    <a href="https://wa.me/${(b.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent('Hola, coordinemos el pago en efectivo de tu plan ' + (b.plan||'') + ' en Sloty.')}"
                       target="_blank"
                       style="background:rgba(255,255,255,0.06); color:white; border:none;
                              border-radius:10px; padding:10px 14px; font-size:0.75rem;
                              font-weight:900; text-decoration:none; display:flex; align-items:center;">
                      💬
                    </a>` : ''}
                </div>
              </div>`).join('')}
          </div>` : ''}

        ${expiredCount > 0 ? `
          <div style="background:rgba(230,57,70,0.15); border:1px solid #e63946;
                      border-radius:14px; padding:12px 16px; margin-bottom:12px;
                      display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.2rem;">🚨</span>
            <div>
              <div style="font-size:0.75rem; font-weight:900; color:#e63946;">
                ${expiredCount} membresía${expiredCount > 1 ? 's' : ''} vencida${expiredCount > 1 ? 's' : ''}
              </div>
              <div style="font-size:0.65rem; color:rgba(255,255,255,0.5);">
                Requieren cobro inmediato
              </div>
            </div>
          </div>` : ''}

        ${soonCount > 0 ? `
          <div style="background:rgba(245,197,24,0.1); border:1px solid #F5C518;
                      border-radius:14px; padding:12px 16px; margin-bottom:16px;
                      display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.2rem;">⚠️</span>
            <div>
              <div style="font-size:0.75rem; font-weight:900; color:#F5C518;">
                ${soonCount} membresía${soonCount > 1 ? 's' : ''} vence${soonCount > 1 ? 'n' : ''} en menos de 7 días
              </div>
              <div style="font-size:0.65rem; color:rgba(255,255,255,0.5);">
                Programa el cobro pronto
              </div>
            </div>
          </div>` : ''}

        <div style="display:grid; gap:10px;">
          ${sorted.map(b => {
            const status = getExpiryStatus(b.last_expiry);
            const borderColor = status === 'expired' ? '#e63946' : status === 'soon' ? '#F5C518' : 'rgba(255,255,255,0.1)';
            const expLabel = b.last_expiry
              ? `Vence: ${new Date(b.last_expiry).toLocaleDateString('es-VE')}`
              : 'Sin pago registrado';
            return `
              <div data-action="OPEN_DOSSIER" data-id="${b.id}" style="background:rgba(255,255,255,0.06); padding:16px;
                          border-radius:14px; border:1.5px solid ${borderColor};
                          display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <div>
                  <div style="font-weight:900; color:white; font-size:0.9rem;">
                    ${escapeHTML(b.name || '')}
                  </div>
                  <div style="display:flex; gap:6px; margin-top:4px; align-items:center; flex-wrap:wrap;">
                    ${getBadge(b.plan || 'TRIAL', b.membership_status || 'ACTIVE')}
                    <span style="color:${status === 'expired' ? '#e63946' : status === 'soon' ? '#F5C518' : '#999'};
                                font-size:0.6rem; font-weight:700;">
                      ${status === 'expired' ? '🔴' : status === 'soon' ? '🟡' : '🟢'} ${expLabel}
                    </span>
                  </div>
                </div>
                <button data-action="REGISTER_PAYMENT"
                        data-id="${b.id}" data-name="${escapeHTML(b.name || '')}" data-plan="${escapeHTML(b.plan||'TRIAL')}"
                        style="background:${status === 'expired' ? '#e63946' : '#1a1a2e'};
                               color:${status === 'expired' ? 'white' : '#F5C518'};
                               border:1px solid ${status === 'expired' ? '#e63946' : '#F5C518'};
                               padding:8px 12px; border-radius:8px;
                               font-weight:900; font-size:0.65rem; cursor:pointer;
                               white-space:nowrap;">
                  COBRAR
                </button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  // ─── SVG Area Chart Helper ─────────────────────────────────
  const makeAreaChart = (byMonth, months) => {
    if (!months || months.length === 0) {
      return '<div style="color:rgba(255,255,255,0.3);font-size:0.75rem;text-align:center;padding:20px;">Sin registros de pago aún</div>';
    }
    const chron = [...months].reverse();
    const values = chron.map(m => byMonth[m] || 0);
    const maxVal = Math.max(...values) || 1;
    const W = 300, H = 100;
    let pts = '', dots = '', labels = '';

    chron.forEach((m, idx) => {
      const val = values[idx];
      const x = chron.length === 1 ? W / 2 : (idx / (chron.length - 1)) * W;
      const y = H - ((val / maxVal) * (H - 20));
      pts += x + ',' + y + ' ';
      dots += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#1a1a2e" stroke="#F5C518" stroke-width="2"/>';
      dots += '<text x="' + x + '" y="' + (y - 10) + '" fill="white" font-size="8" font-weight="900" font-family="Montserrat" text-anchor="middle">$' + val + '</text>';
      const parts = m.split('-');
      const lbl = new Date(parts[0], parts[1] - 1).toLocaleString('es-VE', { month: 'short' }).toUpperCase();
      labels += '<text x="' + x + '" y="' + (H + 16) + '" fill="rgba(255,255,255,0.5)" font-size="8" font-weight="700" font-family="Montserrat" text-anchor="middle">' + lbl + '</text>';
    });

    const areaPolygon = chron.length > 1
      ? '<polygon points="0,' + H + ' ' + pts + W + ',' + H + '" fill="url(#areaGrad)"/>'
      : '';

    return '<svg viewBox="0 -15 ' + W + ' ' + (H + 35) + '" style="width:100%;height:auto;display:block;overflow:visible;">'
      + '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="rgba(245,197,24,0.4)"/>'
      + '<stop offset="100%" stop-color="rgba(245,197,24,0)"/>'
      + '</linearGradient></defs>'
      + '<line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4"/>'
      + areaPolygon
      + '<polyline points="' + pts + '" fill="none" stroke="#F5C518" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + dots + labels
      + '</svg>';
  }

  const renderSystem = (buildings = [], memberships = [], eco = {}) => {
    const totalBld     = buildings.length;
    const activeBld    = buildings.filter(b => b.membership_status !== 'SUSPENDED').length;
    const suspendedBld = totalBld - activeBld;

    // Agrupar ingresos por mes
    const byMonth = {};
    memberships.forEach(m => {
      if (!m.paid_at) return;
      const key = m.paid_at.slice(0, 7); // YYYY-MM
      byMonth[key] = (byMonth[key] || 0) + (Number(m.amount) || 0);
    });
    const months = Object.keys(byMonth).sort().reverse().slice(0, 12);

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const thisMonthIncome = byMonth[thisMonth] || 0;
    const totalIncome = Object.values(byMonth).reduce((a, b) => a + b, 0);

    return `
      <div style="padding:20px; padding-bottom:100px;">
      
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          Tracción de la Plataforma
        </div>
        <div style="background:rgba(245,197,24,0.06); border:1px solid rgba(245,197,24,0.2);
                    border-radius:16px; padding:16px; margin-bottom:20px;">
          <div style="font-size:0.65rem; font-weight:900; color:#F5C518;
                      text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
            Tasa BCV
          </div>
          <div id="bcv-current-display"
               style="font-size:1.4rem; font-weight:900; color:white; margin-bottom:12px;">
            Cargando...
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="bcv-manual-input" type="number" step="0.01" min="1"
                   placeholder="Ej: 607.39"
                   style="flex:1; padding:10px 14px; background:rgba(255,255,255,0.06);
                          border:1px solid rgba(255,255,255,0.15); border-radius:10px;
                          color:white; font-size:0.9rem; font-weight:700; outline:none;" />
            <button onclick="window.handleMasterAction('UPDATE_BCV_RATE')"
              style="background:#F5C518; color:#1a1a2e; border:none; border-radius:10px;
                     padding:10px 16px; font-size:0.75rem; font-weight:900; cursor:pointer;">
              ACTUALIZAR
            </button>
          </div>
          <div style="font-size:0.6rem; color:rgba(255,255,255,0.3); font-weight:700; margin-top:8px;">
            Si la tasa automática falla, actualízala aquí. Todos los paneles la verán al instante.
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:24px;">
          <div style="background:rgba(245,197,24,0.1); padding:16px; border:1px solid #F5C518; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#F5C518;">${eco.residents || 0}</div>
            <div style="font-size:0.55rem; color:#F5C518; font-weight:900; margin-top:2px; text-transform:uppercase;">Usuarios Activos</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:white;">${eco.movements || 0}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px; text-transform:uppercase;">Movimientos Rec.</div>
          </div>
          <div style="background:rgba(34,197,94,0.1); padding:16px; border:1px solid #22c55e; border-radius:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">${eco.personnel || 0}</div>
            <div style="font-size:0.55rem; color:#22c55e; font-weight:900; margin-top:2px; text-transform:uppercase;">Guardias Ops.</div>
          </div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;">
          Estadísticas Globales
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:white;">${totalBld}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">EDIFICIOS TOTALES</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:#22c55e;">${activeBld}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">ACTIVOS</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:#F5C518;">$${thisMonthIncome.toFixed(2)}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS ESTE MES</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); padding:16px;
                      border-radius:14px; text-align:center;">
            <div style="font-size:1.8rem; font-weight:900; color:white;">$${totalIncome.toFixed(2)}</div>
            <div style="font-size:0.55rem; color:#999; font-weight:900; margin-top:2px;">INGRESOS TOTALES</div>
          </div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Evolución de Ingresos
        </div>
        
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:20px; margin-bottom:24px;">
           ${makeAreaChart(byMonth, months)}
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#999;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Matriz de Beneficios por Plan
        </div>

        <div style="display:grid; gap:10px; margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#888; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">TRIAL</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Gestión Básica • Hasta 10 puestos • Menú Guardia Simple</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#cd7f32; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">BRONCE</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Hasta 30 puestos • Control de estacionamiento • Residente y Abonos</div>
          </div>
          <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#aaa; color:white; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">PLATA</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); line-height:1.4;">Hasta 150 puestos • Multinivel • Visitantes frecuentes • Alertas WhatsApp</div>
          </div>
          <div style="background:rgba(245,197,24,0.1); border:1px solid #F5C518; border-radius:14px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#F5C518; color:#1a1a2e; font-size:0.6rem; font-weight:900; padding:6px 12px; border-radius:8px; min-width:60px; text-align:center;">ORO</div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.9); line-height:1.4;">Puestos Ilimitados • Bitácora de Auditoría • Cartelera de Anuncios • Soporte VIP</div>
          </div>
        </div>

        <div style="font-size:0.7rem; font-weight:900; color:#e63946;
                    letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">
          Zona de Peligro
        </div>
        <button data-action="RESET_FULL"
          style="width:100%; padding:14px; background:rgba(230,57,70,0.1);
                 color:#e63946; border:1px solid #e63946; border-radius:12px;
               font-weight:900; cursor:pointer; font-size:0.8rem;">
          RESET FULL SYSTEM (DESARROLLO)
        </button>
      </div>`;
  }

  const renderAds = (ads = [], buildings = []) => `
    <div style="padding:20px; padding-bottom:100px;">
      <h3 style="color:white; font-weight:900; margin-bottom:8px;">GESTIÓN DE ANUNCIOS</h3>
      <p style="color:rgba(255,255,255,0.4); font-size:0.65rem; line-height:1.4; margin-bottom:20px;">
        Los anuncios se mostrarán en el carrusel principal de los usuarios según la segmentación.
      </p>

      <!-- UPLOAD AREA -->
      <div style="background:rgba(255,255,255,0.06); padding:24px; border-radius:24px; border:1px dashed rgba(255,255,255,0.2); text-align:center; margin: 0 10px 30px 10px;">
        <div style="font-size:2rem; margin-bottom:10px;">📸</div>
        <div style="color:white; font-weight:900; font-size:0.9rem; margin-bottom:12px;">Nueva Imagen Publicitaria</div>
        
        <div style="margin-bottom:15px; text-align:left;">
           <label style="color:#999;font-size:0.55rem;font-weight:900;display:block;margin-bottom:6px;text-transform:uppercase;">Segmentación (Destino)</label>
           <select id="ad-target-bld" style="width:100%; padding:12px; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:white; font-family:'Montserrat',sans-serif; font-size:0.8rem; font-weight:700;">
              <option value="GLOBAL">🌎 Global (Todos los edificios)</option>
              ${buildings.map(b => `<option value="${b.id}">🏢 ${escapeHTML(b.name || '')}</option>`).join('')}
           </select>
        </div>

        <input type="file" id="ad-file-input" accept="image/*" style="display:none;">
        <button onclick="document.getElementById('ad-file-input').click()" 
          style="background:#F5C518; color:#1a1a2e; border:none; padding:12px 24px; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; width:100%;">
          SUBIR Y PUBLICAR
        </button>
      </div>

      <div style="margin: 0 10px;">
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518; margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">HISTORIAL DE ANUNCIOS</div>
        
        <div class="ads-history-grid">
          ${ads.map(a => `
            <div class="ad-history-item">
              <img src="${a.image_url}">
              <div class="ad-history-actions">
                 <button data-action="REPOST_AD" data-id="${a.id}" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Repost">🔁</button>
                 <button data-action="TOGGLE_AD" data-id="${a.id}" data-active="${a.active}" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Toggle">${a.active ? '👁️' : '🚫'}</button>
                 <button data-action="DELETE_AD" data-id="${a.id}" style="background:#e63946; color:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Delete">🗑️</button>
              </div>
              ${!a.active ? `<div style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; font-size:0.5rem; padding:2px 4px; border-radius:4px;">OCULTO</div>` : ''}
            </div>
          `).join('')}
          ${!ads.length ? '<div style="grid-column:span 3; text-align:center; padding:40px; color:rgba(255,255,255,0.2); font-size:0.8rem;">No hay anuncios subidos</div>' : ''}
        </div>
      </div>
    </div>`

  const renderShell = () => {
    container.innerHTML = `<div id="master-shell" style="background:#1a1a2e;min-height:100vh;font-family:'Montserrat',sans-serif;">
      <div style="background:#F5C518;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:1.1rem;font-weight:900;letter-spacing:-1px;color:#1a1a2e;">SLOTY MASTER</div><button data-action="LOGOUT" style="background:#1a1a2e;color:#F5C518;border:none;padding:5px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;cursor:pointer;">SALIR</button></div>
      <div id="master-tabs-area"></div><div id="master-content-area"></div>
    </div>`
    elShell = container.querySelector('#master-tabs-area')
    elContent = container.querySelector('#master-content-area')
  }

  const render = async () => {
    // Exponer la función actions() globalmente para los onclick inline del dosier
    window.handleMasterAction = (action, payload) => {
      if (actions[action]) actions[action](payload)
    }

    if (!elShell) renderShell()
    elShell.innerHTML = tabBar()

    // Suscribir Realtime si no está activo
    if (!masterChannel) {
      masterChannel = supabase
        .channel('master-proofs')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'subscription_requests'
        }, () => {
          notifCount++
          const nBadge = document.getElementById('master-notif-badge')
          if (nBadge) { nBadge.textContent = notifCount; nBadge.style.display = 'inline-flex' }
          else { const ta = document.getElementById('master-tabs-area'); if (ta) ta.innerHTML = tabBar() }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'building_payment_proofs'
        }, () => {
          pendingProofsCount++
          notifCount++
          const badge = document.getElementById('master-pending-badge')
          if (badge) { badge.textContent = pendingProofsCount; badge.style.display = 'inline-flex' }
          const nBadge = document.getElementById('master-notif-badge')
          if (nBadge) { nBadge.textContent = notifCount; nBadge.style.display = 'inline-flex' }
          else { const ta = document.getElementById('master-tabs-area'); if (ta) ta.innerHTML = tabBar() }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'buildings'
        }, () => {
          notifCount++
          const nBadge = document.getElementById('master-notif-badge')
          if (nBadge) { nBadge.textContent = notifCount; nBadge.style.display = 'inline-flex' }
          else { const ta = document.getElementById('master-tabs-area'); if (ta) ta.innerHTML = tabBar() }
        })
        .subscribe()
    }

    let html = ''
    if (activeTab === 'NOTIFICATIONS') {
      notifCount = 0  // reset badge
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [
        { data: subReqs },
        { data: proofs },
        { data: newBlds }
      ] = await Promise.all([
        supabase.from('subscription_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('building_payment_proofs')
          .select('*, buildings(name, phone, admin_email, city, code)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('buildings')
          .select('*')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
      ])
      html = renderNotifications(subReqs || [], proofs || [], newBlds || [])
    }
    else if (activeTab === 'BUILDINGS') {
      const { data: bld } = await supabase.from('buildings').select('*').order('created_at', { ascending: false })
      html = renderBuildings(bld || [])
    }
    else if (activeTab === 'MEMBERSHIPS') {
      pendingProofsCount = 0  // reset badge al abrir la pestaña
      const [
        { data: bldRaw },
        { data: mems },
        { data: proofs }
      ] = await Promise.all([
        supabase.from('buildings').select('*').order('created_at', { ascending: false }),
        supabase.from('sloty_memberships').select('*').order('expiry_date', { ascending: false }),
        supabase.from('building_payment_proofs').select('*, buildings(name)').in('status', ['PENDING', 'CONFIRMED', 'REJECTED'])
      ])

      const pendingCash = (bldRaw || []).filter(b => b.membership_status === 'PENDING_CASH')
      const enrichedBld = (bldRaw || []).map(b => {
         const bMems = (mems || []).filter(m => m.building_id === b.id && m.status === 'CONFIRMED');
         b.last_expiry = bMems.length > 0 ? bMems[0].expiry_date : null;
         return b;
      })
      html = renderMemberships(enrichedBld, { proofs: proofs || [] }, pendingCash)
    }
    else if (activeTab === 'ADS') {
      const [ { data: ads }, { data: bld } ] = await Promise.all([
        supabase.from('ads').select('*').order('timestamp', { ascending: false }),
        supabase.from('buildings').select('id, name').order('name')
      ])
      html = renderAds(ads || [], bld || [])
      
      setTimeout(() => {
        const input = document.getElementById('ad-file-input')
        if(input) {
          input.onchange = (e) => {
            const file = e.target.files[0]
            if (!file) return
            actions.ADD_AD(file)
          }
        }
      }, 100);
    }
    else if (activeTab === 'SYSTEM') {
      let ecoData = {}
      try {
        const [
          { data: bld }, 
          { data: mems },
          { count: resCount },
          { count: persCount },
          { count: movCount }
        ] = await Promise.all([
          supabase.from('buildings').select('*'),
          supabase.from('sloty_memberships').select('amount, paid_at'),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
          supabase.from('personnel').select('*', { count: 'exact', head: true }),
          supabase.from('access_logs').select('*', { count: 'exact', head: true })
        ])
        
        ecoData = {
          residents: resCount || 0,
          personnel: persCount || 0,
          movements: movCount || 0
        }
        html = renderSystem(bld || [], mems || [], ecoData)
      } catch (e) {
        console.warn('Error loading system data:', e)
        html = renderSystem([], [], {})
      }
      
      // Mostrar tasa BCV actual
      getExchangeRate().then(bcv => {
        const el = document.getElementById('bcv-current-display');
        if (el && bcv?.rate) {
          el.textContent = `Bs. ${Number(bcv.rate).toLocaleString('es-VE', {
            minimumFractionDigits:2, maximumFractionDigits:2
          })} · ${bcv.source === 'auto' ? 'Automática ✓' : 'Manual ⚠️'}`;
        }
      }).catch(() => {});
    }
    
    elContent.innerHTML = html
  }

  render()
}
