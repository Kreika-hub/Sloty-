/**
 * Admin.js — Main Router and Shell Orchestrator
 * Refactored to act as a lightweight facade linking specialized modules.
 */
import { getParkingState, saveParkingState, logAudit, supabase, syncDown, getExchangeRate, getSyncQueueCount } from '../db.js'
import { escapeHTML } from '../utils/sanitize.js'
import { store, getSubsCached, unsubscribeFinanceRealtime, hasFeature } from './admin/admin-store.js'
import { ICONS, SKELETONS } from './admin/admin-ui-components.js'

// Submodule UI renderers and action binders
import { loadHomeMetrics, renderHome, checkExpiringSubscriptions } from './admin/admin-dashboard.js'
import { initUserActions, renderMonthlySystem, renderAbonos, setupAbonosHooks, setupMonthlySystemHooks } from './admin/admin-users.js'
import { initFinanceActions, renderFinanceSummary } from './admin/admin-finance.js'
import { initStructureActions, renderLevels } from './admin/admin-structure.js'
import { initGuardActions, renderPersonnel, setupGuardHooks } from './admin/admin-guards.js'
import { initSettingsActions, renderSettings, renderReports } from './admin/admin-settings.js'
import { shouldShowOnboarding, renderOnboardingWizard } from './onboarding.js'

const renderLockedFeature = (featureName) => `
  <div style="padding:60px 20px; text-align:center; font-family:'Montserrat',sans-serif;">
    <div style="font-size:3.5rem; margin-bottom:15px;">🔒</div>
    <h3 style="font-size:1.2rem; font-weight:900; color:var(--primary); margin-bottom:8px; text-transform:uppercase;">
      Función Bloqueada
    </h3>
    <p style="font-size:0.85rem; color:#666; max-width:320px; margin:0 auto 24px; line-height:1.5;">
      El módulo <strong>${escapeHTML(featureName)}</strong> no está habilitado en el plan actual de tu condominio.
    </p>
    <a href="https://wa.me/584120770776?text=Hola,%20deseo%20activar%20el%20modulo%20${encodeURIComponent(featureName)}%20en%20Sloty"
       target="_blank"
       style="display:inline-block; padding:16px 28px; background:#1a1a2e; color:var(--accent); text-decoration:none; border-radius:18px; font-weight:900; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px;">
      CONTACTAR SOPORTE MÁSTER
    </a>
  </div>
`;

// Fallback renders for legacy/unused tabs to prevent runtime crashes
const renderNotifications = () => `
  <div style="padding:20px; text-align:center; color:#999; font-weight:700;">
    <div style="font-size:2rem; margin-bottom:10px;">🔔</div>
    Centro de notificaciones en desarrollo.
  </div>`;

const renderProfile = (state) => `
  <div style="padding:20px; text-align:center; color:#999; font-weight:700;">
    <div style="font-size:2rem; margin-bottom:10px;">👤</div>
    Perfil de edificio: <strong>${escapeHTML(state.buildingName)}</strong><br>
    Código: ${escapeHTML(state.buildingCode)}
  </div>`;

export const initAdmin = (container) => {
  console.log('[Sloty] Inicializando Panel Admin Modular...')
  
  let elMain = null

  const handleSyncUpdated = (e) => {
    const el = document.getElementById('admin-sync-queue')
    if (el) {
      el.style.display = e.detail.count > 0 ? 'inline-block' : 'none'
      const countEl = document.getElementById('admin-sync-count')
      if (countEl) countEl.textContent = e.detail.count
    }
  }

  const handleConnectionStatus = (e) => {
    const el = document.getElementById('admin-conn-status')
    if (el) {
      el.style.background = e.detail.online ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'
      el.style.color = e.detail.online ? '#22c55e' : '#ce8a05'
      el.style.borderColor = e.detail.online ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'
      el.innerHTML = `● ${e.detail.online ? 'En Línea' : 'Offline'}`
    }
  }

  window.addEventListener('sloty-sync-updated', handleSyncUpdated)
  window.addEventListener('sloty-connection-status', handleConnectionStatus)

  const handleSyncDownloaded = () => {
    debouncedRender()
  }
  window.addEventListener('sloty-sync-downloaded', handleSyncDownloaded)
  window.addEventListener('sloty-subscriptions-updated', handleSyncDownloaded)

  let renderTimeout = null
  const debouncedRender = () => {
    if (renderTimeout) clearTimeout(renderTimeout)
    renderTimeout = setTimeout(() => {
      render()
    }, 150)
  }

  // Shell actions orchestrator
  const actions = {
    ACTIVATE_PUSH: async () => {
      const { subscribeToPushNotifications } = await import('./push.js');
      const s = getParkingState()
      const email = s.adminInfo?.email || 'admin@sloty.com'
      await subscribeToPushNotifications(s.buildingId, 'ADMIN', email)
    },
    CANCEL_MODAL: () => { 
      store.pendingAction = null; 
      render() 
    },
    TAB: (btn) => {
      store.activeTab = btn.dataset.tab
      if (store.activeTab === 'SETTINGS') store.activeSettingsMenu = 'MAIN'
      
      // Update tab selection styles immediately
      container.querySelectorAll('.admin-tab-btn').forEach(v => {
        const active = (v.dataset.tab === store.activeTab) || 
                       (store.activeTab === 'ABONOS' && v.dataset.tab === 'SUBS') ||
                       (store.activeTab === 'REPORTES' && v.dataset.tab === 'FINANCE')
        v.style.color = active ? '#F5C518' : 'rgba(255,255,255,0.4)'
      })
      render()
    },
    SYNC: async () => {
      const state = getParkingState();
      if (state.buildingCode) {
        await syncDown(state.buildingCode);
      }
      render();
      const btn = container.querySelector('[data-action="SYNC"]');
      if(btn) {
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform 0.5s';
        setTimeout(() => { btn.style.transform = 'rotate(0deg)'; btn.style.transition = 'none' }, 500);
      }
    },
    LOGOUT: () => {
      if (window.slotyLogout) window.slotyLogout()
      else {
        localStorage.clear()
        location.reload()
      }
    },
    CONFIRM_DELETE: () => {
      if (!store.pendingAction) return
      const state = getParkingState()
      if (store.pendingAction.type === 'LEVEL') {
        state.levels = state.levels.filter(l => l.name !== store.pendingAction.name)
      } else if (store.pendingAction.type === 'SLOT') {
        const level = state.levels.find(l => l.name === store.pendingAction.lName)
        if (level) level.slots = level.slots.filter(s => s.label !== store.pendingAction.sLabel)
      }
      saveParkingState(state)
      store.pendingAction = null
      render()
    }
  }

  // Bind actions from specialized submodules
  initUserActions(actions, container, render);
  initFinanceActions(actions, container, render);
  initStructureActions(actions, container, render);
  initGuardActions(actions, container, render);
  initSettingsActions(actions, container, render);

  window.handleAction = (type, payload) => {
    if (actions[type]) actions[type](payload)
  }

  container.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]')
    if (trigger) {
      const action = trigger.dataset.action
      if (actions[action]) {
        try {
          actions[action](trigger)
        } catch (err) {
          console.error('Error in action:', action, err)
        }
      }
    }
  })

  // ─── RENDERING LAYOUTS ─────────────────────────────────────
  const renderShell = (state) => {
    container.innerHTML = `
      <div id="admin-shell" style="background:#f8f9fa; min-height:100vh; font-family:var(--font); color:var(--primary); padding-bottom:120px;">
        <div id="admin-header"></div>
        <main id="admin-main" style="padding-top:10px;"></main>
        <div id="modal-layer" style="pointer-events:none;"></div>
        
        <nav id="admin-nav" style="position:fixed; bottom:0; left:0; width:100%; background:#1a1a2e; padding:10px 15px calc(env(safe-area-inset-bottom, 8px) + 8px); display:flex; justify-content:space-around; align-items:center; z-index:1000; box-shadow:0 -5px 30px rgba(0,0,0,0.2);">
          <div class="admin-tab-btn" data-action="TAB" data-tab="HOME" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">INICIO</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="STRUCTURE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">PISOS</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="SUBS" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <div style="width:22px; height:22px;">${ICONS.SUBS}</div>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">MENSUAL</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="FINANCE" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">CAJA</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="PERSONAL" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">PERSONAL</span>
          </div>
          <div class="admin-tab-btn" data-action="TAB" data-tab="SETTINGS" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color:rgba(255,255,255,0.4); transition:color 0.3s; flex:1;">
            <div style="width:22px; height:22px;">${ICONS.SETTINGS}</div>
            <span style="font-size:0.55rem; font-weight:800; letter-spacing:0.5px;">CONFIG</span>
          </div>
        </nav>
      </div>`
    elMain = container.querySelector('#admin-main')
  }

  const renderHeader = async (state) => {
    const header = container.querySelector('#admin-header')
    if (!header) return
    const unread = (state.notifications || []).filter(n => n.unread).length

    let metricHtml = ''
    if (store.activeTab === 'STRUCTURE') {
      const total = state.levels.reduce((acc, l) => acc + l.slots.length, 0)
      metricHtml = `<div class="header-status"><span>${total} PUESTOS</span></div>`
    } else if (store.activeTab === 'FINANCE') {
      const rev = (state.movements || []).filter(m => new Date(m.timestamp) >= new Date().setHours(0,0,0,0)).reduce((acc, m) => acc + (m.amount || 0), 0)
      metricHtml = `<div class="header-status" style="background:rgba(34,197,94,0.15); color:#22c55e;"><span>$${rev.toFixed(2)}</span></div>`
    } else if (store.activeTab === 'SUBS' || store.activeTab === 'ABONOS') {
      metricHtml = `<div class="header-status" id="sub-count-badge" style="background:rgba(59,130,246,0.15); color:#3b82f6;"><span>... RESIDENTES</span></div>`
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('building_id', state.buildingId)
        .then(({count}) => {
          const badge = container.querySelector('#sub-count-badge')
          if(badge) badge.innerHTML = `<span>${count || 0} RESIDENTES</span>`
        })
    }

    const titles = { STRUCTURE:'Pisos', SUBS:'Mensuales', FINANCE:'Caja', PERSONAL:'Personal', REPORTES:'Reportes', SETTINGS:'Auditoría', NOTIFICATIONS:'Notificaciones', PROFILE:'Perfil', ABONOS:'Abonos' }
    const isHome = store.activeTab === 'HOME'

    header.innerHTML = `
      <div style="background:#1a1a2e; padding:calc(env(safe-area-inset-top, 0px) + 15px) 20px 20px; color:white; position:sticky; top:0; z-index:1100; box-shadow:0 10px 30px rgba(0,0,0,0.2); box-sizing:border-box; width:100%;">
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div data-action="TAB" data-tab="HOME" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              ${!isHome ? `<div style="color:white; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px; height:22px; transform:translateX(-4px);"><path d="m15 18-6-6 6-6"/></svg>
              </div>` : ''}
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="/icons/Sloty logo negro.png" style="height:53px; filter:brightness(0) invert(1); object-fit:contain;" onerror="this.style.display='none'">
                ${state.logo_url ? `<img src="${state.logo_url}" style="height:35px; width:auto; max-width:60px; border-radius:6px; object-fit:contain;">` : ''}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <span id="admin-conn-status" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:${navigator.onLine ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)'}; color:${navigator.onLine ? '#22c55e' : '#ce8a05'}; border:1px solid ${navigator.onLine ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'};">
                 ● ${navigator.onLine ? 'En Línea' : 'Offline'}
              </span>
              <span id="admin-sync-queue" style="font-size:0.65rem; font-weight:900; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,0.06); color:#ce8a05; border:1px solid rgba(255,255,255,0.15); display:${getSyncQueueCount() > 0 ? 'inline-block' : 'none'};">
                 ⏳ Carga: <b id="admin-sync-count">${getSyncQueueCount()}</b>
              </span>
              <button data-action="SYNC" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.6); padding:0; display:flex; align-items:center; justify-content:center; transition:transform 0.5s;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              </button>
              <button data-action="TAB" data-tab="NOTIFICATIONS" style="position:relative; cursor:pointer; color:${unread ? '#F5C518' : 'white'}; background:none; border:none; padding:0; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                ${ICONS.BELL}
                ${unread ? `<div style="position:absolute; top:-2px; right:-2px; width:8px; height:8px; background:#e63946; border-radius:50%; border:2px solid #1a1a2e;"></div>` : ''}
              </button>
              <button data-action="LOGOUT" style="background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.6); padding:0; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                ${ICONS.LOGOUT}
              </button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <div style="font-size:0.75rem; font-weight:900; color:var(--accent); letter-spacing:1px; text-transform:uppercase;">
                ${isHome ? 'PANEL PRINCIPAL' : titles[store.activeTab].toUpperCase()}
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${(() => {
                  const plan = state.plan || 'TRIAL'
                  const planColors = { TRIAL:'#888', BRONCE:'#cd7f32', PLATA:'#aaa', ORO:'#F5C518' }
                  let upgradeBtn = ''
                  if (plan !== 'ORO') {
                    upgradeBtn = `<button data-action="SHOW_PLANS" class="gold-btn" style="padding:4px 10px; flex-shrink:0;"><span>🚀 UPGRADE</span></button>`
                  }
                  return `
                    <div style="font-size:0.55rem; font-weight:900; color:${planColors[plan] || '#888'}; letter-spacing:0.5px; background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:8px; flex-shrink:0;">PLAN ${plan}</div>
                    ${upgradeBtn}
                  `
                })()}
              </div>
            </div>
            ${metricHtml ? `<div style="align-self:flex-end;">${metricHtml}</div>` : ''}
          </div>
        </div>

        ${isHome ? `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:20px; margin-bottom:4px;">
            <div style="font-size:1.8rem; font-weight:900; line-height:1.1;">${escapeHTML(state.buildingName)}</div>
            <div data-action="TAB" data-tab="PROFILE" style="cursor:pointer; color:var(--accent); width:24px; height:24px;">
               ${ICONS.EDIT}
            </div>
          </div>
          <div style="font-size:0.75rem; font-weight:600; color:rgba(255,255,255,0.4); margin-bottom:20px;">${escapeHTML(state.adminInfo?.email || '')}</div>
          
          <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:18px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);">
            <div>
              <div style="font-size:0.55rem; font-weight:800; color:rgba(255,255,255,0.3); text-transform:uppercase; margin-bottom:4px; letter-spacing:1px;">CÓDIGO DE ACCESO</div>
              <div style="font-size:1.2rem; font-weight:900; color:var(--accent); letter-spacing:1px;">${escapeHTML(state.buildingCode)}</div>
            </div>
            <button onclick="navigator.clipboard.writeText('${state.buildingCode}'); this.textContent='✓'; setTimeout(()=>this.textContent='COPIAR',1500)" 
              style="background:rgba(255,255,255,0.1); color:white; border:none; padding:10px 18px; border-radius:12px; font-size:0.6rem; font-weight:900; cursor:pointer;">
              COPIAR
            </button>
          </div>
        ` : ''}
      </div>`
  }

  const renderModal = () => {
    const l = container.querySelector('#modal-layer')
    if (!l) return
    if (!store.pendingAction) {
      l.innerHTML = ''
      l.style.pointerEvents = 'none'
      return
    }
    l.style.pointerEvents = 'auto'
    
    if (store.pendingAction.type === 'LEVEL' || store.pendingAction.type === 'SLOT') {
      l.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; box-sizing:border-box;">
          <div style="background:white; border-radius:30px; width:100%; max-width:400px; padding:30px; box-shadow:0 25px 50px rgba(0,0,0,0.2); text-align:center;">
            <div style="font-size:3rem; margin-bottom:15px;">⚠️</div>
            <h3 style="font-weight:900; font-size:1.2rem; color:var(--primary); margin-bottom:10px;">¿CONFIRMA ELIMINACIÓN?</h3>
            <p style="color:#666; font-size:0.85rem; font-weight:700; line-height:1.5; margin-bottom:25px;">
              ${store.pendingAction.type === 'LEVEL' 
                ? `Esta acción eliminará permanentemente la planta <b>${escapeHTML(store.pendingAction.name)}</b> y todos sus puestos.`
                : `Esta acción eliminará el puesto <b>${escapeHTML(store.pendingAction.sLabel)}</b> de la planta <b>${escapeHTML(store.pendingAction.lName)}</b>.`}
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <button data-action="CONFIRM_DELETE" style="padding:16px; background:#e63946; color:white; border:none; border-radius:16px; font-weight:900; font-size:0.8rem; cursor:pointer;">ELIMINAR</button>
              <button data-action="CANCEL_MODAL" style="padding:16px; background:#f4f4f4; color:#666; border:none; border-radius:16px; font-weight:900; font-size:0.8rem; cursor:pointer;">CANCELAR</button>
            </div>
          </div>
        </div>`
    } else if (store.pendingAction.type === 'CUSTOM_MODAL') {
      l.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; box-sizing:border-box;">
          <div style="background:white; border-radius:30px; width:100%; max-width:400px; padding:30px; box-shadow:0 25px 50px rgba(0,0,0,0.2); text-align:center;">
            <h3 style="font-weight:900; font-size:1.2rem; color:var(--primary); margin-bottom:15px; text-transform:uppercase;">${store.pendingAction.title}</h3>
            <div style="margin-bottom:25px;">${store.pendingAction.content}</div>
            <button data-action="CANCEL_MODAL" style="width:100%; padding:18px; background:#1a1a2e; color:var(--accent); border:none; border-radius:16px; font-weight:900; font-size:0.8rem; cursor:pointer;">ENTENDIDO</button>
          </div>
        </div>`
    } else if (store.pendingAction.type === 'CONFIRM_MODAL') {
      l.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; box-sizing:border-box;">
          <div style="background:white; border-radius:30px; width:100%; max-width:400px; padding:30px; box-shadow:0 25px 50px rgba(0,0,0,0.2); text-align:center;">
            <h3 style="font-weight:900; font-size:1.2rem; color:var(--primary); margin-bottom:15px; text-transform:uppercase;">${store.pendingAction.title}</h3>
            <div style="margin-bottom:25px;">${store.pendingAction.content}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <button id="modal-confirm-action-btn" style="padding:16px; background:#1a1a2e; color:var(--accent); border:none; border-radius:16px; font-weight:900; font-size:0.8rem; cursor:pointer;">CONFIRMAR</button>
              <button data-action="CANCEL_MODAL" style="padding:16px; background:#f4f4f4; color:#666; border:none; border-radius:16px; font-weight:900; font-size:0.8rem; cursor:pointer;">CANCELAR</button>
            </div>
          </div>
        </div>`
      // Assign custom confirm action callback dynamically
      const btn = l.querySelector('#modal-confirm-action-btn')
      if (btn) btn.onclick = store.pendingAction.confirmAction
    }
  }

  const renderTabContent = async (state) => {
    if (!elMain) return; 
    let html = ''
    const renderingTab = store.activeTab;

    if (elMain.dataset.lastTab !== renderingTab) {
       const skeleton = SKELETONS[renderingTab] || SKELETONS.DEFAULT;
       elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
    }
    elMain.dataset.lastTab = renderingTab;

    switch(renderingTab) {
      case 'HOME': {
        if (!store.cachedMetrics || !window._cachedAds) {
          if (!store.metricsLoading) {
            Promise.all([
              loadHomeMetrics(),
              supabase.from('ads').select('id, title, content, type, timestamp, image_url').or(`building_id.is.null,building_id.eq.${state.buildingId}`).order('timestamp', { ascending: false })
            ]).then(([_, adsRes]) => {
              window._cachedAds = adsRes?.data || [];
              if (store.activeTab === 'HOME') render();
            });
          }
          const skeleton = SKELETONS.HOME;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderHome(state, window._cachedAds); 
        break;
      }
      case 'SUBS': {
        if (!store.cachedSubs) {
          getSubsCached(state.buildingId).then(() => {
            if (store.activeTab === 'SUBS' || store.activeTab === 'ABONOS') render();
          });
          const skeleton = SKELETONS.SUBS;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderMonthlySystem(state); 
        break;
      }
      case 'ABONOS': {
        if (!store.cachedSubs) {
          getSubsCached(state.buildingId).then(() => {
            if (store.activeTab === 'SUBS' || store.activeTab === 'ABONOS') render();
          });
          const skeleton = SKELETONS.DEFAULT;
          elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
          return;
        }
        html = await renderAbonos(state); 
        break;
      }
      case 'FINANCE': {
        if (!hasFeature('finance_module')) {
          html = renderLockedFeature('Módulo de Finanzas y Caja');
          break;
        }
        if (!store.cachedFinance || (Date.now() - store.cachedFinanceAt >= store.FINANCE_TTL)) {
          const nowObj = new Date();
          const monthStart = new Date(nowObj.getFullYear(), nowObj.getMonth(), 1).toISOString();
          const todayStr = new Date().toISOString().split('T')[0];
          
          Promise.all([
            supabase.from('payments').select('amount, method, payment_date, status').eq('building_id', state.buildingId).eq('status', 'CONFIRMED').gte('payment_date', monthStart),
            supabase.from('payments').select('amount, method').eq('building_id', state.buildingId).eq('status', 'CONFIRMED').gte('payment_date', todayStr),
            supabase.from('guard_shifts').select('id, guard_name, started_at, ended_at, total_cash, total_mobile, total_bs, entries, exits, absences').eq('building_id', state.buildingId).order('ended_at', { ascending: false }).limit(200)
          ]).then(([subsPayRes, todayPayRes, shiftsRes]) => {
            store.cachedFinance = {
              subsPays: subsPayRes?.data || [],
              todayPays: todayPayRes?.data || [],
              guardShifts: shiftsRes?.data || []
            };
            store.cachedFinanceAt = Date.now();
            if (store.activeTab === 'FINANCE') render();
          });

          if (!store.cachedFinance) {
            const skeleton = SKELETONS.FINANCE;
            elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${SKELETONS.pulse}${skeleton}</div>`;
            return;
          }
        }
        html = await renderFinanceSummary(state); 
        break;
      }
      case 'PERSONAL': html = renderPersonnel(state); break;
      case 'STRUCTURE': html = renderLevels(state); break;
      case 'REPORTES': {
        if (!hasFeature('reports_module')) {
          html = renderLockedFeature('Módulo de Reportes y Estadísticas');
          break;
        }
        html = await renderReports(state);
        break;
      }
      case 'SETTINGS': html = renderSettings(state); break;
      case 'NOTIFICATIONS': html = renderNotifications(); break;
      case 'PROFILE': html = renderProfile(state); break;
    }
    
    if (store.activeTab !== renderingTab) return;

    elMain.innerHTML = `<div class="responsive-container" style="padding-bottom:100px;">${html}</div>`; 
    if(renderingTab==='PERSONAL') setupGuardHooks(elMain)
    if(renderingTab==='ABONOS') setupAbonosHooks(elMain)
    if(renderingTab==='SUBS') setupMonthlySystemHooks(elMain)
  }

  const render = async () => {
    const s = getParkingState()
    if (!elMain) renderShell(s)
    renderHeader(s)
    renderModal()
    await renderTabContent(s); 
    
    // Sync tab styles
    container.querySelectorAll('.admin-tab-btn').forEach(v => {
      const active = (v.dataset.tab === store.activeTab) || 
                     (store.activeTab === 'ABONOS' && v.dataset.tab === 'SUBS') ||
                     (store.activeTab === 'REPORTES' && v.dataset.tab === 'FINANCE')
      v.style.color = active ? '#F5C518' : 'rgba(255,255,255,0.4)'
    })
  }

  // Carousel transition timer
  const carouselInterval = setInterval(() => {
    const t = container.querySelector('#main-carousel')
    if (t && t.children.length > 1) {
       window._cIdx = ((window._cIdx || 0) + 1) % t.children.length;
       t.style.transform = `translateX(-${window._cIdx * 100}%)`
    }
  }, 4000)

  // Realtime: Listen to incoming pending payments from guard
  const realtimeChannel = supabase
    .channel('admin-payments-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'payments',
      filter: `status=eq.PENDING`
    }, (payload) => {
      const currentState = getParkingState()
      if (payload.new.building_id !== currentState.buildingId) return
      showToast('💰 Nuevo pago pendiente de aprobación', 'info')
      if (store.activeTab === 'HOME') debouncedRender()
    })
    .subscribe()

  // Cleanup references on view close
  container._cleanup = () => {
    clearInterval(carouselInterval);
    realtimeChannel.unsubscribe();
    unsubscribeFinanceRealtime();
    window.removeEventListener('sloty-sync-updated', handleSyncUpdated);
    window.removeEventListener('sloty-connection-status', handleConnectionStatus);
  }

  // Initial data loading
  render();
  Promise.all([
    loadHomeMetrics(),
    getExchangeRate().catch(e => console.warn('Failed to load BCV rate on start:', e))
  ]).then(async ([_, bcv]) => {
    store.currentBcv = bcv || store.currentBcv;
    await render();
    const state = getParkingState();
    
    // Check onboarding
    if (shouldShowOnboarding(state)) {
      const wizardHost = document.createElement('div');
      wizardHost.id = 'onboarding-wizard-host';
      document.body.appendChild(wizardHost);
      renderOnboardingWizard(wizardHost, state, () => {
        render();
      });
    }

    setTimeout(() => checkExpiringSubscriptions(state.buildingId), 2000);
  });
}
