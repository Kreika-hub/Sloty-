/**
 * Admin Users — Residents and abonos (SUBS & ABONOS tabs)
 * Extracted from admin.js (Phase C Lot 2 refactor)
 */
import { supabase, getParkingState, logAudit, logMovement, showToast, enqueueSync } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store, getSubsCached } from './admin-store.js'

// ─── CONTRACTS TAB RENDERER (SUBS) ───────────────────────────
export const renderMonthlySystem = async (state) => {
  const { subs, bld } = store.cachedSubs || { subs: [], bld: null };
  const editingResident = store.editingResident;

  return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">SISTEMA DE RESIDENTES</h2>
      
      <!-- Selector de Sub-Pestaña Segmentado -->
      <div class="sub-tab-nav" style="display:flex; background:#e4e6eb; border-radius:14px; padding:4px; margin-bottom:20px; gap:4px;">
        <button data-action="TAB" data-tab="SUBS" style="flex:1; padding:10px; border-radius:10px; border:none; background:white; color:var(--primary); font-weight:800; font-size:0.75rem; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 10px rgba(0,0,0,0.06);">CONTRATOS</button>
        <button data-action="TAB" data-tab="ABONOS" style="flex:1; padding:10px; border-radius:10px; border:none; background:transparent; color:#666; font-weight:800; font-size:0.75rem; cursor:pointer; transition:all 0.2s; box-shadow:none;">COBROS / ABONOS</button>
      </div>

      <!-- NUEVO RESIDENTE -->
      <div style="background:#1a1a2e; padding:25px; border-radius:28px; color:white; margin-bottom:25px; box-shadow:0 15px 35px rgba(26,26,46,0.3);">
         <div style="font-size:0.7rem; font-weight:800; color:var(--accent); text-transform:uppercase; margin-bottom:15px;">NUEVO RESIDENTE (CONTRATO)</div>
         <div style="display:grid; gap:12px;">
            <input type="text" id="new-sub-name" placeholder="Nombre Completo" style="padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
            <div id="new-sub-plates-container" style="display:grid; gap:8px;">
               <div style="display:flex; gap:8px;">
                  <input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo 1" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
               </div>
            </div>
            <button id="add-plate-field" type="button" style="background:none; border:1px dashed rgba(255,255,255,0.3); color:rgba(255,255,255,0.6); padding:10px; border-radius:12px; font-size:0.7rem; font-weight:700; cursor:pointer; margin-top:5px;">+ AÑADIR OTRO VEHÍCULO</button>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">MARCA</label>
                  <input type="text" id="vehicle-brand" placeholder="Toyota..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">MODELO</label>
                  <input type="text" id="vehicle-model" placeholder="Corolla..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">COLOR</label>
                  <input type="text" id="vehicle-color" placeholder="Rojo..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">PRECIO ACORDADO ($)</label>
                  <input type="number" id="new-sub-price" value="${bld?.monthly_rate || 0}" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:900;">
                  <div id="new-sub-price-ves" style="font-size:0.6rem; color:rgba(255,255,255,0.6); margin-top:4px; font-weight:700;">Equivale a: Bs. --.--</div>
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">CANT. PUESTOS</label>
                  <input type="number" id="new-sub-count" value="1" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:900;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TORRE</label>
                  <input type="text" id="new-sub-tower" placeholder="Ej: A" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">PISO</label>
                  <input type="text" id="new-sub-floor" placeholder="Ej: 4" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">APARTAMENTO</label>
                  <input type="text" id="new-sub-apt" placeholder="Ej: 402" style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TELÉFONO</label>
                  <input type="tel" id="new-sub-phone" placeholder="+58..." style="width:100%; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
               </div>
            </div>
            <div style="display:flex; gap:10px;">
               <button data-action="ADD_RESIDENT" style="flex:2; padding:18px; background:#1a1a2e; color:var(--accent); border:none; border-radius:14px; font-weight:900; font-size:0.8rem; cursor:pointer; margin-top:5px; text-transform:uppercase;">${editingResident ? 'GUARDAR CAMBIOS' : 'REGISTRAR Y ACTIVAR'}</button>
               ${editingResident ? `<button data-action="CANCEL_EDIT_RESIDENT" style="flex:1; padding:18px; background:rgba(255,255,255,0.1); color:white; border:none; border-radius:14px; font-weight:700; font-size:0.8rem; cursor:pointer; margin-top:5px;">CANCELAR</button>` : ''}
            </div>
         </div>
      </div>

      <!-- LISTA DE RESIDENTES -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">RESIDENTES ACTIVOS (${subs?.length || 0})</div>
        <div style="font-size:0.6rem; color:#999; font-weight:800;">TOTAL: $${(subs || []).reduce((a,b)=>a+(b.custom_price||0),0)}/mes</div>
      </div>

      <div style="display:grid; gap:12px;">
        ${(subs || []).map(r => {
          const daysLeft = Math.ceil((new Date(r.expiry_date) - new Date()) / 86400000)
          const expiryBadge = daysLeft <= 5 && daysLeft >= 0
            ? '<span style="background:#fff3cd; color:#856404; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:6px; margin-left:6px;">⚠️ ' + daysLeft + 'd</span>'
            : daysLeft < 0
            ? '<span style="background:#ffd6d6; color:#e63946; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:6px; margin-left:6px;">VENCIDO</span>'
            : ''
          return `
          <div style="background:white; padding:20px; border-radius:28px; border:1.5px solid ${r.is_coming ? '#F5C518' : '#f0f0f0'}; box-shadow:0 10px 30px rgba(0,0,0,0.03); position:relative; overflow:hidden;">
             ${r.is_coming ? `<div style="position:absolute; top:0; left:0; background:#F5C518; color:#1a1a2e; padding:4px 12px; font-size:0.55rem; font-weight:900; border-bottom-right-radius:12px; animation: pulse 2s infinite;">EN CAMINO 🚗</div>` : ''}
             
             <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <div style="flex:1;">
                   <div style="font-weight:900; color:var(--primary); font-size:1.1rem; line-height:1.2;">${escapeHTML(r.resident_name)}${expiryBadge}</div>
                   <div style="display:flex; gap:8px; margin-top:5px;">
                      <span style="font-size:0.6rem; background:#f0f2f5; padding:3px 8px; border-radius:8px; font-weight:800; color:#666;">TORRE ${escapeHTML(r.tower) || '-'}</span>
                      <span style="font-size:0.6rem; background:#f0f2f5; padding:3px 8px; border-radius:8px; font-weight:800; color:#666;">APTO ${escapeHTML(r.apt) || '-'}</span>
                   </div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">$${r.custom_price || 0}</div>
                   <div style="font-size:0.5rem; color:#bbb; font-weight:800; text-transform:uppercase;">MENSUAL</div>
                </div>
             </div>

             <div style="background:#fafafa; border-radius:16px; padding:12px; margin-bottom:15px; border:1px solid #f0f0f0;">
                <div style="font-size:0.5rem; color:#999; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Vehículos Registrados</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                   ${r.plate.split(',').map(p => `<span style="background:#1a1a2e; color:var(--accent); font-size:0.7rem; font-weight:900; padding:4px 10px; border-radius:8px;">${escapeHTML(p.trim())}</span>`).join('')}
                </div>
             </div>

             <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f0f0f0; pt:15px; margin-top:5px; padding-top:15px;">
                <div style="font-size:0.65rem; color:#999; font-weight:700;">
                   Vence: <span style="color:${new Date(r.expiry_date) > new Date() ? '#22c55e' : '#e63946'}; font-weight:900;">${new Date(r.expiry_date).toLocaleDateString()}</span>
                </div>
                <div style="display:flex; gap:10px;">
                   ${daysLeft <= 7 || daysLeft < 0 ? `
                   <button data-action="SEND_EXPIRY_ALERT" data-id="${r.id}" data-name="${escapeHTML(r.resident_name)}" data-phone="${escapeHTML(r.phone)}" data-days="${daysLeft}" data-amount="${r.custom_price || 0}" style="background:#f59e0b; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; font-size:1.1rem;" title="Enviar Alerta de Vencimiento">
                      🔔
                   </button>
                   ` : ''}
                   <button data-action="RESIDENT_PAYMENTS" data-id="${r.id}" data-name="${escapeHTML(r.resident_name)}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#3b82f6;">
                      <div style="width:18px; height:18px;">${ICONS.FINANCE}</div>
                   </button>
                   <button data-action="EDIT_RESIDENT" data-id="${r.id}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#666;">
                      <div style="width:18px; height:18px;">${ICONS.EDIT}</div>
                   </button>
                   <button data-action="GEN_CREDENTIAL" data-id="${r.id}" style="background:#f4f4f4; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#666;">
                      <div style="width:18px; height:18px;">${ICONS.CARD}</div>
                   </button>
                   <button data-action="SEND_RESIDENT_ACCESS" data-id="${r.id}" data-phone="${escapeHTML(r.phone)}" data-plate="${escapeHTML(r.plate)}" style="background:none; border:none; padding:0; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Enviar Acceso">
                      <img src="/icons/whatsapp-svgrepo-com.svg" style="width:28px; height:28px; filter:drop-shadow(0 2px 4px rgba(34,197,94,0.3));"/>
                   </button>
                   <button data-action="DELETE_RESIDENT" data-id="${r.id}" style="background:#fff0f0; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#e63946;">
                      <div style="width:18px; height:18px;">${ICONS.TRASH}</div>
                   </button>
                </div>
             </div>
          </div>
        `}).join('')}
        ${!subs?.length ? '<div style="text-align:center; padding:100px 20px; color:#ccc; font-weight:900; font-size:0.8rem;">NO HAY RESIDENTES REGISTRADOS</div>' : ''}
      </div>
    </div>`
}

// ─── ABONOS TAB RENDERER (ABONOS) ────────────────────────────
export const renderAbonos = async (state) => {
  const subs = (store.cachedSubs?.subs || []).slice().sort((a,b) => (a.resident_name || '').localeCompare(b.resident_name || ''));
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const abonosToday = (state.movements || []).filter(m => m.type === 'MENSUALIDAD' && m.timestamp.startsWith(today)).reduce((a,b)=>a+(b.amount||0), 0);
  
  return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">REGISTRO DE ABONOS</h2>
      
      <!-- Selector de Sub-Pestaña Segmentado -->
      <div class="sub-tab-nav" style="display:flex; background:#e4e6eb; border-radius:14px; padding:4px; margin-bottom:20px; gap:4px;">
        <button data-action="TAB" data-tab="SUBS" style="flex:1; padding:10px; border-radius:10px; border:none; background:transparent; color:#666; font-weight:800; font-size:0.75rem; cursor:pointer; transition:all 0.2s; box-shadow:none;">CONTRATOS</button>
        <button data-action="TAB" data-tab="ABONOS" style="flex:1; padding:10px; border-radius:10px; border:none; background:white; color:var(--primary); font-weight:800; font-size:0.75rem; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 10px rgba(0,0,0,0.06);">COBROS / ABONOS</button>
      </div>

      <!-- ABONO STATS -->
      <div style="background:#1a1a2e; padding:25px; border-radius:28px; color:white; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 15px 35px rgba(26,26,46,0.2);">
         <div>
            <div style="font-size:0.6rem; font-weight:800; color:var(--accent); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">COBRADO HOY (ABONOS)</div>
            <div style="font-size:1.8rem; font-weight:900;">$${abonosToday.toFixed(2)}</div>
         </div>
         <div style="background:rgba(255,255,255,0.1); width:50px; height:50px; border-radius:15px; display:flex; align-items:center; justify-content:center;">
            <div style="width:24px; height:24px; color:var(--accent);">${ICONS.FINANCE}</div>
         </div>
      </div>

      <div style="background:white; padding:20px; border-radius:24px; margin-bottom:25px; border:1px solid #eee;">
         <div style="font-size:0.7rem; font-weight:800; color:#999; margin-bottom:15px; text-transform:uppercase;">BUSCAR RESIDENTE</div>
         <input type="text" id="abono-search" placeholder="Nombre o Placa..." style="width:100%; padding:15px; border-radius:15px; border:1.5px solid #f0f0f0; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
      </div>

      <div id="abonos-list" style="display:grid; gap:15px;">
        ${(subs || []).map(r => {
          const exp = new Date(r.expiry_date);
          const daysDiff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const monthlyPrice = r.custom_price || 0;
          
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const paidThisMonth = (state.movements || []).filter(m => m.type === 'MENSUALIDAD' && m.plate.includes(r.plate.split(',')[0]) && m.timestamp >= periodStart).reduce((a,b)=>a+(b.amount||0), 0);
          
          const pending = Math.max(0, monthlyPrice - paidThisMonth);

          let statusKey = 'PAID';
          let statusBadge = `<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:8px; font-size:0.6rem; font-weight:900;">🟢 AL DÍA</span>`;
          
          if (daysDiff < 0) {
            statusKey = 'OVERDUE';
            statusBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:8px; font-size:0.6rem; font-weight:900;">🔴 EN MORA (${Math.abs(daysDiff)}d)</span>`;
          } else if (paidThisMonth > 0 && pending > 0) {
            statusKey = 'PARTIAL';
            statusBadge = `<span style="background:#f3e8ff; color:#7e22ce; padding:3px 8px; border-radius:8px; font-size:0.6rem; font-weight:900;">🟣 ABONADO</span>`;
          } else if (daysDiff <= 5) {
            statusKey = 'PENDING';
            statusBadge = `<span style="background:#fef9c3; color:#a16207; padding:3px 8px; border-radius:8px; font-size:0.6rem; font-weight:900;">🟡 POR VENCER (${daysDiff}d)</span>`;
          }

          const hasDebt = statusKey === 'OVERDUE' || pending > 0;
          const rateVal = store.currentBcv?.rate || 40.0;
          const pendingBs = pending * rateVal;

          return `
          <div class="abono-card" data-search="${r.resident_name.toLowerCase()} ${r.plate.toLowerCase()}" style="background:white; padding:22px; border-radius:30px; border:1.5px solid ${hasDebt ? '#ffccd5' : '#f0f0f0'}; display:flex; flex-direction:column; gap:15px; box-shadow:0 12px 35px rgba(0,0,0,0.03); transition:transform 0.2s;">
             <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                   <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                     <div style="font-weight:900; color:var(--primary); font-size:1.1rem;">${escapeHTML(r.resident_name)}</div>
                     ${statusBadge}
                   </div>
                   <div style="font-size:0.7rem; font-weight:700; color:#999;">🚗 ${escapeHTML(r.plate)}</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:1rem; font-weight:950; color:var(--primary);">$${monthlyPrice}</div>
                   <div style="font-size:0.5rem; font-weight:800; color:#bbb; text-transform:uppercase;">MENSUALIDAD</div>
                </div>
             </div>

             <div style="background:#f8f9fa; border-radius:20px; padding:15px; display:grid; grid-template-columns:1fr 1fr; gap:10px; border:1px solid #f0f0f0;">
                <div>
                   <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PAGADO MES</div>
                   <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">$${paidThisMonth.toFixed(2)}</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:0.55rem; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:4px;">PENDIENTE</div>
                   <div style="font-size:0.9rem; font-weight:900; color:${pending > 0 ? '#e63946' : '#22c55e'};">
                     ${pending > 0 ? `-$${pending.toFixed(2)}` : 'SOLVENTE'}
                   </div>
                   ${pending > 0 ? `<div style="font-size:0.55rem; color:#999; font-weight:700; margin-top:2px;">≈ Bs. ${pendingBs.toLocaleString('es-VE', {minimumFractionDigits:2})}</div>` : ''}
                </div>
             </div>

             <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.7rem; font-weight:800; color:${statusKey === 'OVERDUE' ? '#e63946' : '#666'};">
                   Vence: ${exp.toLocaleDateString()}
                </div>
                <div style="display:flex; gap:8px;">
                   <button data-action="SEND_DEBT_WS" data-id="${r.id}" data-name="${escapeHTML(r.resident_name)}" data-debt="${pending || monthlyPrice}" data-days="${daysDiff}" data-phone="${escapeHTML(r.phone)}" style="background:none; border:none; padding:0; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Notificar Deuda">
                      <img src="/icons/whatsapp-svgrepo-com.svg" style="width:28px; height:28px; filter:drop-shadow(0 2px 4px rgba(34,197,94,0.3));"/>
                   </button>
                   <button data-action="SHOW_RESIDENT_HISTORY" data-id="${r.id}" data-name="${escapeHTML(r.resident_name)}" style="background:#f4f4f4; color:#666; border:none; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Historial"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></button>
                   <button data-action="SHOW_ABONO_FORM" data-id="${r.id}" data-name="${escapeHTML(r.resident_name)}" data-price="${r.custom_price}" style="background:#1a1a2e; color:var(--accent); border:none; padding:0 15px; border-radius:12px; font-weight:900; font-size:0.65rem; cursor:pointer;">REGISTRAR</button>
                </div>
             </div>
          </div>
          `
        }).join('')}
      </div>

      <!-- RECENT ABONOS -->
      <div style="margin-top:40px;">
        <div style="font-size:0.7rem; font-weight:900; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">ÚLTIMOS ABONOS REGISTRADOS</div>
        <div style="background:white; border-radius:24px; border:1px solid #eee; overflow:hidden;">
          ${(state.movements || []).filter(m => m.type === 'MENSUALIDAD').slice(0, 5).map(m => `
            <div style="padding:15px 20px; border-bottom:1px solid #f9f9f9; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.85rem; font-weight:900; color:var(--primary);">${escapeHTML(m.plate)}</div>
                <div style="font-size:0.55rem; color:#bbb; font-weight:700;">${new Date(m.timestamp).toLocaleString()} · ${escapeHTML(m.payMethod)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.9rem; font-weight:900; color:#22c55e;">+$${m.amount.toFixed(2)}</div>
                <div style="font-size:0.45rem; color:#999; font-weight:800; text-transform:uppercase;">Ref: ${escapeHTML(m.reference) || 'EFEC'}</div>
              </div>
            </div>
          `).join('') || '<div style="padding:40px; text-align:center; color:#ccc; font-weight:700; font-size:0.7rem;">No hay abonos recientes</div>'}
        </div>
      </div>
    </div>`
}

// ─── DOM HOOKS ──────────────────────────────────────────────
export const setupAbonosHooks = (container) => {
  const searchInput = container.querySelector('#abono-search')
  if (!searchInput) return
  searchInput.oninput = () => {
    const term = searchInput.value.toLowerCase()
    container.querySelectorAll('.abono-card').forEach(c => {
      c.style.display = c.dataset.search.includes(term) ? 'flex' : 'none'
    })
  }
}

export const setupMonthlySystemHooks = (container) => {
  initPlateAdder()
  const priceInput = container.querySelector('#new-sub-price')
  const vesLabel = container.querySelector('#new-sub-price-ves')
  if (priceInput && vesLabel) {
    const updateVes = () => {
      const val = parseFloat(priceInput.value) || 0
      const rateVal = store.currentBcv?.rate || 40.0
      const vesVal = val * rateVal
      vesLabel.textContent = `Equivale a: Bs. ${vesVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    }
    priceInput.oninput = updateVes
    updateVes()
  }
}

export const initPlateAdder = () => {
  const btn = document.getElementById('add-plate-field');
  const container = document.getElementById('new-sub-plates-container');
  if (btn && container) {
    btn.onclick = () => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '8px';
      div.innerHTML = `
        <input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo ${container.children.length + 1}" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
        <button type="button" onclick="this.parentElement.remove()" style="background:rgba(230,57,70,0.2); color:#e63946; border:none; width:45px; border-radius:12px; cursor:pointer; font-weight:900;">✕</button>
      `;
      container.appendChild(div);
    };
  }
}

// ─── ACTIONS INITIALIZER ─────────────────────────────────────
export const initUserActions = (actions, container, refresh) => {
  Object.assign(actions, {
    SEND_DEBT_WS: (btn) => {
      const { name, debt, phone, days } = btn.dataset;
      if (!phone) return showToast('No hay teléfono registrado', 'error');
      const state = getParkingState();
      const debtVal = parseFloat(debt) || 0;
      const rateVal = store.currentBcv?.rate || 40.0;
      const debtBs = (debtVal * rateVal).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const d = parseInt(days) || 0;

      let timeText = '';
      if (d < 0) {
        timeText = `presenta un *retraso de ${Math.abs(d)} días*`;
      } else if (d === 0) {
        timeText = `*vence el día de hoy*`;
      } else {
        timeText = `vence en *${d} días*`;
      }

      const msg = `Hola *${name}*, te saludamos de la Administración de *${state.buildingName || 'tu Condominio'}*.\n\n` +
        `Te recordamos cordialmente que tu mensualidad de estacionamiento ${timeText}.\n\n` +
        `💵 *Saldo Pendiente:* $${debtVal.toFixed(2)}\n` +
        `🇻🇪 *Equivalente en Bs (Tasa BCV ${rateVal.toFixed(2)}):* Bs. ${debtBs}\n\n` +
        `📌 *Formas de Pago:* Puedes realizar tu pago en Efectivo en Garita, Pago Móvil o Transferencia y reportarlo para mantener tu acceso vehicular activo.\n\n` +
        `¡Agradecemos tu puntual colaboración! 🚗`;

      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    SEND_EXPIRY_ALERT: (btn) => {
      const { name, days, phone, amount } = btn.dataset;
      if (!phone) return showToast('No hay teléfono registrado', 'error');
      const d = parseInt(days);
      const isExpired = d < 0;
      let msg = '';
      if (isExpired) {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe escribimos para notificarte que tu suscripción de estacionamiento presenta un *VENCIMIENTO* de ${Math.abs(d)} días.\n\nPor favor, regulariza tu pago de *$${amount}* lo antes posible para reactivar tu acceso automático.\n\n¡Gracias!`;
      } else if (d === 0) {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe recordamos que tu mensualidad de estacionamiento por *$${amount}* *VENCE HOY*.\n\nAgradecemos tu pronto pago para mantener activo tu acceso sin interrupciones.\n\n¡Gracias!`;
      } else {
        msg = `Hola ${name}, te saludamos de la Administración de tu edificio.\n\nTe recordamos amigablemente que tu mensualidad de estacionamiento por *$${amount}* vence en *${d} días*.\n\nAgradecemos tu previsión.\n\n¡Gracias!`;
      }
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    SHOW_RESIDENT_HISTORY: (btn) => {
      const { id, name } = btn.dataset;
      // 🛡️ Data Minimization: select explicit columns
      supabase.from('subscriptions').select('plate').eq('id', id).single().then(async ({data}) => {
         const { data: history } = await supabase
           .from('payments')
           .select('amount, method, payment_date, status, reference')
           .eq('subscription_id', id)
           .order('payment_date', { ascending: false })
           .limit(20)
         
         store.pendingAction = {
           type: 'CUSTOM_MODAL',
           title: `Historial: ${escapeHTML(name)}`,
           content: `
             <div style="max-height:300px; overflow-y:auto; padding:10px; text-align:left;">
                ${history.map(h => {
                  const bdg = h.status === 'CONFIRMED' ? {c:'#22c55e', bg:'rgba(34,197,94,0.1)', t:'PAGADO'} : h.status === 'PENDING' ? {c:'#f59e0b', bg:'rgba(245,158,11,0.1)', t:'PENDIENTE'} : {c:'#e63946', bg:'rgba(230,57,70,0.1)', t:'RECHAZADO'};
                  return `
                  <div style="padding:15px; border-bottom:1px solid #f8f8f8; display:flex; justify-content:space-between; align-items:center;">
                     <div>
                        <div style="font-size:0.8rem; font-weight:900;">$${h.amount.toFixed(2)}</div>
                        <div style="font-size:0.55rem; color:#bbb;">${new Date(h.payment_date).toLocaleDateString()} · ${escapeHTML(h.method || 'PAGO')}</div>
                     </div>
                     <div style="font-size:0.6rem; color:${bdg.c}; font-weight:900; background:${bdg.bg}; padding:4px 8px; border-radius:6px;">${bdg.t}</div>
                  </div>
                `}).join('') || '<div style="padding:40px; text-align:center; color:#ccc;">No hay historial de pagos</div>'}
             </div>
           `
         };
         refresh();
      });
    },
    ADD_RESIDENT: async (btn) => {
      try {
        const name = document.getElementById('new-sub-name').value.trim();
        const plates = Array.from(document.querySelectorAll('.new-sub-plate-input')).map(i => i.value.trim().toUpperCase()).filter(v => v);
        const price = parseFloat(document.getElementById('new-sub-price').value) || 0;
        const count = parseInt(document.getElementById('new-sub-count').value) || 1;
        const tower = document.getElementById('new-sub-tower').value.trim();
        const floor = document.getElementById('new-sub-floor').value.trim();
        const apt = document.getElementById('new-sub-apt').value.trim();
        const phone = document.getElementById('new-sub-phone').value.trim();
        const brand = document.getElementById('vehicle-brand').value.trim();
        const model = document.getElementById('vehicle-model').value.trim();
        const color = document.getElementById('vehicle-color').value.trim();
        
        if(!name || !plates.length) {
          store.pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '⚠️ DATOS REQUERIDOS',
            content: `<p style="color:#666; font-weight:700;">Debes ingresar al menos un nombre y una placa.</p>`
          };
          refresh();
          return;
        }

        const originalText = btn.textContent;
        const plateString = plates.join(', ');
        const state = getParkingState();

        if (!store.editingResident && plates.length > 0) {
          // 🛡️ Data Minimization: select explicit columns
          const { data: existingSubs } = await supabase.from('subscriptions')
            .select('id, resident_name')
            .eq('building_id', state.buildingId)
            .ilike('plate', `%${plates[0]}%`)
            .limit(1);

          if (existingSubs && existingSubs.length > 0) {
            store.pendingAction = {
              type: 'CUSTOM_MODAL',
              title: '⚠️ VEHÍCULO YA REGISTRADO',
              content: `<p style="color:#666; font-weight:700;">La placa <b>${plates[0]}</b> ya pertenece al residente <b>${escapeHTML(existingSubs[0].resident_name)}</b>.<br>Búscalo en la lista y presiona Editar si deseas cambiar sus datos.</p>`
            };
            refresh();
            return;
          }
        }
        
        btn.textContent = store.editingResident ? 'GUARDANDO...' : 'REGISTRANDO...';
        btn.disabled = true;
        
        let error;
        if (store.editingResident) {
          const { error: err } = await supabase.from('subscriptions').update({
            resident_name: name,
            plate: plateString,
            custom_price: price,
            slots_count: count,
            tower: tower,
            floor: floor,
            apt: apt,
            phone: phone
          }).eq('id', store.editingResident);
          error = err;

          if (plateString) {
            // 🛡️ Data Minimization: select explicit columns
            const { data: existing } = await supabase.from('vehicles').select('id').eq('subscription_id', store.editingResident).limit(1);
            if (existing?.length > 0) {
              await supabase.from('vehicles').update({
                plate: plateString.toUpperCase(),
                brand: brand || null,
                model: model || null,
                color: color || null
              }).eq('subscription_id', store.editingResident);
            } else {
              await supabase.from('vehicles').insert({
                building_id: state.buildingId,
                subscription_id: store.editingResident,
                plate: plateString.toUpperCase(),
                brand: brand || null,
                model: model || null,
                color: color || null
              });
            }
          }
        } else {
          const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
          // 🛡️ Data Minimization: select explicit columns
          const { data, error: err } = await supabase.from('subscriptions').insert({
            building_id: state.buildingId,
            resident_name: name,
            plate: plateString,
            expiry_date: expiry.toISOString(),
            status: 'ACTIVE',
            custom_price: price,
            slots_count: count,
            tower: tower,
            floor: floor,
            apt: apt,
            phone: phone,
            pin: null
          }).select('id').single();
          error = err;

          if (!error && data?.id) {
            await supabase.from('vehicles').insert({
              building_id: state.buildingId,
              subscription_id: data.id,
              plate: plateString.toUpperCase(),
              brand: brand || null,
              model: model || null,
              color: color || null
            });
          }
        }
        
        if(!error) {
          if (store.editingResident) {
            await logAudit('EDIT_RESIDENT', { subscription_id: store.editingResident });
          } else {
            await logAudit('ADD_RESIDENT', { resident_name: name, plate: plateString });
          }
          store.pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '✅ ¡RESIDENTE REGISTRADO!',
            content: `
              <div style="text-align:center; padding:20px;">
                <div style="font-size:3rem; margin-bottom:15px;">🚗</div>
                <p style="color:#666; font-size:0.9rem; font-weight:700;">
                  <b>${escapeHTML(name)}</b> ha sido añadido con éxito.<br>
                  Ya puedes enviar su acceso por WhatsApp.
                </p>
              </div>
            `
          };
          
          store.editingResident = null;
          document.getElementById('new-sub-name').value = '';
          const plateContainer = document.getElementById('new-sub-plates-container');
          if(plateContainer) plateContainer.innerHTML = '<div style="display:flex; gap:8px;"><input type="text" class="new-sub-plate-input" placeholder="Placa Vehículo 1" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;"></div>';
          document.getElementById('new-sub-tower').value = '';
          document.getElementById('new-sub-floor').value = '';
          document.getElementById('new-sub-apt').value = '';
          document.getElementById('new-sub-phone').value = '';
          document.getElementById('vehicle-brand').value = '';
          document.getElementById('vehicle-model').value = '';
          document.getElementById('vehicle-color').value = '';
          
          store.cachedSubs = null;
          await refresh(); 
        } else {
          console.error('Supabase Error:', error);
          store.pendingAction = {
            type: 'CUSTOM_MODAL',
            title: '❌ ERROR DE BASE DE DATOS',
            content: `<p style="color:#666; font-weight:700;">${error.message || 'Error al conectar con Supabase.'}</p>`
          };
          btn.textContent = originalText;
          btn.disabled = false;
          refresh();
        }
      } catch (e) {
        console.error('JS Error:', e);
        store.pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ ERROR DE SISTEMA',
          content: `<p style="color:#666; font-weight:700;">${e.message}</p>`
        };
        refresh();
      }
    },
    EDIT_RESIDENT: async (btn) => {
      const id = btn.dataset.id;
      // 🛡️ Data Minimization: select explicit columns
      const { data: res } = await supabase.from('subscriptions')
        .select('id, resident_name, custom_price, slots_count, tower, floor, apt, phone, plate')
        .eq('id', id).single();
      if (!res) return;

      store.editingResident = id;
      store.cachedSubs = null;
      await logAudit('EDIT_RESIDENT', { subscription_id: id });
      await refresh(); 

      document.getElementById('new-sub-name').value = res.resident_name;
      document.getElementById('new-sub-price').value = res.custom_price;
      document.getElementById('new-sub-count').value = res.slots_count;
      document.getElementById('new-sub-tower').value = res.tower || '';
      document.getElementById('new-sub-floor').value = res.floor || '';
      document.getElementById('new-sub-apt').value = res.apt || '';
      document.getElementById('new-sub-phone').value = res.phone || '';

      try {
        // 🛡️ Data Minimization: select explicit columns
        const { data: veh } = await supabase.from('vehicles').select('brand, model, color').eq('subscription_id', id).limit(1).maybeSingle();
        document.getElementById('vehicle-brand').value = veh?.brand || '';
        document.getElementById('vehicle-model').value = veh?.model || '';
        document.getElementById('vehicle-color').value = veh?.color || '';
      } catch (e) {
        console.warn('Error al obtener datos del vehículo:', e);
        document.getElementById('vehicle-brand').value = '';
        document.getElementById('vehicle-model').value = '';
        document.getElementById('vehicle-color').value = '';
      }

      const container = document.getElementById('new-sub-plates-container');
      container.innerHTML = '';
      const plates = res.plate.split(',').map(p => p.trim());
      plates.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.innerHTML = `
          <input type="text" class="new-sub-plate-input" value="${escapeHTML(p)}" placeholder="Placa Vehículo ${idx + 1}" style="flex:1; padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700; text-transform:uppercase;">
          ${idx > 0 ? `<button type="button" onclick="this.parentElement.remove()" style="background:rgba(230,57,70,0.2); color:#e63946; border:none; width:45px; border-radius:12px; cursor:pointer; font-weight:900;">✕</button>` : ''}
        `;
        container.appendChild(div);
      });
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    CANCEL_EDIT_RESIDENT: () => {
      store.editingResident = null;
      refresh();
    },
    CONFIRM_PAYMENT: async (btn) => {
      const pid = btn.dataset.id
      const sid = btn.dataset.sid
      const s = getParkingState()
      
      // 🛡️ Data Minimization: select explicit columns
      const { data: pay } = await supabase.from('payments').select('id, amount, method, reference').eq('id', pid).single()
      const { data: sub } = await supabase.from('subscriptions').select('id, custom_price, expiry_date, plate').eq('id', sid).single()
      
      if (!pay || !sub) return showToast('Error al recuperar datos del pago', 'error')

      const amount = pay.amount
      const price = sub.custom_price || 1
      const currentExp = new Date(sub.expiry_date)
      const startBase = new Date(Math.max(Date.now(), currentExp.getTime()))
      const daysToAdd = Math.round((amount / price) * 30)
      startBase.setDate(startBase.getDate() + daysToAdd)

      const rateVal = Number(store.currentBcv?.rate || 40.0)
      const amountUsd = Number(amount.toFixed(2))
      const amountBs = Number((amountUsd * rateVal).toFixed(2))

      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('payments').update({
           status: 'CONFIRMED',
           amount_usd: amountUsd,
           amount_bs: amountBs,
           bcv_rate_used: rateVal
        }).eq('id', pid),
        supabase.from('subscriptions').update({ expiry_date: startBase.toISOString() }).eq('id', sid)
      ]);

      if (e1 || e2) {
        console.error('Error al confirmar pago:', e1 || e2);
        showToast('Error al confirmar el pago. Intenta de nuevo.', 'error');
        return;
      }

      let movementPayMethod = pay.method || 'EFECTIVO_USD';
      if (movementPayMethod === 'EFECTIVO') movementPayMethod = 'EFECTIVO_USD';
      logMovement({
        type: 'MENSUALIDAD',
        plate: sub.plate.split(',')[0].trim(),
        slot: 'MENSUAL',
        category: 'RESIDENTE',
        guardName: 'Sistema (Appr)',
        payMethod: movementPayMethod,
        amount: amount,
        reference: pay.reference,
        paymentStatus: 'PAGADO'
      })

      await logAudit('CONFIRM_PAYMENT', { payment_id: pid, subscription_id: sid });
      supabase.functions.invoke('send-push', {
        body: {
          building_id: s.buildingId,
          role: 'RESIDENT',
          title: '✅ Pago confirmado',
          body: `Tu pago de $${amount} ha sido aprobado.`
        }
      }).catch(e => console.warn('[Sloty] push error:', e))
      store.cachedMetrics = null
      store.cachedFinance = null
      refresh()
    },
    REJECT_PAYMENT: async (btn) => {
      const s = getParkingState()
      await supabase.from('payments').update({ status: 'REJECTED' }).eq('id', btn.dataset.id)
      supabase.functions.invoke('send-push', {
        body: {
          building_id: s.buildingId,
          role: 'RESIDENT',
          title: '❌ Pago rechazado',
          body: 'Tu pago fue rechazado. Contacta a tu administrador.'
        }
      }).catch(e => console.warn('[Sloty] push error:', e))
      await logAudit('REJECT_PAYMENT', { payment_id: btn.dataset.id });
      store.cachedMetrics = null
      refresh()
    },
    RESIDENT_PAYMENTS: async (btn) => {
      const sid = btn.dataset.id
      const name = btn.dataset.name
      // 🛡️ Data Minimization: select explicit columns
      const { data: pays } = await supabase.from('payments')
        .select('id, amount, method, payment_date, reference, evidence_b64, status')
        .eq('subscription_id', sid)
        .order('payment_date', { ascending: false })
      
      const paysWithProofs = await Promise.all((pays || []).map(async p => {
        let proofHtml = '';
        // 🛡️ Data Minimization: select explicit columns
        const { data: proofs } = await supabase
          .from('payment-proofs')
          .select('file_path, file_name')
          .eq('payment_id', p.id)
          .limit(1);

        if (p.evidence_b64) {
          proofHtml = `
            <div style="margin-top:8px;">
               <div style="font-size:0.55rem; font-weight:800; color:#666; margin-bottom:4px;">EVIDENCIA ADJUNTA (Toque para agrandar)</div>
               <img src="${p.evidence_b64}" style="width:100%; max-width:180px; border-radius:10px; border:1px solid #eee; object-fit:cover; cursor:pointer;" onclick="const w=window.open('','_blank');if(w){w.document.write('<img src=\x22'+this.src+'\x22 style=\x22width:100%\x22 />');}"/>
             </div>
          `;
        } else if (proofs && proofs.length > 0) {
          const { data: urlData } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(proofs[0].file_path, 3600);

          if (urlData?.signedUrl) {
            proofHtml = `
              <a href="${urlData.signedUrl}" target="_blank"
                 style="display:inline-flex; align-items:center; gap:6px;
                        background:#E6F1FB; color:#185FA5; border-radius:50px;
                        padding:5px 12px; font-size:0.65rem; font-weight:900;
                        text-decoration:none; margin-top:8px;">
                📎 Ver comprobante
              </a>`;
          }
        }
        return { ...p, proofHtml };
      }));

      const l = document.getElementById('modal-layer')
      l.style.pointerEvents = 'auto'
      const ML = {
        EFECTIVO: '💵 Efectivo',
        EFECTIVO_USD: '💵 Efectivo $',
        EFECTIVO_BS: '💵 Efectivo Bs',
        PAGO_MOVIL: '📱 Pago Móvil',
        TRANSFERENCIA: '🏦 Transferencia',
        ZELLE: '🌀 Zelle'
      }
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center;z-index:9999;">
          <div style="background:white;border-radius:32px 32px 0 0;width:100%;max-width:480px;padding:30px 25px 40px;max-height:85vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;">
              <div>
                <div style="font-size:0.7rem;font-weight:800;color:#4b5563;text-transform:uppercase;">Pagos Reportados</div>
                <div style="font-size:1.1rem;font-weight:900;color:#1a1a2e;">${escapeHTML(name)}</div>
              </div>
              <button data-action="CANCEL_MODAL" style="background:#f4f4f4;border:none;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;">×</button>
            </div>
            ${!paysWithProofs.length ? '<div style="text-align:center;padding:40px;color:#555555;font-size:0.85rem;font-weight:700;">Sin reportes de pago</div>' : paysWithProofs.map(p => {
              const isBsPay = ['PAGO_MOVIL', 'TRANSFERENCIA', 'EFECTIVO_BS', 'EFECTIVO'].includes(p.method);
              const rateVal = store.currentBcv?.rate || 40;
              const vesText = isBsPay ? ` <span style="font-size:0.75rem; color:#4b5563; font-weight:800;">≈ Bs. ${(p.amount * rateVal).toLocaleString('es-VE', {minimumFractionDigits:2})}</span>` : '';
              return `
              <div style="background:${p.status==='CONFIRMED'?'#f0fdf4':p.status==='REJECTED'?'#fff1f2':'#fafafa'};border:1.5px solid ${p.status==='CONFIRMED'?'#86efac':p.status==='REJECTED'?'#fca5a5':'#e5e7eb'};border-radius:20px;padding:18px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                  <div>
                    <div style="font-weight:900;color:#1a1a2e;font-size:1rem;">$${p.amount}${vesText}</div>
                    <div style="font-size:0.65rem;color:#4b5563;font-weight:700;margin-top:3px;">${ML[p.method]||p.method} · ${new Date(p.payment_date).toLocaleDateString()}</div>
                    ${p.reference ? `<div style="font-size:0.6rem;color:#4b5563;font-weight:700;">Ref: ${escapeHTML(p.reference)}</div>` : ''}
                    ${p.proofHtml}
                  </div>
                  <span style="background:${p.status==='CONFIRMED'?'#22c55e':p.status==='REJECTED'?'#e63946':'#f59e0b'};color:white;padding:4px 10px;border-radius:20px;font-size:0.55rem;font-weight:900;">${p.status==='CONFIRMED'?'CONFIRMADO':p.status==='REJECTED'?'RECHAZADO':'PENDIENTE'}</span>
                </div>
                ${p.status === 'PENDING' ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;"><button data-action="CONFIRM_PAYMENT" data-id="${p.id}" data-sid="${sid}" style="padding:12px;background:#1a1a2e;color:#F5C518;border:none;border-radius:14px;font-weight:900;font-size:0.7rem;cursor:pointer;">✓ CONFIRMAR</button><button data-action="REJECT_PAYMENT" data-id="${p.id}" style="padding:12px;background:#fff0f0;color:#e63946;border:none;border-radius:14px;font-weight:900;font-size:0.7rem;cursor:pointer;">✕ RECHAZAR</button></div>` : ''}
              </div>`.trim()}).join('')}
          </div>
        </div>`
    },
    SEND_RESIDENT_ACCESS: (btn) => {
      const phone = btn.dataset.phone;
      const plate = btn.dataset.plate;
      const state = getParkingState();
      
      if (!phone) {
        store.pendingAction = {
          type: 'CUSTOM_MODAL',
          title: '⚠️ SIN TELÉFONO',
          content: `<p style="color:#666; font-weight:700;">Este residente no tiene un número registrado para enviar el acceso.</p>`
        };
        refresh();
        return;
      }
      
      const firstPlate = plate.split(',')[0].trim();
      const url = `${window.location.origin}/?setup=${firstPlate}&bld=${state.buildingCode}`;
      const msg = `¡Bienvenido a Sloty! 🚗\n\nTu acceso para ${state.buildingName} está listo.\n\nPor favor, ingresa al siguiente enlace para crear tu PIN de acceso personal:\n\n${url}`;
      
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    TOGGLE_COMING: async (btn) => {
      const id = btn.dataset.id;
      // 🛡️ Data Minimization: select explicit columns
      const { data: sub } = await supabase.from('subscriptions').select('is_coming').eq('id', id).single();
      const newState = !sub?.is_coming;
      
      const { error } = await supabase.from('subscriptions').update({ is_coming: newState }).eq('id', id);
      if(!error) refresh();
    },
    DELETE_RESIDENT: async (btn) => {
      const id = btn.dataset.id;
      store.pendingAction = {
        type: 'CONFIRM_MODAL',
        title: '¿ELIMINAR RESIDENTE?',
        content: `<p style="color:#666; font-weight:700;">Esta acción revocará el acceso y eliminará el registro permanentemente.</p>`,
        confirmAction: async () => {
          const { error } = await supabase.from('subscriptions').delete().eq('id', id);
          if(!error) {
             await logAudit('DELETE_RESIDENT', { subscription_id: id });
             store.pendingAction = null;
             store.cachedSubs = null;
             refresh();
          } else {
             store.pendingAction = {
               type: 'CUSTOM_MODAL',
               title: '❌ ERROR',
               content: `<p style="color:#666; font-weight:700;">No se pudo eliminar el registro.</p>`
             };
             refresh();
          }
        }
      };
      refresh();
    },
    GEN_CREDENTIAL: async (btn) => {
      const id = btn.dataset.id;
      // 🛡️ Data Minimization: select explicit columns
      const { data: res } = await supabase.from('subscriptions')
        .select('id, resident_name, plate, slot_label, expiry_date')
        .eq('id', id).single();
      const state = getParkingState();
      
      store.pendingAction = {
        type: 'CUSTOM_MODAL',
        title: 'Credencial de Residente',
        content: `
          <div style="padding:20px; display:flex; flex-direction:column; align-items:center; gap:20px;">
             <div style="width:100%; max-width:320px; background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius:24px; padding:25px; color:white; position:relative; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">
                <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:var(--accent); border-radius:50%; opacity:0.05;"></div>
                
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:30px;">
                   <img src="/sloty-logo-v2.png" style="height:35px; filter:brightness(0) invert(1);">
                   <div style="background:var(--accent); color:var(--primary); font-size:0.5rem; font-weight:900; padding:4px 10px; border-radius:30px; text-transform:uppercase;">RESIDENTE</div>
                </div>

                <div style="margin-bottom:25px;">
                   <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Nombre del Propietario</div>
                   <div style="font-size:1.1rem; font-weight:900; letter-spacing:0.5px;">${escapeHTML(res.resident_name)}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:15px;">
                   <div>
                      <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Vehículo / Placa</div>
                      <div style="font-size:1.2rem; font-weight:900; color:var(--accent);">${escapeHTML(res.plate)}</div>
                   </div>
                   <div>
                      <div style="font-size:0.55rem; color:rgba(255,255,255,0.4); text-transform:uppercase; font-weight:800; letter-spacing:1px; margin-bottom:5px;">Puesto</div>
                      <div style="font-size:1.2rem; font-weight:900; color:white;">${escapeHTML(res.slot_label || '---')}</div>
                   </div>
                </div>

                <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                   <div>
                      <div style="font-size:0.45rem; color:rgba(255,255,255,0.3); text-transform:uppercase; font-weight:700;">Vencimiento</div>
                      <div style="font-size:0.7rem; font-weight:800; color:#22c55e;">${new Date(res.expiry_date).toLocaleDateString()}</div>
                   </div>
                   <div style="text-align:right;">
                      <div style="font-size:0.45rem; color:rgba(255,255,255,0.3); text-transform:uppercase; font-weight:700;">Edificio</div>
                      <div style="font-size:0.7rem; font-weight:800; color:white;">${escapeHTML(state.buildingName)}</div>
                   </div>
                </div>
             </div>

             <div style="text-align:center;">
                <button onclick="window.print()" style="background:#f4f4f4; border:none; padding:12px 25px; border-radius:15px; font-weight:900; font-size:0.75rem; color:var(--primary); cursor:pointer; display:flex; align-items:center; gap:8px;">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                   IMPRIMIR O DESCARGAR
                </button>
             </div>
          </div>
        `
      };
      refresh();
    },
    SHOW_ABONO_FORM: (btn) => {
      const { id, name, price } = btn.dataset;
      const l = document.getElementById('modal-layer');
      l.style.pointerEvents = 'auto';
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;">
          <div style="background:white; border-radius:35px; width:100%; max-width:400px; padding:35px 25px; box-shadow:0 25px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center;">REGISTRAR ABONO</h2>
            <div style="font-size:0.8rem; font-weight:700; color:#555555; text-align:center; margin-bottom:25px;">${escapeHTML(name)}</div>
            
            <div style="margin-bottom:20px;">
              <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Monto del Abono ($)</label>
              <input id="abono-amount" type="number" step="0.01" value="${price}" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:18px; padding:20px; font-size:1.5rem; font-weight:900; outline:none; font-family:var(--font); text-align:center;">
              <div id="abono-preview" style="font-size:0.6rem; font-weight:800; color:#22c55e; margin-top:8px; text-align:center;">Extenderá: 30 días aprox.</div>
              <div id="abono-ves-calc" style="font-size:0.75rem; font-weight:800; color:#18181b; margin-top:8px; text-align:center; padding:10px; background:#f4f4f5; border-radius:14px; display:none; border:1px solid #e4e4e7;"></div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
              <div>
                <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Fecha de Pago</label>
                <input id="abono-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:15px; padding:12px; font-family:var(--font); font-weight:700; outline:none; background:#fafafa;">
              </div>
              <div>
                <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Método</label>
                <select id="abono-method" style="width:100%; padding:12px; border-radius:15px; border:2.5px solid #f0f0f0; font-family:var(--font); font-weight:800; outline:none; appearance:none; background:#fafafa;">
                  <option value="EFECTIVO_USD">💵 EFECTIVO $</option>
                  <option value="EFECTIVO_BS">💵 EFECTIVO BS</option>
                  <option value="PAGO_MOVIL">📱 PAGO MÓVIL</option>
                  <option value="TRANSFERENCIA">🏦 TRANSFERENCIA</option>
                  <option value="ZELLE">🌀 ZELLE</option>
                </select>
              </div>
            </div>

            <div id="abono-bank-container" style="margin-bottom:20px; display:none;">
              <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Banco Emisor</label>
              <select id="abono-bank" style="width:100%; padding:15px; border-radius:15px; border:2.5px solid #f0f0f0; font-family:var(--font); font-weight:800; outline:none; appearance:none; background:#fafafa;">
                <option value="">Seleccionar Banco...</option>
                <option value="BANESCO">Banesco</option>
                <option value="BDV">Banco de Venezuela</option>
                <option value="MERCANTIL">Mercantil</option>
                <option value="PROVINCIAL">Provincial</option>
                <option value="BNC">BNC</option>
                <option value="BANCAMIGA">Bancamiga</option>
                <option value="BANPLUS">Banplus</option>
                <option value="OTRO">Otro / Internacional</option>
              </select>
            </div>

            <div id="abono-ref-container" style="margin-bottom:25px; display:none;">
              <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Referencia</label>
              <input id="abono-ref" type="text" placeholder="Ej: 4522" style="width:100%; box-sizing:border-box; border:2.5px solid #f0f0f0; border-radius:18px; padding:18px; font-size:1.1rem; font-weight:900; outline:none; font-family:var(--font);">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
               <button data-action="SUBMIT_ABONO" data-id="${id}" data-price="${price}" style="padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">PROCESAR</button>
               <button data-action="CANCEL_MODAL" style="padding:20px; background:#f4f4f4; color:#555555; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">CANCELAR</button>
            </div>
          </div>
        </div>
      `;
      
      const amountInput = l.querySelector('#abono-amount');
      const preview = l.querySelector('#abono-preview');
      const vesCalc = l.querySelector('#abono-ves-calc');
      const methodSelect = l.querySelector('#abono-method');
      const refContainer = l.querySelector('#abono-ref-container');
      const bankContainer = l.querySelector('#abono-bank-container');

      const updateAbonoVesCalc = () => {
        const val = parseFloat(amountInput.value) || 0;
        const days = Math.round((val / price) * 30);
        preview.textContent = `Extenderá: ${days} días aprox.`;
        
        const rateVal = store.currentBcv?.rate || 40;
        const vesVal = val * rateVal;
        vesCalc.innerHTML = `Equivale a: <strong style="color:#111827;">Bs. ${vesVal.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong><br><span style="font-size:0.6rem; color:#6b7280; font-weight:700;">Tasa BCV: Bs. ${rateVal.toFixed(2)}</span>`;
        vesCalc.style.display = 'block';
      };

      amountInput.oninput = updateAbonoVesCalc;
      methodSelect.onchange = () => {
        const isDigital = ['PAGO_MOVIL', 'TRANSFERENCIA'].includes(methodSelect.value);
        refContainer.style.display = isDigital ? 'block' : 'none';
        bankContainer.style.display = isDigital ? 'block' : 'none';
        updateAbonoVesCalc();
      };
      
      updateAbonoVesCalc();
    },
    SUBMIT_ABONO: async (btn) => {
      const id = btn.dataset.id;
      const price = parseFloat(btn.dataset.price) || 1;
      const amount = parseFloat(document.getElementById('abono-amount').value) || 0;
      const method = document.getElementById('abono-method').value;
      const ref = document.getElementById('abono-ref')?.value || '';
      const bank = document.getElementById('abono-bank')?.value || '';
      const date = document.getElementById('abono-date')?.value || new Date().toISOString().split('T')[0];
      
      if (amount <= 0) return showToast('Monto inválido', 'error');
      
      btn.textContent = 'PROCESANDO...';
      btn.disabled = true;

      // 🛡️ Data Minimization: select explicit columns
      const { data: res } = await supabase.from('subscriptions').select('expiry_date, plate').eq('id', id).single();
      const currentExp = new Date(res.expiry_date);
      const startBase = new Date(Math.max(Date.now(), currentExp.getTime()));
      const daysToAdd = Math.round((amount / price) * 30);
      startBase.setDate(startBase.getDate() + daysToAdd);

      const state = getParkingState();
      
      const rateVal = Number(store.currentBcv?.rate || 40.0)
      const amountUsd = Number(amount.toFixed(2))
      const amountBs = Number((amountUsd * rateVal).toFixed(2))

      const paymentPayload = {
        building_id: state.buildingId,
        subscription_id: id,
        amount: amount,
        amount_usd: amountUsd,
        amount_bs: amountBs,
        bcv_rate_used: rateVal,
        method: method,
        reference: ref,
        status: 'CONFIRMED',
        payment_date: date,
        bank: bank
      };

      try {
        await supabase.from('payments').insert(paymentPayload);
        await supabase.from('subscriptions').update({
          expiry_date: startBase.toISOString()
        }).eq('id', id);
      } catch (err) {
        console.warn('[Sloty] Error inserting payment or updating subscription online, enqueuing sync:', err);
        enqueueSync({ table: 'payments', action: 'INSERT', data: paymentPayload });
        enqueueSync({ table: 'subscriptions', action: 'UPSERT', data: { id, expiry_date: startBase.toISOString() } });
      }

      logMovement({
        type: 'MENSUALIDAD',
        plate: res.plate.split(',')[0].trim(),
        slot: 'ABONO',
        category: 'RESIDENTE',
        guardName: 'Administrador',
        payMethod: method,
        amount: amount,
        reference: ref,
        paymentStatus: 'PAGADO',
        metadata: { bank: bank, date: date }
      });

      logAudit(`Registró abono de $${amount} para residente ID ${id}`);
      store.pendingAction = null;
      store.cachedMetrics = null;
      refresh();
    }
  });
}
