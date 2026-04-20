import { getParkingState, saveParkingState, logAudit } from '../db.js'

export const initMaster = (container) => {
  let activeTab = 'BUILDINGS'
  let selectedBuilding = null

  // Default features every building can have toggled
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

  // ── helpers ────────────────────────────────────────────────
  const getState = () => getParkingState()

  const ensureFeatures = (state) => {
    if (!state.features) {
      state.features = {}
      FEATURES.forEach(f => { state.features[f.key] = true })
    }
    if (!state.plan) state.plan = 'BRONCE'
    if (!state.active) state.active = true
    return state
  }

  const sw = (tab) => { activeTab = tab; render() }

  // ── TABS ──────────────────────────────────────────────────
  const tabBar = () => `
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.1);overflow-x:auto;">
      ${[
        { k:'BUILDINGS', label:'Edificios'  },
        { k:'AUDIT',     label:'Auditoría'  },
        { k:'SYSTEM',    label:'Sistema'    },
      ].map(t => `
        <div onclick="window._master_tab('${t.k}')"
          style="padding:14px 20px;font-size:0.75rem;font-weight:900;cursor:pointer;white-space:nowrap;letter-spacing:1px;
            border-bottom:3px solid ${activeTab===t.k?'#F5C518':'transparent'};
            color:${activeTab===t.k?'#F5C518':'rgba(255,255,255,0.4)'};">
          ${t.label}
        </div>`).join('')}
    </div>`

  // ── BUILDINGS TAB ─────────────────────────────────────────
  const renderBuildings = (state) => {
    state = ensureFeatures(state)
    const total = state.levels.reduce((a,l)=>a+l.slots.length,0)
    const occupied = state.levels.reduce((a,l)=>a+l.slots.filter(s=>s.status==='OCCUPIED'||s.status==='DEBT').length,0)
    const plan = PLANS.find(p=>p.key===state.plan)||PLANS[0]
    const movements = (state.movements||[]).length

    if (selectedBuilding === 'detail') {
      return `
        <div style="padding:20px;">
          <button onclick="window._master_back()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:20px;padding:0;">← VOLVER</button>

          <!-- Building card -->
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
              <div>
                <div style="font-size:1.2rem;font-weight:900;color:white;">${state.buildingName}</div>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.4);margin-top:4px;">Código: ${state.buildingCode||'N/A'}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                <div style="background:${state.active!==false?'rgba(34,197,94,0.2)':'rgba(230,57,70,0.2)'};color:${state.active!==false?'#22c55e':'#e63946'};border:1px solid ${state.active!==false?'rgba(34,197,94,0.4)':'rgba(230,57,70,0.4)'};padding:4px 10px;border-radius:20px;font-size:0.65rem;font-weight:900;">
                  ${state.active!==false?'ACTIVO':'INACTIVO'}
                </div>
                <button onclick="window._master_toggleActive()"
                  style="background:${state.active!==false?'rgba(230,57,70,0.15)':'rgba(34,197,94,0.15)'};color:${state.active!==false?'#e63946':'#22c55e'};border:1px solid ${state.active!==false?'rgba(230,57,70,0.3)':'rgba(34,197,94,0.3)'};padding:6px 12px;border-radius:8px;font-size:0.65rem;font-weight:900;cursor:pointer;font-family:'Montserrat',sans-serif;">
                  ${state.active!==false?'DESACTIVAR':'ACTIVAR'}
                </button>
              </div>
            </div>

            <!-- Stats row -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
              <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:900;color:#F5C518;">${total}</div>
                <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:700;">PUESTOS</div>
              </div>
              <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:900;color:#22c55e;">${occupied}</div>
                <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:700;">OCUPADOS</div>
              </div>
              <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:900;color:white;">${movements}</div>
                <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);font-weight:700;">MOVIMIENTOS</div>
              </div>
            </div>

            <!-- Plan selector -->
            <div style="margin-bottom:4px;">
              <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:10px;">PLAN DE SUSCRIPCIÓN</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                ${PLANS.map(p=>`
                  <button onclick="window._master_setPlan('${p.key}')"
                    style="padding:10px 6px;border-radius:10px;border:2px solid ${state.plan===p.key?p.color:'rgba(255,255,255,0.1)'};background:${state.plan===p.key?p.color+'22':'transparent'};color:${state.plan===p.key?p.color:'rgba(255,255,255,0.4)'};font-family:'Montserrat',sans-serif;font-size:0.7rem;font-weight:900;cursor:pointer;text-align:center;">
                    ${p.label}<br><span style="font-size:0.55rem;opacity:0.7;">${p.maxSlots<999?'≤'+p.maxSlots+' slots':'Ilimitado'}</span>
                  </button>`).join('')}
              </div>
            </div>
          </div>

          <!-- Features toggle -->
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;">
            <div style="font-size:0.7rem;font-weight:900;color:#F5C518;letter-spacing:1px;margin-bottom:16px;">FUNCIONALIDADES ACTIVAS</div>
            ${FEATURES.map(f=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:1.1rem;">${f.icon}</span>
                  <span style="font-size:0.85rem;font-weight:700;color:${state.features[f.key]?'white':'rgba(255,255,255,0.3)'};">${f.label}</span>
                </div>
                <button onclick="window._master_toggleFeature('${f.key}')"
                  style="width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background 0.2s;
                    background:${state.features[f.key]?'#22c55e':'rgba(255,255,255,0.15)'};">
                  <div style="position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:white;transition:left 0.2s;
                    left:${state.features[f.key]?'23px':'3px'};"></div>
                </button>
              </div>`).join('')}
          </div>
        </div>
      `
    }

    // Buildings list view
    return `
      <div style="padding:20px;">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px;">
          <div style="background:rgba(245,197,24,0.1);border:1px solid rgba(245,197,24,0.2);border-radius:12px;padding:16px;">
            <div style="font-size:1.6rem;font-weight:900;color:#F5C518;">1</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;margin-top:2px;">EDIFICIOS ACTIVOS</div>
          </div>
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;">
            <div style="font-size:1.6rem;font-weight:900;color:#22c55e;">${total}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;margin-top:2px;">PUESTOS TOTALES</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
            <div style="font-size:1.6rem;font-weight:900;color:white;">${movements}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;margin-top:2px;">MOVIMIENTOS TOTALES</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
            <div style="font-size:1.6rem;font-weight:900;color:white;">${(state.personnel||[]).length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;margin-top:2px;">GUARDIAS REGISTRADOS</div>
          </div>
        </div>

        <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:12px;">EDIFICIOS EN PLATAFORMA</div>

        <div onclick="window._master_selectBuilding()"
          style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px;cursor:pointer;transition:background 0.2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.1)'"
          onmouseout="this.style.background='rgba(255,255,255,0.06)'">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:1rem;font-weight:900;color:white;margin-bottom:4px;">${state.buildingName}</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:0.65rem;color:rgba(255,255,255,0.4);">Código: ${state.buildingCode||'N/A'}</span>
                <span style="background:${plan.color}22;color:${plan.color};border:1px solid ${plan.color}44;padding:2px 8px;border-radius:6px;font-size:0.6rem;font-weight:900;">
                  ${plan.label}
                </span>
                <span style="font-size:0.65rem;color:rgba(255,255,255,0.4);">${total} puestos</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <div style="color:${state.active!==false?'#22c55e':'#e63946'};font-size:0.65rem;font-weight:900;">
                ${state.active!==false?'● ACTIVO':'● INACTIVO'}
              </div>
              <span style="color:rgba(255,255,255,0.3);font-size:0.75rem;">→</span>
            </div>
          </div>
        </div>

        <div style="margin-top:16px;border:2px dashed rgba(255,255,255,0.1);border-radius:14px;padding:20px;text-align:center;cursor:pointer;"
          onclick="alert('Próximamente: Registrar nuevo edificio desde el panel Master')">
          <div style="font-size:1.5rem;margin-bottom:6px;">+</div>
          <div style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.3);">AGREGAR EDIFICIO</div>
        </div>
      </div>
    `
  }

  // ── AUDIT TAB ─────────────────────────────────────────────
  const renderAudit = (state) => {
    const allMovements = (state.movements||[])
    const allAudit = (state.auditLog||[])
    const todayStr = new Date().toDateString()
    const todayMovements = allMovements.filter(m=>new Date(m.timestamp).toDateString()===todayStr)
    const collected = allMovements.filter(m=>m.paymentStatus==='PAGADO').reduce((a,m)=>a+(m.amount||1),0)
    const debts = allMovements.filter(m=>m.paymentStatus==='DEUDA').length

    return `
      <div style="padding:20px;">
        <!-- Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;">
            <div style="font-size:1.4rem;font-weight:900;color:#22c55e;">$${collected.toFixed(2)}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">RECAUDADO TOTAL</div>
          </div>
          <div style="background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);border-radius:12px;padding:16px;">
            <div style="font-size:1.4rem;font-weight:900;color:#e63946;">${debts}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">DEUDAS ACTIVAS</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
            <div style="font-size:1.4rem;font-weight:900;color:white;">${todayMovements.length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">MOVIMIENTOS HOY</div>
          </div>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
            <div style="font-size:1.4rem;font-weight:900;color:white;">${allMovements.length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);font-weight:700;">TOTAL HISTÓRICO</div>
          </div>
        </div>

        <!-- Movement log -->
        <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:12px;">MOVIMIENTOS DE GARITA</div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:20px;">
          ${allMovements.length===0
            ? `<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.2);font-size:0.85rem;">Sin movimientos registrados</div>`
            : allMovements.slice(0,30).map(m=>`
              <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-size:0.85rem;font-weight:900;color:white;">${m.plate||'—'}</div>
                  <div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-top:2px;">
                    ${m.type} · ${m.category||''} · Slot ${m.slot||'—'}
                    ${m.guardName?`· 👤 ${m.guardName}`:''}
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.75rem;font-weight:900;color:${m.paymentStatus==='DEUDA'?'#e63946':m.paymentStatus==='PAGADO'?'#22c55e':'rgba(255,255,255,0.5)'};">
                    ${m.paymentStatus||'EN CURSO'}
                  </div>
                  <div style="font-size:0.6rem;color:rgba(255,255,255,0.3);">${new Date(m.timestamp).toLocaleString()}</div>
                </div>
              </div>`).join('')}
        </div>

        <!-- Infra audit log -->
        <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:12px;">CAMBIOS DE INFRAESTRUCTURA</div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
          ${allAudit.length===0
            ? `<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.2);font-size:0.85rem;">Sin cambios registrados</div>`
            : allAudit.slice(0,20).map(a=>`
              <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.7);">${a.action}</div>
                <div style="font-size:0.6rem;color:rgba(255,255,255,0.3);white-space:nowrap;margin-left:12px;">${new Date(a.timestamp).toLocaleTimeString()}</div>
              </div>`).join('')}
        </div>
      </div>
    `
  }

  // ── SYSTEM TAB ────────────────────────────────────────────
  const renderSystem = (state) => {
    const storageSize = JSON.stringify(state).length
    const kb = (storageSize/1024).toFixed(1)
    return `
      <div style="padding:20px;">
        <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:12px;">SALUD DEL SISTEMA</div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:20px;">
          ${[
            { label:'Estado de DB',      value:'localStorage activo',  ok:true  },
            { label:'Conexión Supabase', value:'Configurada',          ok:true  },
            { label:'Uso de almacenamiento', value:`${kb} KB`,         ok:parseFloat(kb)<100 },
            { label:'Movimientos en cache', value:`${(state.movements||[]).length} registros`, ok:true },
            { label:'Guardias registrados',  value:`${(state.personnel||[]).length}`, ok:(state.personnel||[]).length>0 },
            { label:'Niveles configurados',  value:`${(state.levels||[]).length}`,    ok:(state.levels||[]).length>0  },
          ].map(item=>`
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:rgba(255,255,255,0.6);">${item.label}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.75rem;font-weight:700;color:${item.ok?'#22c55e':'#e63946'};">${item.value}</span>
                <span style="font-size:0.7rem;">${item.ok?'✓':'⚠'}</span>
              </div>
            </div>`).join('')}
        </div>

        <div style="font-size:0.65rem;font-weight:900;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:12px;">ACCIONES DE SISTEMA</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button onclick="window._master_clearMovements()"
            style="width:100%;padding:14px;background:rgba(245,197,24,0.1);color:#F5C518;border:1px solid rgba(245,197,24,0.3);border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;font-size:0.8rem;text-align:left;padding-left:16px;">
            🗂 Limpiar historial de movimientos
          </button>
          <button onclick="window._master_clearAudit()"
            style="width:100%;padding:14px;background:rgba(245,197,24,0.1);color:#F5C518;border:1px solid rgba(245,197,24,0.3);border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;font-size:0.8rem;text-align:left;padding-left:16px;">
            📋 Limpiar bitácora de auditoría
          </button>
          <button onclick="window._master_resetFull()"
            style="width:100%;padding:14px;background:rgba(230,57,70,0.1);color:#e63946;border:1px solid rgba(230,57,70,0.3);border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;font-size:0.8rem;text-align:left;padding-left:16px;">
            ⚠ Reset completo del sistema
          </button>
        </div>
      </div>
    `
  }

  // ── GLOBAL ACTIONS ────────────────────────────────────────
  window._master_tab = (tab) => { activeTab=tab; selectedBuilding=null; render() }
  window._master_back = () => { selectedBuilding=null; render() }
  window._master_selectBuilding = () => { selectedBuilding='detail'; render() }

  window._master_toggleActive = () => {
    const state = getState()
    ensureFeatures(state)
    state.active = state.active===false ? true : false
    logAudit(`Master ${state.active?'activó':'desactivó'} el edificio`)
    saveParkingState(state)
    render()
  }

  window._master_setPlan = (planKey) => {
    const state = getState()
    ensureFeatures(state)
    const old = state.plan
    state.plan = planKey
    logAudit(`Master cambió plan: ${old} → ${planKey}`)
    saveParkingState(state)
    render()
  }

  window._master_toggleFeature = (key) => {
    const state = getState()
    ensureFeatures(state)
    state.features[key] = !state.features[key]
    logAudit(`Master ${state.features[key]?'activó':'desactivó'} funcionalidad: ${key}`)
    saveParkingState(state)
    render()
  }

  window._master_clearMovements = () => {
    if (!confirm('¿Limpiar TODO el historial de movimientos? Esta acción no se puede deshacer.')) return
    const state = getState()
    state.movements = []
    state.stats.totalCollected = 0
    state.stats.totalDebt = 0
    logAudit('Master limpió historial de movimientos')
    saveParkingState(state)
    render()
  }

  window._master_clearAudit = () => {
    if (!confirm('¿Limpiar la bitácora de auditoría?')) return
    const state = getState()
    state.auditLog = []
    saveParkingState(state)
    render()
  }

  window._master_resetFull = () => {
    if (!confirm('⚠ RESET TOTAL: Se borrarán TODOS los datos. ¿Continuar?')) return
    if (!confirm('Última confirmación. ¿Estás seguro?')) return
    localStorage.clear()
    location.reload()
  }

  // ── RENDER ────────────────────────────────────────────────
  const render = () => {
    const state = getState()
    ensureFeatures(state)
    container.innerHTML = `
      <div style="background:#1a1a2e;min-height:100vh;font-family:'Montserrat',sans-serif;">
        <!-- Header -->
        <div style="background:#F5C518;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:1.3rem;font-weight:900;color:#1a1a2e;letter-spacing:-1px;">SLOTY</div>
            <span style="background:#1a1a2e;color:#F5C518;padding:3px 8px;border-radius:6px;font-size:0.6rem;font-weight:900;letter-spacing:1px;">MASTER</span>
          </div>
          <button onclick="localStorage.removeItem('sloty_session');location.reload()"
            style="background:rgba(0,0,0,0.15);color:#1a1a2e;border:none;padding:8px 14px;border-radius:8px;font-weight:900;cursor:pointer;font-size:0.75rem;font-family:'Montserrat',sans-serif;">
            SALIR
          </button>
        </div>
        ${tabBar()}
        <div style="overflow-y:auto;padding-bottom:40px;">
          ${activeTab==='BUILDINGS' ? renderBuildings(state) : ''}
          ${activeTab==='AUDIT'     ? renderAudit(state)     : ''}
          ${activeTab==='SYSTEM'    ? renderSystem(state)    : ''}
        </div>
      </div>
    `
  }

  render()
}
