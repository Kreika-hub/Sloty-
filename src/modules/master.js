import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initMaster = (container) => {
  let activeTab = 'BUILDINGS'
  let selectedBuilding = null
  
  // DOM Cache
  let elContent = null
  let elShell = null

  const FEATURES = [
    { key: 'whatsapp_alerts',   label: 'Alertas WhatsApp',     icon: '📱' },
    { key: 'debt_tracking',     label: 'Control de Deudas',    icon: '💸' },
    { key: 'frequent_visitors', label: 'Visitantes Frecuentes',icon: '🔁' },
    { key: 'audit_log',         label: 'Bitácora de Auditoría',icon: '📋' },
    { key: 'finance_report',    label: 'Reporte Financiero',   icon: '📊' },
    { key: 'multi_level',       label: 'Multinivel',           icon: '🏢' },
  ]
  const PLANS = [
    { key: 'BRONCE', label: 'Bronce', maxSlots: 50,  color: '#cd7f32' },
    { key: 'PLATA',  label: 'Plata',  maxSlots: 150, color: '#aaa'    },
    { key: 'ORO',    label: 'Oro',    maxSlots: 999, color: '#F5C518' },
  ]

  const getState = () => getParkingState()
  const ensureFeatures = (state) => {
    if (!state.features) { state.features = {}; FEATURES.forEach(f => { state.features[f.key] = true }) }
    if (!state.plan) state.plan = 'BRONCE'
    if (!state.active) state.active = true
    return state
  }

  // --- ACTIONS ---
  window._master_tab = (tab) => { activeTab=tab; selectedBuilding=null; render() }
  window._master_back = () => { selectedBuilding=null; render() }
  window._master_selectBuilding = () => { selectedBuilding='detail'; render() }
  window._master_toggleActive = () => {
    const s = getState(); s.active = s.active===false; saveParkingState(s); render()
  }
  window._master_setPlan = (pk) => {
    const s = getState(); s.plan = pk; saveParkingState(s); render()
  }
  window._master_toggleFeature = (k) => {
    const s = getState(); s.features = s.features||{}; s.features[k] = !s.features[k]; saveParkingState(s); render()
  }
  window._master_addAd = (imgData) => {
    if(!imgData) return
    const s = getState(); s.ads = s.ads||[]; 
    s.ads.unshift({id:Date.now().toString(), imageUrl:imgData, active:true, timestamp: Date.now()}); 
    saveParkingState(s); render()
  }
  window._master_toggleAd = (id) => {
    const s = getState(); const ad = s.ads.find(a=>a.id===id); if(ad) ad.active=!ad.active; saveParkingState(s); render()
  }
  window._master_repostAd = (id) => {
    const s = getState(); const adIdx = s.ads.findIndex(a=>a.id===id)
    if(adIdx > -1) {
      const [ad] = s.ads.splice(adIdx, 1)
      ad.timestamp = Date.now()
      s.ads.unshift(ad)
      saveParkingState(s); render()
    }
  }
  window._master_deleteAd = (id) => {
    if(!confirm('¿Borrar anuncio definitivamente?')) return; 
    const s = getState(); s.ads = s.ads.filter(a=>a.id!==id); saveParkingState(s); render()
  }
  window._master_handleFileUpload = (input) => {
    const file = input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => window._master_addAd(e.target.result)
    reader.readAsDataURL(file)
  }
  window._master_clearMovements = () => {
    if(!confirm('¿Limpiar?')) return; const s = getState(); s.movements=[]; saveParkingState(s); render()
  }
  window._master_resetFull = () => { if(confirm('⚠ RESET?')) { localStorage.clear(); location.reload() } }

  // --- RENDERING ---
  const tabBar = () => `
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.1);overflow-x:auto;background:#1a1a2e;position:sticky;top:0;z-index:90;">
      ${[{k:'BUILDINGS',l:'Edificios'},{k:'ADS',l:'Anuncios'},{k:'AUDIT',l:'Auditoría'},{k:'SYSTEM',l:'Sistema'}].map(t=>`
        <div onclick="window._master_tab('${t.k}')" style="padding:14px 20px;font-size:0.75rem;font-weight:900;cursor:pointer;white-space:nowrap;letter-spacing:1px;border-bottom:3px solid ${activeTab===t.k?'#F5C518':'transparent'};color:${activeTab===t.k?'#F5C518':'rgba(255,255,255,0.4)'};">
          ${t.l}
        </div>`).join('')}
    </div>`

  const renderBuildings = (state) => {
    state = ensureFeatures(state); const total = state.levels.reduce((a,l)=>a+l.slots.length,0), occ = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status!=='FREE').length,0), plan = PLANS.find(p=>p.key===state.plan)||PLANS[0]
    if (selectedBuilding === 'detail') {
      return `<div style="padding:20px;"><button onclick="_master_back()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:0.8rem;cursor:pointer;margin-bottom:15px;">← VOLVER</button>
        <div style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;">
          <div style="font-size:1.2rem;font-weight:900;color:white;">${state.buildingName}</div>
          <div style="display:flex;gap:8px;margin:15px 0;"><button onclick="_master_toggleActive()" style="background:${state.active?'#22c55e22':'#e6394622'};color:${state.active?'#22c55e':'#e63946'};border:1px solid currentColor;padding:5px 10px;border-radius:6px;font-size:0.7rem;font-weight:900;">${state.active?'ACTIVO':'INACTIVO'}</button></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:#F5C518;font-weight:900;">${total}</div><div style="font-size:0.5rem;color:#666;">SLOTS</div></div>
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:#22c55e;font-weight:900;">${occ}</div><div style="font-size:0.5rem;color:#666;">OCC</div></div>
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;"><div style="color:white;font-weight:900;">${(state.movements||[]).length}</div><div style="font-size:0.5rem;color:#666;">MOVS</div></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${PLANS.map(p=>`<button onclick="_master_setPlan('${p.key}')" style="padding:10px 5px;border-radius:8px;border:1px solid ${state.plan===p.key?p.color:'rgba(255,255,255,0.1)'};background:${state.plan===p.key?p.color+'22':'transparent'};color:${state.plan===p.key?p.color:'rgba(255,255,255,0.3)'};font-size:0.6rem;font-weight:900;">${p.label}</button>`).join('')}
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;margin-top:20px;">
          <div style="font-size:0.7rem;font-weight:900;color:#F5C518;margin-bottom:15px;">FEATURES</div>
          ${FEATURES.map(f=>`<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);color:white;font-size:0.8rem;"><div style="display:flex;gap:10px;"><span>${f.icon}</span><span>${f.label}</span></div><button onclick="_master_toggleFeature('${f.key}')" style="background:${state.features[f.key]?'#22c55e':'#333'};width:36px;height:18px;border-radius:9px;border:none;"></button></div>`).join('')}
        </div>
      </div>`
    }
    return `<div style="padding:20px;">
      <div onclick="_master_selectBuilding()" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-size:1rem;font-weight:900;color:white;">${state.buildingName}</div><div style="font-size:0.6rem;color:#666;margin-top:4px;">${state.buildingCode} · ${plan.label} · ${total} slots</div></div>
          <div style="color:${state.active?'#22c55e':'#e63946'};font-size:0.6rem;font-weight:900;">${state.active?'● ACTIVO':'● INACTIVO'}</div>
        </div>
      </div>
    </div>`
  }

  const renderAds = (state) => `
    <div style="padding:20px; padding-bottom:100px;">
      <h3 style="color:white; font-weight:900; margin-bottom:8px;">GESTIÓN DE ANUNCIOS</h3>
      <p style="color:rgba(255,255,255,0.4); font-size:0.65rem; line-height:1.4; margin-bottom:20px;">
        Los anuncios se mostrarán en el carrusel principal de todos los usuarios.
      </p>

      <!-- UPLOAD AREA -->
      <div style="background:rgba(255,255,255,0.06); padding:24px; border-radius:24px; border:1px dashed rgba(255,255,255,0.2); text-align:center; margin: 0 10px 30px 10px;">
        <div style="font-size:2rem; margin-bottom:10px;">📸</div>
        <div style="color:white; font-weight:900; font-size:0.9rem; margin-bottom:4px;">Subir Nueva Imagen</div>
        <div style="color:#F5C518; font-weight:700; font-size:0.6rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Tamaño ideal: 800x350 px</div>
        
        <input type="file" id="ad-file-input" accept="image/*" onchange="_master_handleFileUpload(this)" style="display:none;">
        <button onclick="document.getElementById('ad-file-input').click()" 
          style="background:#F5C518; color:#1a1a2e; border:none; padding:12px 24px; border-radius:12px; font-weight:900; font-size:0.8rem; cursor:pointer; width:100%;">
          SELECCIONAR DESDE TELÉFONO
        </button>
        
        <div style="margin-top:15px; font-size:0.55rem; color:rgba(255,255,255,0.3); font-style:italic;">
          Disclaimer: Asegúrese de tener los derechos de la imagen. La visibilidad es global.
        </div>
      </div>

      <div style="margin: 0 10px;">
        <div style="font-size:0.7rem; font-weight:900; color:#F5C518; margin-bottom:15px; text-transform:uppercase; letter-spacing:1px;">HISTORIAL DE ANUNCIOS</div>
        
        <div class="ads-history-grid">
          ${(state.ads || []).map(a => `
            <div class="ad-history-item">
              <img src="${a.imageUrl}">
              <div class="ad-history-actions">
                 <button onclick="_master_repostAd('${a.id}')" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Repost">🔁</button>
                 <button onclick="_master_toggleAd('${a.id}')" style="background:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Toggle">${a.active ? '👁️' : '🚫'}</button>
                 <button onclick="_master_deleteAd('${a.id}')" style="background:#e63946; color:white; border:none; width:30px; height:30px; border-radius:50%; font-size:0.8rem;" title="Delete">🗑️</button>
              </div>
              ${!a.active ? `<div style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; font-size:0.5rem; padding:2px 4px; border-radius:4px;">OCULTO</div>` : ''}
            </div>
          `).join('')}
          ${!(state.ads || []).length ? '<div style="grid-column:span 3; text-align:center; padding:40px; color:rgba(255,255,255,0.2); font-size:0.8rem;">No hay anuncios subidos</div>' : ''}
        </div>
      </div>
    </div>`

  const renderShell = () => {
    container.innerHTML = `<div id="master-shell" style="background:#1a1a2e;min-height:100vh;font-family:'Montserrat',sans-serif;">
      <div style="background:#F5C518;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:1.1rem;font-weight:900;letter-spacing:-1px;">SLOTY MASTER</div><button onclick="localStorage.removeItem('sloty_session');location.reload()" style="background:#1a1a2e;color:#F5C518;border:none;padding:5px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;">SALIR</button></div>
      <div id="master-tabs-area"></div><div id="master-content-area"></div>
    </div>`
    elShell = container.querySelector('#master-tabs-area')
    elContent = container.querySelector('#master-content-area')
  }

  const render = () => {
    const s = getState()
    if (!elShell) renderShell()
    elShell.innerHTML = tabBar()
    let html = ''
    if      (activeTab==='BUILDINGS') html = renderBuildings(s)
    else if (activeTab==='ADS')       html = renderAds(s)
    else if (activeTab==='AUDIT')     html = `<div style="padding:20px;color:#666;font-size:0.8rem;">(Logs in background)</div>`
    else if (activeTab==='SYSTEM')    html = `<div style="padding:20px;"><button onclick="_master_resetFull()" style="width:100%;padding:15px;background:#e6394622;color:#e63946;border:1px solid #e63946;border-radius:12px;font-weight:900;">RESET FULL SYSTEM</button></div>`
    if (elContent.innerHTML !== html) elContent.innerHTML = html
  }

  render()
}
