/**
 * Admin Settings — Building config, tariffs, custom fields and incident reports (SETTINGS & REPORTS tabs)
 * Extracted from admin.js (Phase C Lot 3 refactor)
 */
import { supabase, getParkingState, saveParkingState, logAudit, showToast, getCleanPrefix, getExchangeRate } from '../../db.js'
import { escapeHTML } from '../../utils/sanitize.js'
import { ICONS } from './admin-ui-components.js'
import { store } from './admin-store.js'

// ─── SETTINGS TAB RENDERER (SETTINGS) ────────────────────────
export const renderSettings = (state) => {
  const activeMenu = store.activeSettingsMenu;
  const set = state.settings || { rentalCap: 0, customFields: [], categories: [], tariffs: [] };

  let subSectionHtml = '';
  if (activeMenu === 'MAIN') {
    subSectionHtml = `
      <div style="display:grid; gap:12px; margin-top:20px;">
        <button data-action="SUBMENU" data-menu="TARIFFS" style="padding:22px; background:white; color:var(--primary); border:1.5px solid #eee; border-radius:24px; font-weight:900; font-size:0.85rem; cursor:pointer; text-align:left; display:flex; justify-content:space-between; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.01);">
           <span>💰 CONFIGURAR TARIFAS Y PRECIOS</span>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; color:#bbb;"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button data-action="SUBMENU" data-menu="VISITORS" style="padding:22px; background:white; color:var(--primary); border:1.5px solid #eee; border-radius:24px; font-weight:900; font-size:0.85rem; cursor:pointer; text-align:left; display:flex; justify-content:space-between; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.01);">
           <span>📋 CAMPOS DE REGISTRO (Visitantes)</span>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; color:#bbb;"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button data-action="SUBMENU" data-menu="AUDIT" style="padding:22px; background:white; color:var(--primary); border:1.5px solid #eee; border-radius:24px; font-weight:900; font-size:0.85rem; cursor:pointer; text-align:left; display:flex; justify-content:space-between; align-items:center; box-shadow:0 5px 15px rgba(0,0,0,0.01);">
           <span>🗂️ CATEGORÍAS DE VEHÍCULOS</span>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; color:#bbb;"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;
  } else if (activeMenu === 'TARIFFS') {
    const defaultTariff = set.tariffs?.find(t => t.id === 'default') || { label: 'Minuto base', rate: 0, min: 0 };
    const extraTariffs = set.tariffs?.filter(t => t.id !== 'default') || [];

    subSectionHtml = `
      <div style="margin-top:20px; background:white; padding:25px; border-radius:32px; border:1.5px solid #f0f0f0;">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
           <button data-action="SUBMENU" data-menu="MAIN" style="background:#1a1a2e; color:#F5C518; border:none; border-radius:50px; padding:6px 12px; font-size:0.6rem; font-weight:900; cursor:pointer;">← VOLVER</button>
           <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase;">CONFIGURACIÓN TARIFAS</div>
         </div>

         <!-- CAPACIDAD DE RENTA -->
         <div style="margin-bottom:25px; padding-bottom:20px; border-bottom:1px solid #f8f8f8;">
            <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Tarifa Plana del Edificio (Mensualidad $)</label>
            <div style="display:flex; gap:10px;">
               <input type="number" id="sub-rate" value="${state.buildingPlan?.monthly_rate || 0}" style="flex:1; padding:15px; border-radius:12px; border:1.5px solid #eee; background:#fafafa; font-weight:900; outline:none; font-family:var(--font);">
               <button data-action="SAVE_SUB_SETTINGS" style="background:#1a1a2e; color:var(--accent); border:none; border-radius:12px; padding:0 20px; font-weight:900; font-size:0.75rem; cursor:pointer;">GUARDAR</button>
            </div>
         </div>

         <div style="margin-bottom:25px; padding-bottom:20px; border-bottom:1px solid #f8f8f8;">
            <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Límite de Puestos Asignados (Mensuales)</label>
            <div style="display:flex; gap:10px;">
               <input type="number" id="sub-limit" value="${state.buildingPlan?.monthly_slots_limit || 0}" style="flex:1; padding:15px; border-radius:12px; border:1.5px solid #eee; background:#fafafa; font-weight:900; outline:none; font-family:var(--font);">
               <button data-action="SAVE_SUB_SETTINGS" style="background:#1a1a2e; color:var(--accent); border:none; border-radius:12px; padding:0 20px; font-weight:900; font-size:0.75rem; cursor:pointer;">GUARDAR</button>
            </div>
         </div>

         <!-- CAPACIDAD DE RENTA POR HORA -->
         <div style="margin-bottom:25px; padding-bottom:20px; border-bottom:1px solid #f8f8f8;">
            <label style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:8px; display:block; text-transform:uppercase;">Monto Máximo Diario Garita ($)</label>
            <div style="display:flex; gap:10px;">
               <input type="number" id="settings-rental-cap" value="${set.rentalCap || 0}" style="flex:1; padding:15px; border-radius:12px; border:1.5px solid #eee; background:#fafafa; font-weight:900; outline:none; font-family:var(--font);">
               <button data-action="SAVE_RENTAL_CAP" style="background:#1a1a2e; color:var(--accent); border:none; border-radius:12px; padding:0 20px; font-weight:900; font-size:0.75rem; cursor:pointer;">GUARDAR</button>
            </div>
         </div>

         <!-- TARIFA BASE -->
         <div style="margin-bottom:25px;">
            <div style="font-weight:900; color:var(--primary); font-size:0.85rem; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
               <span>TARIFA POR MINUTO (BASE)</span>
               <div style="display:flex; gap:6px;">
                  <button data-action="TOGGLE_TARIFF" data-id="default" style="background:${defaultTariff.rate > 0 ? '#fee2e2':'#d1fae5'}; color:${defaultTariff.rate > 0 ? '#ef4444':'#10b981'}; border:none; border-radius:30px; padding:4px 12px; font-size:0.55rem; font-weight:900; cursor:pointer;">
                     ${defaultTariff.rate > 0 ? 'DESACTIVAR TARIFA':'EXENTAR PAGO'}
                  </button>
               </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; display:${defaultTariff.rate === 0 ? 'none':'grid'};">
               <div>
                  <label style="font-size:0.5rem; color:#999; display:block; margin-bottom:4px; font-weight:800;">VALOR MINUTO ($)</label>
                  <input type="number" step="0.0001" class="default-tariff-rate" value="${defaultTariff.rate}" style="width:100%; box-sizing:border-box; padding:15px; border-radius:12px; border:1.5px solid #eee; background:#fafafa; font-weight:900; outline:none; font-family:var(--font);">
               </div>
               <div>
                  <label style="font-size:0.5rem; color:#999; display:block; margin-bottom:4px; font-weight:800;">TIEMPO DE GRACIA (Min)</label>
                  <input type="number" class="default-tariff-min" value="${defaultTariff.min}" style="width:100%; box-sizing:border-box; padding:15px; border-radius:12px; border:1.5px solid #eee; background:#fafafa; font-weight:900; outline:none; font-family:var(--font);">
               </div>
            </div>
            ${defaultTariff.rate === 0 ? '<div style="background:#fafafa; padding:15px; border-radius:16px; border:1px solid #eee; font-size:0.7rem; font-weight:700; color:#10b981; text-align:center;">✓ TIEMPO DE COBRO EXENTO (Gratuito)</div>' : ''}
         </div>

         <!-- TARIFAS ADICIONALES -->
         <div style="margin-bottom:25px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
               <div style="font-weight:900; color:var(--primary); font-size:0.85rem;">TARIFAS ADICIONALES (Segmentadas)</div>
               <button data-action="ADD_TARIFF" style="background:#f4f4f4; border:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">${ICONS.PLUS}</button>
            </div>
            <div id="settings-tariffs-list" style="display:grid; gap:10px;">
               ${extraTariffs.map((t, idx) => `
                  <div style="background:#fafafa; padding:18px; border-radius:20px; border:1px solid #eee; display:flex; flex-direction:column; gap:10px; position:relative;">
                     <button data-action="DELETE_TARIFF" data-idx="${idx}" style="position:absolute; top:-5px; right:-5px; background:#fff0f0; color:#e63946; border:none; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900;">✕</button>
                     <input type="text" class="extra-tariff-label" placeholder="Nombre (Ej: Visitante Flat)" value="${escapeHTML(t.label)}" style="padding:10px 15px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:800; outline:none;">
                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                           <label style="font-size:0.45rem; color:#999; font-weight:800;">VALOR TARIFA ($)</label>
                           <input type="number" step="0.01" class="extra-tariff-rate" value="${t.rate}" style="width:100%; box-sizing:border-box; padding:12px; border-radius:10px; border:1px solid #eee; font-weight:900; outline:none;">
                        </div>
                        <div>
                           <label style="font-size:0.45rem; color:#999; font-weight:800;">TIPO</label>
                           <select class="extra-tariff-type" style="width:100%; box-sizing:border-box; padding:12px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:900; outline:none; background:white;">
                             <option value="MINUTE" ${t.type==='MINUTE'?'selected':''}>Por Minuto</option>
                             <option value="FLAT" ${t.type==='FLAT'?'selected':''}>Tarifa Única (Flat)</option>
                           </select>
                        </div>
                     </div>
                  </div>
               `).join('')}
               ${!extraTariffs.length ? '<div style="font-size:0.65rem; color:#999; font-weight:700; text-align:center; padding:15px; border:1px dashed #ddd; border-radius:16px;">Sin tarifas adicionales</div>' : ''}
            </div>
         </div>

         <button data-action="SAVE_TARIFFS" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 20px rgba(26,26,46,0.15); margin-top:10px;">GUARDAR CAMBIOS CONTABLES</button>
      </div>
    `;
  } else if (activeMenu === 'VISITORS') {
    subSectionHtml = `
      <div style="margin-top:20px; background:white; padding:25px; border-radius:32px; border:1.5px solid #f0f0f0;">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
           <button data-action="SUBMENU" data-menu="MAIN" style="background:#1a1a2e; color:#F5C518; border:none; border-radius:50px; padding:6px 12px; font-size:0.6rem; font-weight:900; cursor:pointer;">← VOLVER</button>
           <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase;">CAMPOS DE VISITANTES</div>
         </div>

         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #f8f8f8;">
            <div style="font-weight:900; color:var(--primary); font-size:0.85rem;">CAMPOS ADICIONALES REGISTRO</div>
            <button data-action="ADD_CUSTOM_FIELD" style="background:#f4f4f4; border:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">${ICONS.PLUS}</button>
         </div>

         <div id="settings-fields-list" style="display:grid; gap:10px;">
            ${(set.customFields || []).map((f, idx) => `
               <div style="background:#fafafa; padding:15px 20px; border-radius:18px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center; position:relative;">
                  <div style="flex:1; display:flex; gap:10px; align-items:center;">
                     <input type="text" class="custom-field-label" placeholder="Nombre Campo (Ej: Cédula)" value="${escapeHTML(f.label)}" style="flex:2; padding:10px 15px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:800; outline:none;">
                     <select class="custom-field-type" style="flex:1; padding:10px 15px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:900; outline:none; background:white;">
                       <option value="text" ${f.type==='text'?'selected':''}>Texto</option>
                       <option value="number" ${f.type==='number'?'selected':''}>Número</option>
                     </select>
                  </div>
                  <button data-action="DELETE_CUSTOM_FIELD" data-idx="${idx}" style="background:#fff0f0; color:#e63946; border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900; margin-left:10px;">✕</button>
               </div>
            `).join('')}
            ${!(set.customFields || []).length ? '<div style="font-size:0.65rem; color:#999; font-weight:700; text-align:center; padding:15px; border:1px dashed #ddd; border-radius:16px;">Sin campos configurados</div>' : ''}
         </div>

         <button data-action="SAVE_SETTINGS" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 20px rgba(26,26,46,0.15); margin-top:25px;">GUARDAR CAMPOS DE REGISTRO</button>
      </div>
    `;
  } else if (activeMenu === 'AUDIT') {
    subSectionHtml = `
      <div style="margin-top:20px; background:white; padding:25px; border-radius:32px; border:1.5px solid #f0f0f0;">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
           <button data-action="SUBMENU" data-menu="MAIN" style="background:#1a1a2e; color:#F5C518; border:none; border-radius:50px; padding:6px 12px; font-size:0.6rem; font-weight:900; cursor:pointer;">← VOLVER</button>
           <div style="font-size:0.65rem; font-weight:900; color:#999; text-transform:uppercase;">CATEGORÍAS DE VEHÍCULOS</div>
         </div>

         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #f8f8f8;">
            <div style="font-weight:900; color:var(--primary); font-size:0.85rem;">CATEGORÍAS PERMITIDAS</div>
            <button data-action="ADD_CATEGORY" style="background:#f4f4f4; border:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">${ICONS.PLUS}</button>
         </div>

         <div id="settings-categories-list" style="display:grid; gap:10px;">
            ${(set.categories || []).map((c, idx) => `
               <div style="background:#fafafa; padding:18px; border-radius:20px; border:1px solid #eee; display:flex; flex-direction:column; gap:10px; position:relative;">
                  <button data-action="DELETE_CATEGORY" data-idx="${idx}" style="position:absolute; top:-5px; right:-5px; background:#fff0f0; color:#e63946; border:none; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:900;">✕</button>
                  <div style="display:flex; gap:10px; align-items:center;">
                     <input type="text" class="category-label-name" placeholder="Nombre (Ej: Motos)" value="${escapeHTML(c.id)}" style="flex:2; padding:10px 15px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:800; outline:none; text-transform:uppercase;" ${c.id==='visitante'||c.id==='residente'?'disabled':''}>
                     <input type="text" class="category-label-tag" placeholder="Etiqueta (Ej: M)" value="${escapeHTML(c.tag)}" maxlength="2" style="flex:1; padding:10px 15px; border-radius:10px; border:1px solid #eee; font-family:var(--font); font-weight:900; text-align:center; outline:none; text-transform:uppercase;">
                  </div>
                  <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; margin-top:5px;">
                     <div style="font-size:0.6rem; color:#bbb; font-weight:800; text-transform:uppercase;">Color Identificador</div>
                     <div style="display:flex; gap:4px; padding:6px; background:#f4f4f4; border-radius:12px; border:1px solid #eee;">
                        ${['#F5C518','#e63946','#22c55e','#3b82f6','#a855f7'].map(color => `
                          <div class="category-color-selector" data-color="${color}" style="width:16px; height:16px; border-radius:50%; background:${color}; cursor:pointer; border:${c.color===color?'2.5px solid white':'none'}; box-shadow:0 2px 5px rgba(0,0,0,0.1);" onclick="this.parentElement.querySelectorAll('.category-color-selector').forEach(s => s.style.border='none'); this.style.border='2.5px solid white'; this.parentElement.dataset.color='${color}';"></div>
                        `).join('')}
                     </div>
                  </div>
               </div>
            `).join('')}
         </div>

         <button data-action="SAVE_SETTINGS" style="width:100%; padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.85rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 10px 20px rgba(26,26,46,0.15); margin-top:25px;">GUARDAR CATEGORÍAS DE VEHÍCULOS</button>
      </div>
    `;
  }

  return `
    <div style="padding:20px; padding-bottom:120px; background:#f8f9fa;">
      <h2 style="font-weight:900; color:var(--primary); font-size:1.4rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">CONFIGURACIÓN DEL EDIFICIO</h2>
      
      <!-- PERFIL DEL EDIFICIO -->
      <div style="background:#1a1a2e; padding:25px; border-radius:32px; color:white; box-shadow:0 15px 35px rgba(26,26,46,0.15); position:relative; overflow:hidden;">
        <div style="position:absolute; right:-20px; top:-20px; width:120px; height:120px; background:rgba(255,255,255,0.03); border-radius:50%;"></div>
        <div style="font-size:0.7rem; font-weight:800; color:var(--accent); text-transform:uppercase; margin-bottom:15px;">PERFIL ADMINISTRATIVO</div>
        <div style="display:grid; gap:12px;">
          <input type="text" id="settings-bld-name" value="${escapeHTML(state.buildingName)}" placeholder="Nombre Edificio" style="padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;">
          <input type="text" id="settings-bld-code" value="${escapeHTML(state.buildingCode)}" placeholder="Código Acceso" style="padding:15px; border-radius:12px; border:none; background:rgba(255,255,255,0.1); color:white; font-weight:700;" disabled>
          <button data-action="SAVE_PROFILE" style="padding:18px; background:#1a1a2e; color:var(--accent); border:none; border-radius:14px; font-weight:900; font-size:0.8rem; cursor:pointer; margin-top:5px; text-transform:uppercase;">ACTUALIZAR PERFIL</button>
        </div>
      </div>

      ${subSectionHtml}
    </div>`
}

// ─── REPORTS TAB RENDERER (REPORTS) ──────────────────────────
export const renderReports = async (state) => {
  // 🛡️ Data Minimization: select explicit columns
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, type, description, resolved, created_at, guard_name, plate, admin_response, responded_at')
    .eq('building_id', state.buildingId)
    .order('created_at', { ascending: false })
    .limit(100);

  const incidentsList = incidents || [];
  const now = new Date()
  const reportFilter = store.reportFilter;
  const movs = (state.movements || []).filter(m => {
    const d = new Date(m.timestamp)
    if (reportFilter === 'HOY') return d >= new Date().setHours(0,0,0,0)
    if (reportFilter === 'SEMANA') return (now - d) / 86400000 <= 7
    if (reportFilter === 'MES') return (now - d) / 86400000 <= 30
    return true
  })

  const totalRev = movs.reduce((a, m) => a + (m.amount || 0), 0)

  return `
    <div style="padding:20px; padding-bottom:100px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
        <h3 style="font-weight:900; margin:0;">HISTORIAL Y REPORTES</h3>
        <div style="display:flex; gap:8px;">
          <button data-action="DOWNLOAD_REPORT" data-type="CSV" style="background:#f4f4f4; color:#666; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.6rem; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.05); flex-shrink:0;">↓ CSV</button>
          <button data-action="DOWNLOAD_REPORT" data-type="PDF" style="background:#1a1a2e; color:#F5C518; border:none; padding:8px 12px; border-radius:10px; font-weight:900; font-size:0.65rem; cursor:pointer; box-shadow:0 4px 10px rgba(26,26,46,0.2); flex-shrink:0; text-align:center;">↓ REPORTE PDF</button>
        </div>
      </div>

      <!-- BUSCADOR TRAZABILIDAD -->
      <div style="background:#fafafa; border:1px solid #eee; padding:20px; border-radius:24px; margin-bottom:20px; box-sizing:border-box; width:100%; overflow:hidden;">
         <div style="color:#1a1a2e; font-weight:900; font-size:0.75rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">🔎 TRAZABILIDAD DE VEHÍCULOS</div>
         <div style="display:flex; gap:10px; flex-wrap:wrap;">
             <input type="text" id="trace-plate-input" placeholder="Buscar por placa..." style="flex:1; min-width:140px; box-sizing:border-box; padding:14px; border-radius:14px; border:1.5px solid #eee; font-weight:900; text-transform:uppercase; outline:none; font-family:var(--font); background:white;">
             <button data-action="SEARCH_PLATE" style="background:#22c55e; color:white; border:none; padding:14px 20px; border-radius:14px; font-weight:900; cursor:pointer; flex-shrink:0;">BUSCAR</button>
         </div>
         <div id="trace-results-container" style="margin-top:15px; display:none;"></div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
         <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid #f0f0f0;">
            <div style="font-size:0.6rem; font-weight:700; color:#999;">INGRESOS EN FILTRO</div>
            <div style="font-size:1.4rem; font-weight:900;">${movs.length}</div>
         </div>
         <div style="background:white; padding:15px; border-radius:20px; border:1.5px solid #f0f0f0;">
            <div style="font-size:0.6rem; font-weight:700; color:#999;">RECOLECTADO</div>
            <div style="font-size:1.4rem; font-weight:900; color:#22c55e;">$${totalRev.toFixed(0)}</div>
         </div>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; padding-bottom:4px;">
        ${['HOY','SEMANA','MES','TODO'].map(f => `
          <button data-action="FILTER_REPORTS" data-filter="${f}" 
            style="padding:10px 18px; border-radius:12px; border:none; font-weight:700; font-size:0.75rem; 
            background:${reportFilter === f ? '#1a1a2e' : '#f0f0f0'}; 
            color:${reportFilter === f ? '#F5C518' : '#999'}; cursor:pointer; white-space:nowrap;">
            ${f === 'HOY' ? 'Hoy' : f === 'SEMANA' ? '7 días' : f === 'MES' ? '30 días' : 'Todo'}
          </button>
        `).join('')}
      </div>

      <div style="display:grid; gap:12px;">
        ${movs.length ? movs.map(m => `
          <div style="background:white; padding:18px; border-radius:24px; border:1px solid #f0f0f0; box-shadow:0 10px 30px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
              <div>
                <div style="font-size:1rem; font-weight:900; color:#1a1a2e;">${escapeHTML(m.plate) || '---'}</div>
                <div style="font-size:0.7rem; font-weight:700; color:#999; margin-top:2px;">${new Date(m.timestamp).toLocaleString()}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900; color:${(m.type==='ENTRY'||m.type==='INGRESO')?'#22c55e':'#3b82f6'}; font-size:0.6rem; letter-spacing:1px;">${m.type}</div>
                <div style="font-size:0.8rem; font-weight:900; color:#1a1a2e; margin-top:2px;">${escapeHTML(m.slot) || '--'}</div>
              </div>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
              <span style="background:#f4f4f4; padding:4px 10px; border-radius:6px; font-size:0.6rem; font-weight:700; color:#666;">${escapeHTML(m.category)}</span>
              ${Object.entries(m.metadata || {}).map(([k,v]) => `
                <span style="background:rgba(245,197,24,0.1); color:#D97706; padding:4px 10px; border-radius:6px; font-size:0.6rem; font-weight:700;">${escapeHTML(k.toUpperCase())}: ${escapeHTML(v)}</span>
              `).join('')}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px dashed #eee;">
              <div style="font-size:0.65rem; font-weight:700; color:#999;">Guardia: <span style="color:#666;">${escapeHTML(m.guardName) || 'Admin'}</span></div>
              <div style="font-size:0.65rem; font-weight:900; color:#1a1a2e;">${m.payMethod ? `PAGO: ${escapeHTML(m.payMethod.replace('_', ' '))}` : '---'}</div>
            </div>
          </div>
        `).join('') : '<div style="text-align:center; padding:40px; color:#bbb; font-weight:700;">No hay movimientos en este periodo</div>'}
      </div>

      <!-- INCIDENTES -->
      <div style="margin-top:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-size:0.7rem; font-weight:900; color:#999;
                      letter-spacing:2px; text-transform:uppercase;">
            Incidentes Reportados
          </div>
          <span style="background:#FCEBEB; color:#A32D2D; font-size:0.65rem;
                       font-weight:900; padding:3px 10px; border-radius:50px;">
            ${incidentsList.filter(i => !i.resolved).length} sin resolver
          </span>
        </div>

        ${incidentsList.length === 0 ? `
          <div style="text-align:center; color:#999; font-size:0.75rem;
                      padding:24px; background:#f8f9fa; border-radius:16px;">
            Sin incidentes registrados
          </div>
        ` : incidentsList.map(inc => `
          <div style="background:white; border-radius:16px; padding:16px;
                      margin-bottom:10px; border:1.5px solid ${inc.resolved ? '#eee' : '#FCEBEB'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div style="display:flex; gap:8px; align-items:center;">
                <span style="background:${inc.resolved ? '#EAF3DE' : '#FCEBEB'};
                             color:${inc.resolved ? '#3B6D11' : '#A32D2D'};
                             font-size:0.65rem; font-weight:900;
                             padding:3px 10px; border-radius:50px;">
                  ${escapeHTML(inc.type)}
                </span>
                ${!inc.resolved ? `
                  <button data-action="RESOLVE_INCIDENT_FORM" data-id="${inc.id}" data-guard="${escapeHTML(inc.guard_name)}"
                    style="background:#EAF3DE; color:#3B6D11; border:none;
                           border-radius:50px; padding:3px 10px; font-size:0.65rem;
                           font-weight:900; cursor:pointer;">
                    ✎ RESPONDER
                  </button>` : `
                  <span style="font-size:0.65rem; color:#999; font-weight:700;">✓ Resuelto</span>`}
              </div>
              <div style="font-size:0.65rem; color:#999; font-weight:700;">
                ${new Date(inc.created_at).toLocaleString('es-VE', { dateStyle:'short', timeStyle:'short' })}
              </div>
            </div>
            <div style="font-size:0.8rem; font-weight:700; color:#1a1a2e; margin-bottom:4px;">
              ${escapeHTML(inc.description)}
            </div>
            ${inc.admin_response ? `
              <div style="background:#f8f9fa; border-left:3px solid #22c55e; padding:10px; margin-top:10px; border-radius:8px;">
                <div style="font-size:0.6rem; font-weight:900; color:#22c55e; margin-bottom:4px;">TU RESPUESTA</div>
                <div style="font-size:0.8rem; font-weight:700; color:#666;">${escapeHTML(inc.admin_response)}</div>
                <div style="font-size:0.5rem; color:#bbb; font-weight:700; margin-top:4px;">Enviado: ${new Date(inc.responded_at || inc.created_at).toLocaleString('es-VE')}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>`
}

// ─── DOM HOOKS ──────────────────────────────────────────────
export const setupSettingsHooks = (container) => {
  // Any specific setting hooks
}

// ─── ACTIONS INITIALIZER ─────────────────────────────────────
export const initSettingsActions = (actions, container, refresh) => {
  Object.assign(actions, {
    SUBMENU: (btn) => {
      store.activeSettingsMenu = btn.dataset.menu
      refresh()
    },
    TOGGLE_TARIFF: (btn) => {
      const state = getParkingState()
      const t = state.settings.tariffs.find(x => x.id === btn.dataset.id)
      if (t) t.rate = t.rate > 0 ? 0 : 0.005 // default minuto exento vs base
      saveParkingState(state)
      refresh()
    },
    ADD_TARIFF: () => {
      const state = getParkingState()
      state.settings.tariffs = state.settings.tariffs || []
      state.settings.tariffs.push({ label: '', rate: 0, type: 'MINUTE' })
      saveParkingState(state)
      refresh()
    },
    DELETE_TARIFF: (btn) => {
      const idx = parseInt(btn.dataset.idx)
      const state = getParkingState()
      
      // Calculate indices excluding default
      const defaultTariff = state.settings.tariffs.find(t => t.id === 'default')
      const extraTariffs = state.settings.tariffs.filter(t => t.id !== 'default')
      extraTariffs.splice(idx, 1)
      
      state.settings.tariffs = defaultTariff ? [defaultTariff, ...extraTariffs] : extraTariffs
      saveParkingState(state)
      refresh()
    },
    SAVE_TARIFFS: () => {
      const state = getParkingState()
      
      // Save default
      const defaultTariff = state.settings.tariffs.find(t => t.id === 'default')
      if (defaultTariff) {
        const defaultRate = parseFloat(container.querySelector('.default-tariff-rate')?.value)
        const defaultMin = parseInt(container.querySelector('.default-tariff-min')?.value)
        if (!isNaN(defaultRate)) defaultTariff.rate = defaultRate
        if (!isNaN(defaultMin)) defaultTariff.min = defaultMin
      }
      
      // Save extras
      const extraTariffs = state.settings.tariffs.filter(t => t.id !== 'default')
      const labels = container.querySelectorAll('.extra-tariff-label')
      const rates = container.querySelectorAll('.extra-tariff-rate')
      const types = container.querySelectorAll('.extra-tariff-type')
      
      extraTariffs.forEach((t, i) => {
        t.label = labels[i]?.value.trim()
        t.rate = parseFloat(rates[i]?.value) || 0
        t.type = types[i]?.value
      })
      
      saveParkingState(state)
      logAudit('Actualizó tarifas de cobro')
      showToast('Tarifas actualizadas', 'success')
      refresh()
    },
    SAVE_RENTAL_CAP: () => {
      const val = parseFloat(document.getElementById('settings-rental-cap').value) || 0
      const state = getParkingState()
      state.settings.rentalCap = val
      saveParkingState(state)
      logAudit(`Actualizó tope de renta garita a $${val}`)
      showToast('Tope actualizado', 'success')
      refresh()
    },
    SAVE_PROFILE: async () => {
      const name = document.getElementById('settings-bld-name').value.trim()
      if (!name) return showToast('Nombre inválido', 'error')
      
      const state = getParkingState()
      state.buildingName = name
      saveParkingState(state)
      
      // Push to Supabase building details
      const { error } = await supabase.from('buildings').update({ name }).eq('id', state.buildingId)
      if (!error) {
        logAudit(`Actualizó nombre del edificio a ${name}`)
        showToast('Perfil actualizado correctamente', 'success')
        refresh()
      } else {
        showToast('Error al guardar en la nube', 'error')
      }
    },
    FILTER_REPORTS: (btn) => {
      store.reportFilter = btn.dataset.filter
      refresh()
    },
    SAVE_SETTINGS: () => {
      const state = getParkingState()
      
      // Read custom fields
      const labels = container.querySelectorAll('.custom-field-label')
      const types = container.querySelectorAll('.custom-field-type')
      
      state.settings.customFields = (state.settings.customFields || []).map((f, i) => {
        return { ...f, label: labels[i]?.value.trim(), type: types[i]?.value }
      })
      
      // Read categories
      const catNames = container.querySelectorAll('.category-label-name')
      const catTags = container.querySelectorAll('.category-label-tag')
      const colorPickers = container.querySelectorAll('.category-color-selector')
      
      state.settings.categories = (state.settings.categories || []).map((c, i) => {
        // Read color from data-color of selected child
        const parent = catNames[i]?.closest('div')?.nextElementSibling?.querySelector('[data-color]');
        const chosenColor = parent?.parentElement?.dataset.color || c.color;
        
        return {
          ...c,
          id: catNames[i]?.value.trim().toLowerCase() || c.id,
          tag: catTags[i]?.value.trim().toUpperCase() || c.tag,
          color: chosenColor
        }
      })
      
      saveParkingState(state)
      logAudit('Actualizó parámetros generales del sistema')
      showToast('Ajustes guardados', 'success')
      refresh()
    },
    ADD_CUSTOM_FIELD: () => {
      const state = getParkingState()
      state.settings.customFields = state.settings.customFields || []
      state.settings.customFields.push({ id: `field_${Date.now()}`, label: '', type: 'text' })
      saveParkingState(state)
      refresh()
    },
    DELETE_CUSTOM_FIELD: (btn) => {
      const idx = parseInt(btn.dataset.idx)
      const state = getParkingState()
      state.settings.customFields.splice(idx, 1)
      saveParkingState(state)
      refresh()
    },
    ADD_CATEGORY: () => {
      const state = getParkingState()
      state.settings.categories = state.settings.categories || []
      state.settings.categories.push({ id: '', tag: '', color: '#F5C518' })
      saveParkingState(state)
      refresh()
    },
    DELETE_CATEGORY: (btn) => {
      const idx = parseInt(btn.dataset.idx)
      const state = getParkingState()
      
      const cat = state.settings.categories[idx]
      if (cat?.id === 'visitante' || cat?.id === 'residente') {
        return showToast('No puedes eliminar categorías base', 'error')
      }
      
      state.settings.categories.splice(idx, 1)
      saveParkingState(state)
      refresh()
    },
    SAVE_SUB_SETTINGS: async () => {
      const rate = document.getElementById('sub-rate').value;
      const limit = document.getElementById('sub-limit').value;
      const state = getParkingState();
      const { error } = await supabase.from('buildings').update({ monthly_rate: rate, monthly_slots_limit: limit }).eq('id', state.buildingId);
      if(!error) {
        state.buildingPlan = state.buildingPlan || {};
        state.buildingPlan.monthly_rate = rate;
        state.buildingPlan.monthly_slots_limit = limit;
        saveParkingState(state);
        showToast('Ajustes guardados correctamente', 'success');
      } else {
        showToast('Error al guardar', 'error');
      }
      refresh();
    },
    RESOLVE_INCIDENT_FORM: (btn) => {
      const id = btn.dataset.id;
      const guard = btn.dataset.guard;
      const l = document.getElementById('modal-layer');
      l.style.pointerEvents = 'auto';
      l.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;">
          <div style="background:white; border-radius:35px; width:100%; max-width:400px; padding:35px 25px; box-shadow:0 25px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;">
            <h2 style="font-weight:900; color:var(--primary); margin-bottom:5px; text-align:center; text-transform:uppercase;">RESPONDER INCIDENTE</h2>
            <div style="font-size:0.75rem; color:#999; text-align:center; margin-bottom:20px; font-weight:700;">Será enviado al guardia: ${guard}</div>
            <textarea id="admin-inc-response" rows="4" placeholder="Escribe tu respuesta aquí..." style="width:100%; box-sizing:border-box; border:1.5px solid #f0f0f0; border-radius:18px; padding:15px; font-family:var(--font); font-weight:700; margin-bottom:20px; outline:none; resize:none;"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <button data-action="SUBMIT_INCIDENT_RESPONSE" data-id="${id}" data-guard="${guard}" style="padding:20px; background:#1a1a2e; color:var(--accent); border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">ENVIAR</button>
              <button data-action="CANCEL_MODAL" style="padding:20px; background:#f4f4f4; color:#666; border:none; border-radius:20px; font-weight:900; cursor:pointer; font-size:0.8rem; text-transform:uppercase;">CANCELAR</button>
            </div>
          </div>
        </div>
      `;
    },
    SUBMIT_INCIDENT_RESPONSE: async (btn) => {
      const id = btn.dataset.id;
      const guard = btn.dataset.guard;
      const response = document.getElementById('admin-inc-response')?.value?.trim();
      
      if (!response) return showToast('Agrega una respuesta', 'error');

      btn.textContent = 'ENVIANDO...';
      btn.disabled = true;

      const { error } = await supabase
        .from('incidents')
        .update({ 
           resolved: true,
           admin_response: response,
           responded_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) { 
        console.error('Error', error);
        showToast('Error al guardar.', 'error'); 
        actions.CANCEL_MODAL(); 
        return; 
      }

      await logAudit('RESOLVE_INCIDENT', { incident_id: id });
      showToast('Respuesta enviada al guardia', 'success');

      const state = getParkingState()
      supabase.functions.invoke('send-push', { 
        body: { 
          building_id: state.buildingId, 
          role: 'GUARD',
          identifier: guard, 
          title: '✅ Incidente Atendido', 
          body: response.slice(0, 60)
        } 
      });

      actions.CANCEL_MODAL();
      refresh();
    },
    RESOLVE_INCIDENT: async (btn) => {
      const id = btn.dataset.id;
      const { error } = await supabase
        .from('incidents')
        .update({ resolved: true })
        .eq('id', id);

      if (error) { showToast('Error al resolver incidente', 'error'); return; }
      await logAudit('RESOLVE_INCIDENT', { incident_id: id });
      showToast('Incidente marcado como resuelto', 'success');
      refresh();
    },
    GO_TO_SUBS: () => {
      store.activeTab = 'SUBS';
      document.getElementById('expiry-alert-banner')?.remove();
      refresh();
    },
    SEARCH_PLATE: async (btn) => {
      const plateInput = document.getElementById('trace-plate-input');
      const plate = plateInput?.value?.trim().toUpperCase();
      if (!plate) return;
      
      const container = document.getElementById('trace-results-container');
      if (!container) return;
      
      btn.textContent = '...';
      container.style.display = 'block';
      container.innerHTML = '<div style="color:#666; font-size:0.8rem; font-weight:700; text-align:center; padding:10px;">Buscando...</div>';
      
      const state = getParkingState();
      
      try {
        const { data: logs } = await supabase
          .from('access_logs')
          .select('id, type, created_at, guard_name, plate, is_resident, custom_price, visitors(resident_name, company, destination, tower, apt)')
          .eq('building_id', state.buildingId)
          .ilike('plate', `%${plate}%`)
          .order('created_at', { ascending: false })
          .limit(20);
          
        // 🛡️ Data Minimization: select explicit columns
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, resident_name, expiry_date, apt, phone, tower, custom_price')
          .eq('building_id', state.buildingId)
          .ilike('plate', `%${plate}%`)
          .limit(1);

        const sub = subs && subs.length > 0 ? subs[0] : null;

        let resHtml = '';
        if (sub) {
          const daysLeft = Math.ceil((new Date(sub.expiry_date) - new Date()) / 86400000);
          resHtml += `
            <div style="background:linear-gradient(135deg, rgba(245,197,24,0.1) 0%, rgba(245,197,24,0.05) 100%); border:1px solid rgba(245,197,24,0.2); border-radius:16px; padding:15px; margin-bottom:15px;">
              <div style="font-size:0.6rem; color:#D97706; font-weight:900; margin-bottom:5px; text-transform:uppercase;">⭐ RESIDENTE ENCONTRADO</div>
              <div style="font-size:1.1rem; color:#1a1a2e; font-weight:900; margin-bottom:6px;">${escapeHTML(sub.resident_name)}</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <span style="font-size:0.6rem; background:white; color:#666; padding:3px 8px; border-radius:6px; font-weight:800;">Apto: ${escapeHTML(sub.apt)||'-'}</span>
                <span style="font-size:0.6rem; background:white; color:#666; padding:3px 8px; border-radius:6px; font-weight:800;">Torre: ${escapeHTML(sub.tower)||'-'}</span>
                <span style="font-size:0.6rem; background:white; color:${daysLeft >= 0 ? '#22c55e' : '#e63946'}; padding:3px 8px; border-radius:6px; font-weight:800;">Vence: ${new Date(sub.expiry_date).toLocaleDateString()} (${daysLeft >= 0 ? `${daysLeft}d restantes` : 'Vencida'})</span>
              </div>
            </div>
          `;
        }

        let logsHtml = '<div style="font-size:0.65rem; font-weight:900; color:#4b5563; margin-bottom:10px; text-transform:uppercase;">Historial de Accesos (Últimos 20)</div>';
        logsHtml += '<div style="display:grid; gap:8px;">';
        
        logsHtml += (logs || []).map(l => {
          const typeColor = (l.type === 'ENTRY' || l.type === 'INGRESO') ? '#22c55e' : '#3b82f6';
          return `
            <div style="background:white; border:1px solid #eee; padding:12px; border-radius:12px; font-size:0.7rem;">
               <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                 <span style="font-weight:900; color:${typeColor};">${l.type}</span>
                 <span style="color:#999; font-weight:700;">${new Date(l.created_at).toLocaleString()}</span>
               </div>
               <div style="color:#1a1a2e; font-weight:700;">
                  Operador: ${escapeHTML(l.guard_name || 'Admin')}
               </div>
            </div>
          `;
        }).join('') || '<div style="text-align:center; padding:15px; color:#bbb; font-weight:700;">Sin tráficos registrados para esta placa</div>';
        logsHtml += '</div>';

        container.innerHTML = resHtml + logsHtml;
      } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:#ef4444; font-size:0.8rem; font-weight:700; text-align:center; padding:10px;">Error al obtener trazabilidad</div>';
      } finally {
        btn.textContent = 'BUSCAR';
      }
    }
  })
}
