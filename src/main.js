import { login, getSession, getUserRole, setDevRole } from './auth.js'
import { supabase } from './db.js'
import { initGuard } from './modules/guard.js'
import { initAdmin } from './modules/admin.js'
import { initMaster } from './modules/master.js'
import { getParkingState, saveParkingState, getCleanPrefix, syncDown } from './db.js'
import { initUpdateBanner } from './pwa-update.js'

const $ = id => document.getElementById(id)

const renderAlert = (msg, isError = false) => {
  const layer = document.createElement('div');
  layer.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:24px;';
  layer.innerHTML = `
    <div style="background:white; padding:35px 25px; border-radius:32px; width:100%; max-width:340px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.3); transform: scale(0.9); animation: modalIn 0.3s forwards cubic-bezier(0.17, 0.89, 0.32, 1.28);">
      <div style="font-size:3.5rem; margin-bottom:15px;">${isError ? '❌' : '✅'}</div>
      <div style="font-weight:900; color:#1a1a2e; font-size:1.2rem; line-height:1.3; margin-bottom:25px; font-family:'Montserrat',sans-serif;">${msg}</div>
      <button id="alert-close-btn" style="width:100%; padding:18px; background:#1a1a2e; color:var(--accent); border:none; border-radius:18px; font-weight:900; font-size:0.9rem; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">ENTENDIDO</button>
    </div>
    <style>
      @keyframes modalIn { to { transform: scale(1); } }
    </style>
  `;
  document.body.appendChild(layer);
  layer.querySelector('#alert-close-btn').onclick = () => layer.remove();
}

const renderSuspendedScreen = () => `
  <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1a1a2e; color:white; text-align:center; padding:40px;">
    <div style="font-size:3rem; margin-bottom:20px;">🚫</div>
    <div style="font-size:1.2rem; font-weight:900; color:#e63946; text-transform:uppercase; letter-spacing:2px;">Servicio Suspendido</div>
    <div style="font-size:0.8rem; color:rgba(255,255,255,0.5); margin-top:12px; font-weight:700;">Contacta al administrador del sistema.</div>
  </div>
`;

const screens = {
  welcome: $('welcome-screen'),
  login: $('login-screen'),
  register: $('register-screen'),
  guardPin: $('guard-pin-screen'),
  residentPanel: $('resident-screen'),
  main: $('main-screen')
}

const showOnly = (name) => {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name)
  })
}

// ─── WELCOME SCREEN ───────────────────────────────────────────
const renderWelcome = () => {
  screens.welcome.innerHTML = `
    <div style="min-height:100vh;min-height:100dvh;background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top, 40px) 24px env(safe-area-inset-bottom, 40px); position: relative; overflow: hidden;">
      <!-- Decorative background elements -->
      <div style="position: absolute; top: -10%; left: -10%; width: 50vw; height: 50vw; background: radial-gradient(circle, rgba(245,197,24,0.1) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none;"></div>
      <div style="position: absolute; bottom: -10%; right: -10%; width: 60vw; height: 60vw; background: radial-gradient(circle, rgba(15,52,96,0.5) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none;"></div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;gap:15px; z-index: 1;">
        <img src="/sloty-logo-v2.png" alt="Sloty" style="width:75%;max-width:300px;height:auto;display:block;margin:0 auto; filter: drop-shadow(0px 10px 20px rgba(0,0,0,0.5));" />
        <p aria-label="Gestión inteligente de estacionamientos" style="color:rgba(255,255,255,0.85);font-size:0.85rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:10px 0 0;text-align:center;">GESTIÓN INTELIGENTE DE<br>ESTACIONAMIENTOS</p>
      </div>
      <div style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:14px;padding-bottom:20px;">
        <button id="btn-goto-register" style="width:100%;padding:20px;background:#F5C518;color:#1a1a2e;border:none;border-radius:18px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;letter-spacing:1px;">
          REGISTRAR MI EDIFICIO
        </button>
        <button id="btn-goto-login" style="width:100%;padding:20px;background:transparent;color:white;border:2px solid rgba(255,255,255,0.2);border-radius:18px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:700;cursor:pointer;">
          INICIAR SESIÓN
        </button>
        <div style="display:flex; gap:10px; width:100%;">
          <button id="btn-goto-guard-code" style="flex:1;padding:14px;background:transparent;color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.15);font-family:'Montserrat',sans-serif;font-size:0.75rem;font-weight:700;cursor:pointer;letter-spacing:1px;border-radius:14px;">
            SOY GUARDIA →
          </button>
          <button id="btn-goto-resident-login" style="flex:1;padding:14px;background:rgba(255,255,255,0.05);color:var(--accent);border:1px solid var(--accent);font-family:'Montserrat',sans-serif;font-size:0.75rem;font-weight:900;cursor:pointer;letter-spacing:1px;border-radius:14px;">
            SOY RESIDENTE 🏠
          </button>
        </div>
        <p aria-hidden="true" tabindex="-1" style="color:rgba(255,255,255,0.35);font-size:0.65rem;font-weight:600;text-align:center;letter-spacing:2px;margin-top:4px;">POWERED BY KREIKA</p>
      </div>
    </div>
  `
  $('btn-goto-register').onclick = () => { renderRegister(); showOnly('register') }
  $('btn-goto-login').onclick = () => { renderLogin(); showOnly('login') }
  $('btn-goto-guard-code').onclick = () => { renderGuardBuildingCode(); showOnly('login') }
  $('btn-goto-resident-login').onclick = () => { renderResidentLogin(); showOnly('login') }
}

const renderGuardBuildingCode = () => {
  screens.login.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-welcome-guard" style="position:absolute;top:24px;left:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div style="margin-bottom:32px;text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">🛡️</div>
        <h2 style="color:white; font-weight:900;">ACCESO GUARDIA</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Ingresa el código del edificio</p>
      </div>
      <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
        <input type="text" id="guard-bld-code" placeholder="EJ: SLO-1234" 
          style="width:100%;padding:18px;border-radius:12px;border:2px solid #F5C518;background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.2rem;font-weight:900;text-align:center;outline:none;" />
        <button id="btn-submit-guard-code" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
          CONTINUAR
        </button>
        <p id="guard-code-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
      </div>
    </div>
  `
  $('btn-back-welcome-guard').onclick = () => { renderWelcome(); showOnly('welcome') }
  $('btn-submit-guard-code').onclick = async () => {
    const code = $('guard-bld-code').value.trim().toUpperCase()
    if(!code) return
    $('btn-submit-guard-code').textContent = 'Buscando...'
    const { data, error } = await supabase.from('buildings').select('*').eq('code', code).single()
    if (error || !data) {
      $('guard-code-error').textContent = 'Código no encontrado'
      $('btn-submit-guard-code').textContent = 'CONTINUAR'
      return
    }
    // Save state for persistence and sync
    localStorage.setItem('sloty_active_building', data.code)
    localStorage.setItem('sloty_building_id', data.id)
    localStorage.setItem('sloty_building_name', data.name)
    
    localStorage.setItem('sloty_state', JSON.stringify({ 
      buildingId: data.id, 
      buildingName: data.name, 
      buildingCode: data.code, 
      levels: [], personnel: [], movements: [] 
    }))

    await syncDown(data.code)
    setDevRole('GUARD')
    renderGuardPin()
    showOnly('guardPin')
  }
}

const renderResidentLogin = () => {
  screens.login.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-welcome-res" style="position:absolute;top:24px;left:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div style="margin-bottom:32px;text-align:center;">
        <div style="font-size:3rem; margin-bottom:10px;">🏠</div>
        <h2 style="color:white; font-weight:900;">ACCESO RESIDENTE</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Identifícate con tu vehículo</p>
      </div>
      <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
        <input type="text" id="res-plate" placeholder="PLACA DEL VEHÍCULO" 
          style="width:100%;padding:18px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;text-transform:uppercase;" />
        <input type="password" id="res-pin" placeholder="PIN DE ACCESO" maxlength="4"
          style="width:100%;padding:18px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;" />
        
        <button id="btn-submit-res-login" style="width:100%;padding:18px;background:var(--accent);color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
          ENTRAR AL PANEL
        </button>
        <p id="res-login-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
      </div>
    </div>
  `
  document.getElementById('btn-back-welcome-res').onclick = () => { renderWelcome(); showOnly('welcome') }
  document.getElementById('btn-submit-res-login').onclick = async () => {
    const plate = document.getElementById('res-plate').value.trim().toUpperCase()
    const pin = document.getElementById('res-pin').value.trim()
    if(!plate || !pin) return
    
    document.getElementById('btn-submit-res-login').textContent = 'Verificando...'
    const { data, error } = await supabase.from('subscriptions').select('*').eq('plate', plate).eq('pin', pin).single()
    
    // BYPASS DESARROLLO: Si no existe, creamos uno temporal para ver el panel
    if (error || !data) {
       console.log('Modo Desarrollo: Creando sesión temporal de residente');
       const mockSub = {
         id: 'mock-id',
         resident_name: 'Residente de Prueba',
         plate: plate || 'TEST-123',
         pin: pin,
         expiry_date: new Date(Date.now() + 30*86400000).toISOString(),
         slots_count: 1,
         custom_price: 50,
         is_coming: false
       }
       import('./modules/resident.js').then(m => {
          m.initResident(screens.residentPanel, mockSub)
          showOnly('residentPanel')
       })
       return
    }

    import('./modules/resident.js').then(m => {
       m.initResident(screens.residentPanel, data)
       showOnly('residentPanel')
    })
  }
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────
const renderLogin = () => {
  screens.login.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-login" style="position:absolute;top:24px;left:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div style="margin-bottom:32px;text-align:center;">
        <img src="/sloty-logo-v2.png" alt="Sloty" style="width:180px;height:auto;display:block;margin:0 auto 8px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Panel Administrador</p>
      </div>
      <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
        <input type="text" id="login-email" placeholder="Correo electrónico / Usuario" 
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;" />
        <input type="password" id="login-password" placeholder="Contraseña"
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;" />
        
        <div id="role-selector" style="display:flex;gap:8px;">
          <button class="role-chip" data-role="ADMIN" style="flex:1;padding:10px;border-radius:10px;border:2px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.5);font-weight:700;cursor:pointer;font-size:0.75rem;">Admin</button>
          <button class="role-chip" data-role="MASTER" style="flex:1;padding:10px;border-radius:10px;border:2px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.5);font-weight:700;cursor:pointer;font-size:0.75rem;">Master</button>
        </div>

        <button id="btn-login" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
          ENTRAR
        </button>
        <p id="login-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;text-align:center;">
          <a href="#" id="goto-register" style="color:#F5C518;font-size:0.85rem;font-weight:900;text-decoration:none;">REGISTRAR NUEVO EDIFICIO</a>
        </div>
      </div>
    </div>
  `
  $('goto-register').onclick = () => { renderRegister(); showOnly('register') }
  $('btn-back-login').onclick = () => { renderWelcome(); showOnly('welcome') }

  let selectedRole = 'ADMIN';

  const chips = screens.login.querySelectorAll('.role-chip')
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.style.background = 'transparent'
        c.style.borderColor = 'rgba(255,255,255,0.2)'
        c.style.color = 'rgba(255,255,255,0.5)'
        c.style.fontWeight = '700'
      })
      chip.style.background = '#F5C518'
      chip.style.borderColor = '#F5C518'
      chip.style.color = '#1a1a2e'
      chip.style.fontWeight = '900'
      selectedRole = chip.dataset.role
      setDevRole(selectedRole)
    })
  })

  // Activar Admin por defecto visualmente
  chips[0].click()

  $('btn-login').onclick = async () => {
    const email = $('login-email').value.trim()
    const errorEl = $('login-error')
    
    // Clear error & styling
    errorEl.style.color = 'white'
    errorEl.textContent = ''
    
    // Check which role is selected
    const isMaster = selectedRole === 'MASTER'
    
    // Dynamic loading phrases
    const phrases = ['Conectando...', 'Preparando experiencia...', 'Cargando tu panel...', 'Casi listos...'];
    let phraseId = 0;
    const interval = setInterval(() => {
      errorEl.textContent = phrases[phraseId % phrases.length];
      phraseId++;
    }, 800);
    
    $('btn-login').disabled = true

    try {
      let building;
      if (email && !isMaster) {
        try {
          const { data } = await supabase
            .from('buildings')
            .select('*')
            .eq('admin_email', email)
            .maybeSingle()
          building = data;
        } catch (e) {
          console.warn('Supabase fetch failed, will use fallback mock', e)
        }
      }

      // DEV BYPASS: always bypass if not found
      let resolvedBuilding = building
      if (!resolvedBuilding && !isMaster) {
        try {
          const { data: fallback } = await supabase
            .from('buildings')
            .select('*')
            .limit(1)
            .maybeSingle()
          resolvedBuilding = fallback
        } catch (e) {
          console.warn('Fallback fetch failed too')
        }
        
        if (!resolvedBuilding) {
           console.warn('No buildings in DB or DB unreachable. Creating DEV mock building.')
           resolvedBuilding = {
             id: 'test-building-id',
             name: 'Edificio de Prueba',
             code: 'DEV-123',
             plan: 'ORO',
             membership_status: 'ACTIVE',
             admin_email: email || 'admin@test.com'
           }
        }
      }
      
      clearInterval(interval);
      errorEl.textContent = '';

      // Mostrar panel inmediatamente
      showOnly('main')
      const mainScreen = $('main-screen')

      if (isMaster) {
          initMaster(mainScreen);
          return
      }

      // Guardar estado mínimo ADMIN
      const newState = {
        buildingId: resolvedBuilding.id,
        buildingName: resolvedBuilding.name,
        buildingCode: resolvedBuilding.code,
        plan: resolvedBuilding.plan || 'ORO',
        membership_status: resolvedBuilding.membership_status || 'ACTIVE',
        adminInfo: { email: resolvedBuilding.admin_email, registered: true },
        levels: [], personnel: [], movements: []
      }
      localStorage.setItem('sloty_state', JSON.stringify(newState))

      // --- NUEVAS VALIDACIONES DE MEMBRESÍA ---
      
      // 1. Bloqueo por pago pendiente
      if (resolvedBuilding.membership_status === 'PENDING_CASH' || resolvedBuilding.membership_status === 'PENDING_PROOF') {
          const type = resolvedBuilding.membership_status === 'PENDING_CASH' ? 'CASH' : 'PROOF'
          const planObj = { label: resolvedBuilding.plan || 'Plan Seleccionado', price: 'Pendiente de cobro' }
          renderPendingScreen(type, planObj)
          return
      }

      // 2. Validación de Trial (3 días)
      if (resolvedBuilding.plan === 'TRIAL') {
          const start = new Date(resolvedBuilding.trial_started_at || resolvedBuilding.created_at)
          const now = new Date()
          const diffDays = Math.ceil((now - start) / (1000 * 60 * 60 * 24))
          
          if (diffDays > 3) {
              mainScreen.innerHTML = `
                <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;">
                  <div style="font-size:4rem;margin-bottom:20px;">⌛</div>
                  <h1 style="color:white;font-size:1.6rem;font-weight:900;margin-bottom:10px;">¡Trial Expirado!</h1>
                  <p style="color:rgba(255,255,255,0.5);font-size:0.95rem;margin-bottom:30px;max-width:320px;">
                    Tus 3 días de prueba han terminado. Activa un plan para seguir gestionando tu edificio.
                  </p>
                  <button onclick="location.reload()" style="padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-weight:900;cursor:pointer;width:100%;max-width:300px;">
                    VER PLANES DISPONIBLES
                  </button>
                </div>
              `
              return
          }
          // Guardar días restantes para el banner en el panel admin
          newState.trialDaysLeft = 3 - (diffDays - 1)
          localStorage.setItem('sloty_state', JSON.stringify(newState))
      }

      // Iniciar panel sin esperar syncDown
      initAdmin(mainScreen)

      // syncDown en background — no bloquea la UI
      syncDown(resolvedBuilding.code).catch(e => console.warn('syncDown error:', e))

    } catch (err) {
      clearInterval(interval);
      errorEl.style.color = '#e63946';
      errorEl.textContent = 'Error de conexión'
      $('btn-login').disabled = false
      console.error(err)
    }
  }
}

// ─── REGISTER SCREEN (ONBOARDING) ─────────────────────────────
const renderRegister = () => {
  let step = 1
  const data = {}

  const steps = [
    {
      title: 'Bienvenido a Sloty',
      subtitle: '¿Cómo se llama tu edificio o estacionamiento?',
      field: `<input id="reg-field" type="text" placeholder="Ej. Edificio Las Danielas" maxlength="50"
        style="width:100%;padding:18px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:700;outline:none;text-align:center;" />`,
      key: 'buildingName',
      validate: v => v.length > 2
    },
    {
      title: 'Tu información',
      subtitle: '¿Cuál es tu nombre como administrador?',
      field: `<input id="reg-field" type="text" placeholder="Tu nombre completo"
        style="width:100%;padding:18px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:white;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:600;outline:none;text-align:center;" />`,
      key: 'adminName',
      validate: v => v.length > 2
    },
    {
      title: 'Acceso seguro',
      subtitle: 'Crea tu correo y contraseña de administrador',
      field: `
        <input id="reg-email" type="email" placeholder="Correo electrónico"
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;margin-bottom:12px;" />
        <input id="reg-password" type="password" placeholder="Contraseña (mín. 6 caracteres)"
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;" />
      `,
      key: 'credentials',
      validate: () => {
        const e = $('reg-email')?.value.trim()
        const p = $('reg-password')?.value.trim()
        return e && e.length > 0 && p && p.length > 0
      }
    },
    {
      title: '¿Cuántos niveles tiene?',
      subtitle: 'Podrás ajustar esto después desde el panel',
      field: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${['1 Nivel','2 Niveles','3 Niveles','4+ Niveles'].map((l,i) => `
            <button class="level-opt" data-val="${i+1}"
              style="padding:20px 10px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:transparent;color:white;font-family:'Montserrat',sans-serif;font-weight:700;cursor:pointer;font-size:0.9rem;">
              ${l}
            </button>
          `).join('')}
        </div>
      `,
      key: 'levels',
      validate: () => data.levels != null,
      noInput: true
    }
  ]

  const render = () => {
    const s = steps[step - 1]
    const progress = (step / steps.length) * 100
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;padding:40px 24px;">
        <div style="display:flex;align-items:center;margin-bottom:32px;">
          <button id="btn-reg-back" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;padding:0;margin-right:16px;">←</button>
          <div style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:4px;">
            <div style="height:100%;width:${progress}%;background:#F5C518;border-radius:4px;transition:width 0.3s;"></div>
          </div>
          <span style="color:rgba(255,255,255,0.3);font-size:0.75rem;font-weight:700;margin-left:12px;">${step}/${steps.length}</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:340px;margin:0 auto;width:100%;">
          <h1 style="color:white;font-size:1.8rem;font-weight:900;margin-bottom:8px;line-height:1.2;">${s.title}</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:0.9rem;margin-bottom:32px;">${s.subtitle}</p>
          <div id="reg-field-container">${s.field}</div>
          <p id="reg-error" style="color:#e63946;font-size:0.8rem;font-weight:700;margin-top:12px;min-height:18px;"></p>
          <button id="btn-reg-next" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:24px;">
            ${step === steps.length ? 'CREAR MI CUENTA' : 'CONTINUAR →'}
          </button>
        </div>
      </div>
    `

    $('btn-reg-back').onclick = () => {
      if (step === 1) { showOnly('welcome') }
      else { step--; render() }
    }

    // Level selector
    if (s.noInput) {
      screens.register.querySelectorAll('.level-opt').forEach(btn => {
        btn.onclick = () => {
          screens.register.querySelectorAll('.level-opt').forEach(b => {
            b.style.background = 'transparent'
            b.style.borderColor = 'rgba(255,255,255,0.15)'
            b.style.color = 'white'
          })
          btn.style.background = '#F5C518'
          btn.style.borderColor = '#F5C518'
          btn.style.color = '#1a1a2e'
          data.levels = parseInt(btn.dataset.val)
        }
      })
    }

    $('btn-reg-next').onclick = async () => {
      if (s.key === 'credentials') {
        data.email = $('reg-email').value.trim()
        data.password = $('reg-password').value.trim()
      } else if (!s.noInput) {
        data[s.key] = $('reg-field').value.trim()
      }
      if (!s.validate(data[s.key])) {
        $('reg-error').textContent = 'Por favor completa este campo correctamente'
        return
      }
      if (step < steps.length) {
        step++; render()
      } else {
        await finishRegister()
      }
    }

    // Bloquear reinicio por tecla ENTER en móviles
    const inputs = screens.register.querySelectorAll('input');
    inputs.forEach(input => {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('btn-reg-next').click();
        }
      };
    });
  }

  const finishRegister = async () => {
    $('btn-reg-next').textContent = 'Creando edificio...'
    $('btn-reg-next').disabled = true
    
    try {
      const code = `${getCleanPrefix(data.buildingName)}-${Math.floor(1000 + Math.random() * 9000)}`
      
      const { data: bld, error } = await supabase.from('buildings').insert([{
        name: data.buildingName,
        code: code,
        admin_email: data.email,
        plan: 'TRIAL',
        membership_status: 'ACTIVE'
      }]).select().single()

      if (error) throw error

      // 2. Sync local state
      const state = getParkingState()
      state.buildingId = bld.id
      state.buildingName = bld.name
      state.buildingCode = bld.code
      state.plan = 'TRIAL'
      state.membership_status = 'ACTIVE'
      state.adminInfo = { name: data.adminName, email: data.email, registered: true }
      saveParkingState(state)

      renderOnboardingFloor(bld)
    } catch (err) {
      console.error(err)
      $('btn-reg-next').textContent = 'CREAR MI CUENTA'
      $('btn-reg-next').disabled = false
      $('reg-error').textContent = 'Error al crear edificio. Intenta de nuevo.'
    }
  }

  const renderOnboardingFloor = (building) => {
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;padding:40px 24px;justify-content:center;align-items:center;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:3rem;margin-bottom:16px;">🏢</div>
          <h1 style="color:white;font-size:1.6rem;font-weight:900;margin-bottom:8px;">¡Edificio Creado!</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:0.9rem;">Ahora configuremos tu primer nivel para comenzar.</p>
        </div>

        <div style="width:100%;max-width:340px;background:rgba(255,255,255,0.05);padding:24px;border-radius:24px;border:1.5px solid #F5C518;">
          <label style="color:#F5C518;font-size:0.65rem;font-weight:900;display:block;margin-bottom:12px;letter-spacing:1px;">NOMBRE DEL PISO</label>
          <input id="onboard-floor-name" type="text" placeholder="Ej: Planta Baja" value="Planta Baja"
            style="width:100%;padding:16px;border-radius:12px;border:none;background:rgba(255,255,255,0.1);color:white;font-family:var(--font);font-weight:700;outline:none;margin-bottom:20px;" />
          
          <label style="color:#F5C518;font-size:0.65rem;font-weight:900;display:block;margin-bottom:12px;letter-spacing:1px;">CANTIDAD DE PUESTOS</label>
          <input id="onboard-slots-count" type="number" placeholder="Ej: 10" value="10"
            style="width:100%;padding:16px;border-radius:12px;border:none;background:rgba(255,255,255,0.1);color:white;font-family:var(--font);font-weight:700;outline:none;" />
        </div>

        <button id="btn-finish-onboarding" style="width:100%;max-width:340px;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:32px;">
          CREAR PISO Y ENTRAR →
        </button>
      </div>
    `

    $('btn-finish-onboarding').onclick = async () => {
      const floorName = $('onboard-floor-name').value.trim() || 'Nivel 1'
      const count = parseInt($('onboard-slots-count').value) || 10
      
      $('btn-finish-onboarding').textContent = 'Generando puestos...'
      $('btn-finish-onboarding').disabled = true

      const state = getParkingState()
      const newLevel = { name: floorName, slots: [], collapsed: false }
      
      for(let i=1; i<=count; i++) {
        newLevel.slots.push({ label: `${i}`, status: 'FREE', category: 'VISITANTE' })
      }
      
      state.levels = [newLevel]
      saveParkingState(state)

      // Guardar puestos en Supabase
      const payload = newLevel.slots.map(s => ({
        building_id: building.id,
        level_name: floorName,
        slot_label: s.label,
        status: 'FREE',
        category: 'VISITANTE'
      }))

      await supabase.from('parking_slots').insert(payload)

      renderPlanSelection(building)
    }
  }

  // ─── PLAN SELECTION ──────────────────────────────────────────
  const renderPlanSelection = (building) => {
    const PLANS = [
      { key: 'TRIAL',  label: 'Prueba Gratis',  price: 'GRATIS', days: '3 días', desc: 'Hasta 10 puestos', color: '#888',    highlight: false },
      { key: 'BRONCE', label: 'Bronce',          price: '$15/mes',  days: null,    desc: 'Hasta 50 puestos', color: '#cd7f32', highlight: false },
      { key: 'PLATA',  label: 'Plata',           price: '$30/mes',  days: null,    desc: 'Hasta 150 puestos + Caja', color: '#aaa', highlight: false },
      { key: 'ORO',    label: 'Oro',             price: '$55/mes',  days: null,    desc: 'Ilimitado + todos los módulos', color: '#F5C518', highlight: true },
    ]
    let selectedPlan = null

    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;padding:40px 24px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:2.5rem;margin-bottom:10px;">✨</div>
          <h1 style="color:white;font-size:1.6rem;font-weight:900;margin-bottom:6px;">Elige tu Plan</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">Puedes cambiar de plan en cualquier momento</p>
        </div>
        <div style="display:grid;gap:12px;max-width:400px;width:100%;margin:0 auto 28px;">
          ${PLANS.map(p => `
            <div class="plan-card" data-key="${p.key}" style="
              background:${p.highlight ? 'rgba(245,197,24,0.1)' : 'rgba(255,255,255,0.05)'};
              border:2px solid ${p.highlight ? '#F5C518' : 'rgba(255,255,255,0.1)'};
              border-radius:18px;padding:18px 20px;cursor:pointer;
              display:flex;justify-content:space-between;align-items:center;
              transition:all 0.2s;">
              <div>
                <div style="font-size:1rem;font-weight:900;color:${p.color};">${p.label}</div>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:4px;">${p.desc}</div>
                ${p.days ? '<div style="font-size:0.65rem;color:#22c55e;font-weight:700;margin-top:2px;">' + p.days + ' gratis</div>' : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:1rem;font-weight:900;color:white;">${p.price}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div style="max-width:400px;width:100%;margin:0 auto;">
          <button id="btn-select-plan" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;opacity:0.4;pointer-events:none;">
            CONTINUAR CON ESTE PLAN
          </button>
        </div>
      </div>
    `

    screens.register.querySelectorAll('.plan-card').forEach(card => {
      card.onclick = () => {
        screens.register.querySelectorAll('.plan-card').forEach(c => {
          c.style.background = 'rgba(255,255,255,0.05)'
          c.style.borderColor = 'rgba(255,255,255,0.1)'
        })
        card.style.background = 'rgba(245,197,24,0.15)'
        card.style.borderColor = '#F5C518'
        selectedPlan = PLANS.find(p => p.key === card.dataset.key)
        const btn = document.getElementById('btn-select-plan')
        btn.style.opacity = '1'
        btn.style.pointerEvents = 'auto'
      }
    })

    document.getElementById('btn-select-plan').onclick = async () => {
      if (!selectedPlan) return
      if (selectedPlan.key === 'TRIAL') {
        // Activar trial directo
        await supabase.from('buildings').update({
          plan: 'TRIAL',
          membership_status: 'ACTIVE',
          trial_started_at: new Date().toISOString()
        }).eq('id', building.id)
        const state = getParkingState()
        state.plan = 'TRIAL'
        state.membership_status = 'ACTIVE'
        saveParkingState(state)
        showOnly('main')
        initAdmin(screens.main)
      } else {
        renderPaymentMethod(building, selectedPlan)
      }
    }
  }

  // ─── PAYMENT METHOD SELECTION ─────────────────────────────────
  const renderPaymentMethod = (building, plan) => {
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;padding:40px 24px;justify-content:center;align-items:center;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:2.5rem;margin-bottom:10px;">💳</div>
          <h1 style="color:white;font-size:1.4rem;font-weight:900;margin-bottom:6px;">Método de Pago</h1>
          <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;">Plan <strong style="color:#F5C518;">${plan.label}</strong> · ${plan.price}</p>
        </div>
        <div style="display:grid;gap:14px;width:100%;max-width:380px;">
          <button id="pay-cash" style="
            padding:24px;border-radius:18px;border:2px solid rgba(255,255,255,0.15);
            background:rgba(255,255,255,0.05);color:white;cursor:pointer;
            font-family:'Montserrat',sans-serif;font-weight:900;font-size:0.95rem;text-align:left;">
            <div style="font-size:1.5rem;margin-bottom:8px;">💵</div>
            <div>Efectivo</div>
            <div style="font-size:0.7rem;font-weight:500;color:rgba(255,255,255,0.4);margin-top:4px;">El equipo de Sloty te contactará para coordinar el pago</div>
          </button>
          <button id="pay-transfer" style="
            padding:24px;border-radius:18px;border:2px solid #F5C518;
            background:rgba(245,197,24,0.08);color:white;cursor:pointer;
            font-family:'Montserrat',sans-serif;font-weight:900;font-size:0.95rem;text-align:left;">
            <div style="font-size:1.5rem;margin-bottom:8px;">📱</div>
            <div>Pago Móvil / Transferencia</div>
            <div style="font-size:0.7rem;font-weight:500;color:#F5C518;margin-top:4px;">Sube tu comprobante para revisión inmediata</div>
          </button>
        </div>
      </div>
    `

    document.getElementById('pay-cash').onclick = async () => {
      await supabase.from('buildings').update({
        plan: plan.key, membership_status: 'PENDING_CASH',
        pending_plan: plan.key
      }).eq('id', building.id)
      renderPendingScreen('CASH', plan)
    }

    document.getElementById('pay-transfer').onclick = () => {
      renderProofUpload(building, plan)
    }
  }

  // ─── PROOF UPLOAD ─────────────────────────────────────────────
  const renderProofUpload = (building, plan) => {
    let proofBase64 = null
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;padding:40px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:2rem;margin-bottom:8px;">📄</div>
          <h1 style="color:white;font-size:1.3rem;font-weight:900;margin-bottom:4px;">Subir Comprobante</h1>
          <p style="color:rgba(255,255,255,0.4);font-size:0.75rem;">Plan ${plan.label} · ${plan.price}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;max-width:400px;width:100%;margin:0 auto;">
          <input id="proof-amount" type="number" placeholder="Monto pagado ($)" step="0.01" min="0"
            style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:700;outline:none;box-sizing:border-box;" />
          <input id="proof-ref" type="text" placeholder="Número de referencia / confirmación"
            style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.9rem;font-weight:600;outline:none;box-sizing:border-box;" />
          <input id="proof-date" type="date" placeholder="Fecha del pago"
            style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.9rem;outline:none;box-sizing:border-box;color-scheme:dark;" />
          
          <input type="file" id="proof-file" accept="image/*" style="display:none;" />
          <div id="proof-thumb" style="display:none;width:100%;border-radius:12px;overflow:hidden;margin-top:4px;">
            <img id="proof-img" style="width:100%;max-height:200px;object-fit:contain;background:rgba(255,255,255,0.05);" />
          </div>
          <button id="btn-proof-upload" style="width:100%;padding:16px;border-radius:12px;border:2px dashed rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.6);font-family:'Montserrat',sans-serif;font-weight:700;cursor:pointer;font-size:0.85rem;">
            📸 Adjuntar foto del comprobante
          </button>
          <button id="btn-proof-send" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
            ENVIAR COMPROBANTE
          </button>
          <p id="proof-error" style="color:#e63946;font-size:0.8rem;font-weight:700;text-align:center;min-height:18px;"></p>
        </div>
      </div>
    `

    document.getElementById('btn-proof-upload').onclick = () => document.getElementById('proof-file').click()
    document.getElementById('proof-file').onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        proofBase64 = ev.target.result
        document.getElementById('proof-img').src = proofBase64
        document.getElementById('proof-thumb').style.display = 'block'
        document.getElementById('btn-proof-upload').textContent = '✅ Foto adjuntada'
      }
      reader.readAsDataURL(file)
    }

    document.getElementById('btn-proof-send').onclick = async () => {
      const amount = parseFloat(document.getElementById('proof-amount').value) || 0
      const ref = document.getElementById('proof-ref').value.trim()
      const date = document.getElementById('proof-date').value
      const errEl = document.getElementById('proof-error')
      if (amount <= 0) { errEl.textContent = 'Ingresa el monto pagado'; return }
      if (!ref) { errEl.textContent = 'Ingresa el número de referencia'; return }
      if (!proofBase64) { errEl.textContent = 'Adjunta la foto del comprobante'; return }

      document.getElementById('btn-proof-send').textContent = 'Enviando...'
      document.getElementById('btn-proof-send').disabled = true

      await supabase.from('building_payment_proofs').insert({
        building_id: building.id, plan_key: plan.key,
        amount, reference: ref, payment_date: date,
        proof_image: proofBase64, status: 'PENDING'
      })
      await supabase.from('buildings').update({
        membership_status: 'PENDING_PROOF', plan: plan.key
      }).eq('id', building.id)

      renderPendingScreen('PROOF', plan)
    }
  }

  // ─── PENDING SCREEN ────────────────────────────────────────────
  const renderPendingScreen = (type, plan) => {
    const WA_NUMBER = '584120770776'
    const waMsg = encodeURIComponent('Hola, acabo de registrar mi edificio en Sloty y seleccioné el plan ' + plan.label + '. Quedo pendiente de la activación. Gracias.')
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:20px;">${type === 'CASH' ? '⏳' : '📨'}</div>
        <h1 style="color:white;font-size:1.4rem;font-weight:900;margin-bottom:10px;">
          ${type === 'CASH' ? 'Solicitud Recibida' : 'Comprobante Enviado'}
        </h1>
        <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;line-height:1.6;margin-bottom:28px;max-width:320px;">
          ${type === 'CASH'
            ? 'El equipo de Sloty confirmar\u00e1 tu pago y activar\u00e1 tu cuenta. Por ahora tu acceso est\u00e1 pendiente.'
            : 'Tu comprobante est\u00e1 siendo revisado. Reciber\u00e1s acceso en cuanto sea aprobado.'}
        </p>
        ${type === 'CASH' ? `
          <a href="https://wa.me/${WA_NUMBER}?text=${waMsg}"
            style="display:block;width:100%;max-width:320px;padding:18px;background:#25D366;color:white;border:none;
            border-radius:14px;font-family:'Montserrat',sans-serif;font-size:0.95rem;font-weight:900;
            cursor:pointer;text-decoration:none;margin-bottom:16px;">
            📲 CONTACTAR AL EQUIPO DE SLOTY
          </a>` : ''}
        <div style="background:rgba(245,197,24,0.1);border:1px solid #F5C518;border-radius:14px;padding:16px 24px;max-width:320px;width:100%;">
          <div style="color:#F5C518;font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Plan Seleccionado</div>
          <div style="color:white;font-size:1.1rem;font-weight:900;margin-top:4px;">${plan.label} · ${plan.price}</div>
        </div>
      </div>
    `
  }

  render()
}

// ─── GUARD BUILDING LOGIN ──────────────────────────────────────
const renderBuildingLogin = () => {
  const state = getParkingState()
  let code = ''

  screens.guardPin.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-to-welcome" style="position:absolute;top:24px;left:24px;background:none;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <img src="/sloty-logo-v2.png" alt="Sloty" style="width:140px;height:auto;display:block;margin-bottom:8px;" />
      <p style="color:rgba(255,255,255,0.4);font-size:0.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 40px;">IDENTIFICA TU EDIFICIO</p>
      
      <div style="width:100%;max-width:320px;background:rgba(255,255,255,0.05);padding:30px;border-radius:24px;text-align:center;border:1px solid rgba(255,255,255,0.1);">
        <p style="color:white;font-size:0.85rem;margin-bottom:20px;opacity:0.8;">Ingresa el código del edificio (ej. DAN-12245)</p>
        <input type="text" id="build-code-input" placeholder="CÓDIGO" 
          style="width:100%;padding:18px;border-radius:12px;border:2px solid #F5C518;background:transparent;color:white;text-align:center;font-size:1.2rem;font-weight:900;outline:none;text-transform:uppercase;">
        <button id="btn-validate-build" class="btn-primary" style="margin-top:20px;">ENTRAR</button>
        <p id="build-error" style="color:#e63946;font-size:0.8rem;margin-top:15px;min-height:18px;"></p>
      </div>
    </div>
  `

  $('btn-back-to-welcome').onclick = () => showOnly('welcome')
  $('btn-validate-build').onclick = async () => {
    const entered = $('build-code-input').value.trim().toUpperCase()
    if (!entered) { $('build-error').textContent = 'Ingresa un código'; return }

    $('btn-validate-build').textContent = 'Verificando...'
    $('btn-validate-build').disabled = true

    const { data, error } = await supabase
      .from('buildings')
      .select('id, name, code')
      .eq('code', entered)
      .single()

    if (error || !data) {
      $('build-error').textContent = 'Código de edificio no válido'
      $('btn-validate-build').textContent = 'ENTRAR'
      $('btn-validate-build').disabled = false
      return
    }

    localStorage.setItem('sloty_active_building', data.code)
    localStorage.setItem('sloty_building_id', data.id)
    localStorage.setItem('sloty_building_name', data.name)

    renderGuardPin()
  }
}

// ─── GUARD PIN SCREEN ──────────────────────────────────────────
const renderGuardPin = () => {
  const state = getParkingState()
  const activeBuilding = localStorage.getItem('sloty_active_building')
  
  if (!activeBuilding && !new URLSearchParams(window.location.search).get('building')) {
    return renderBuildingLogin()
  }

  const params = new URLSearchParams(window.location.search)
  const autoGuardId = params.get('guard')
  
  let selectedGuard = autoGuardId ? (state.personnel || []).find(p => p.id === autoGuardId) : null
  let pin = ''

  const renderSelection = async () => {
    const buildingId = localStorage.getItem('sloty_building_id')

    const { data: personnel } = await supabase
      .from('personnel')
      .select('*')
      .eq('building_id', buildingId)

    state.personnel = personnel || []

    const activeGuards = (state.personnel || []).filter(p => p.pin)

    screens.guardPin.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:40px 24px;">
        <div style="display:flex;width:100%;justify-content:space-between;align-items:center;margin-bottom:30px;">
          <button id="btn-back-guard" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
          <button id="btn-change-build" style="background:rgba(255,255,255,0.1);border:none;color:white;padding:6px 12px;border-radius:8px;font-size:0.6rem;font-weight:900;cursor:pointer;">CAMBIAR EDIFICIO</button>
        </div>
        <img src="/sloty-logo-v2.png" alt="Sloty" style="width:120px;height:auto;display:block;margin-bottom:8px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:0.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px;">SELECCIONA TU PERFIL</p>
        
        <div style="width:100%;max-width:320px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${activeGuards.map(p => `
            <div class="guard-card" data-id="${p.id}" style="background:rgba(255,255,255,0.05);padding:20px 10px;border-radius:18px;text-align:center;cursor:pointer;border:2px solid transparent;transition:all 0.2s;">
              <div style="width:60px;height:60px;border-radius:50%;background:#333;margin:0 auto 10px;overflow:hidden;border:2px solid rgba(255,255,255,0.1);">
                ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-weight:900;">${p.name.charAt(0)}</div>`}
              </div>
              <div style="color:white;font-weight:700;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
            </div>
          `).join(activeGuards.length ? '' : '<p style="color:rgba(255,255,255,0.3);grid-column:span 2;padding:40px 0;">No hay guardias registrados.</p>')}
        </div>
        
        <p style="color:rgba(255,255,255,0.2);font-size:0.75rem;margin-top:auto;padding-top:40px;">${state.buildingName || 'Edificio'}</p>
      </div>
    `
    $('btn-back-guard').onclick = () => showOnly('welcome')
    $('btn-change-build').onclick = () => {
      localStorage.removeItem('sloty_active_building')
      renderBuildingLogin()
    }
    screens.guardPin.querySelectorAll('.guard-card').forEach(card => {
      card.onclick = () => {
        selectedGuard = (state.personnel || []).find(p => p.id === card.dataset.id)
        renderPinPad()
      }
    })
  }

  const renderPinPad = () => {
    pin = ''
    screens.guardPin.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
        <button id="btn-back-selection" style="position:absolute;top:24px;left:24px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
        
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:100px;height:100px;border-radius:50%;background:#333;margin:0 auto 15px;overflow:hidden;border:4px solid #F5C518;">
            ${selectedGuard.photo ? `<img src="${selectedGuard.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-size:2rem;font-weight:900;">${selectedGuard.name.charAt(0)}</div>`}
          </div>
          <div style="color:white;font-weight:900;font-size:1.2rem;">${selectedGuard.name}</div>
          <div style="color:#F5C518;font-size:0.7rem;font-weight:700;letter-spacing:2px;margin-top:5px;text-transform:uppercase;">INGRESA TU PIN</div>
        </div>

        <div style="font-size:2.5rem;font-weight:900;color:white;letter-spacing:16px;margin-bottom:40px;min-height:50px;" id="pin-display">––––</div>
        
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:260px;width:100%;">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
            <button class="pin-key" data-key="${k}"
              style="padding:20px;border-radius:14px;border:none;
                background:${k===''?'transparent':'rgba(255,255,255,0.08)'};
                color:white;font-family:'Montserrat',sans-serif;font-size:1.4rem;font-weight:900;
                cursor:${k===''?'default':'pointer'};
                ${k===''?'pointer-events:none;':''}">
              ${k}
            </button>
          `).join('')}
        </div>
        <p id="pin-error" style="color:#e63946;font-size:0.85rem;font-weight:700;margin-top:20px;min-height:20px;"></p>
      </div>
    `

    $('btn-back-selection').onclick = () => renderSelection()

    const updateDisplay = () => {
      $('pin-display').textContent = pin.length === 0 ? '––––' : '●'.repeat(pin.length).padEnd(4,'–')
    }

    screens.guardPin.querySelectorAll('.pin-key').forEach(btn => {
      const key = btn.dataset.key
      if (key === '' || key === undefined) return
      btn.onclick = () => {
        if (key === '⌫') {
          pin = pin.slice(0, -1)
          updateDisplay()
          return
        }
        if (pin.length >= 4) return
        pin += key
        updateDisplay()
        if (pin.length === 4) {
          const guard = (state.personnel || []).find(p => p.pin === pin)
          if (guard) {
            showOnly('main')
            const currentState = getParkingState()
            if (currentState.membership_status === 'SUSPENDED') {
              screens.main.innerHTML = renderSuspendedScreen()
              return
            }
            initGuard(screens.main, guard.name)
          } else {
            $('pin-error').textContent = 'PIN incorrecto. Intenta de nuevo.'
            setTimeout(() => {
              pin = ''
              updateDisplay()
              $('pin-error').textContent = ''
            }, 1000)
          }
        }
      }
    })
  }

  if (selectedGuard) renderPinPad()
  else renderSelection()
}

// ─── ROUTER POR ROL ────────────────────────────────────────────
async function redirectByRole(userId) {
  const roleData = await getUserRole(userId)
  showOnly('main')
  if (!roleData) {
    screens.main.innerHTML = '<p style="padding:40px;color:#333;">Sin rol asignado.</p>'
    return
  }
  switch (roleData.role) {
    case 'MASTER': initMaster(screens.main); break
    case 'ADMIN':  
      const currentState = getParkingState()
      if (currentState.membership_status === 'SUSPENDED') {
        screens.main.innerHTML = renderSuspendedScreen()
        return
      }
      initAdmin(screens.main);  
      break
    case 'GUARD':  renderGuardPin(); showOnly('guardPin'); break
    default:
      screens.main.innerHTML = `<p style="padding:40px;">Rol: ${roleData.role}</p>`
  }
}

const checkInvitationLink = async () => {
  const params = new URLSearchParams(window.location.search);
  const plate = params.get('setup');
  const bldCode = params.get('bld');
  const guardId = params.get('setup_guard');
  // Guard ID may be base64-encoded, or it may be a raw numeric ID (Date.now()).
  // Only attempt base64 decode if the value is NOT already a plain number.
  let guardIdDecoded = null;
  if (guardId) {
    const rawDecoded = decodeURIComponent(guardId);
    if (/^\d+$/.test(rawDecoded)) {
      // It's a plain numeric ID — use as-is
      guardIdDecoded = rawDecoded;
    } else {
      try {
        guardIdDecoded = atob(rawDecoded);
      } catch (e) {
        console.warn('Guard ID base64 decoding failed, using raw value', e);
        guardIdDecoded = rawDecoded;
      }
    }
  }
  console.log('guardId param:', guardId, 'decoded:', guardIdDecoded);


  
  if (guardId && bldCode) {
    showOnly('login');
    screens.login.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
        <div style="margin-bottom:32px;text-align:center;">
          <div style="font-size:3rem; margin-bottom:10px;">🛡️</div>
          <h2 style="color:white; font-weight:900;">ACTIVACIÓN DE GUARDIA</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Crea tu PIN personal de 4 dígitos</p>
        </div>
        <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
          <input type="password" id="guard-setup-pin-1" placeholder="NUEVO PIN (4 DÍGITOS)" maxlength="4" inputmode="numeric"
            style="width:100%;padding:18px;border-radius:12px;border:2px solid #F5C518;background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;" />
          <input type="password" id="guard-setup-pin-2" placeholder="REPETIR PIN" maxlength="4" inputmode="numeric"
            style="width:100%;padding:18px;border-radius:12px;border:2px solid #F5C518;background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;" />
          
          <button id="btn-save-guard-pin" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
            ACTIVAR MI CUENTA
          </button>
          <p id="guard-setup-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
        </div>
      </div>
    `;

    document.getElementById('btn-save-guard-pin').onclick = async () => {
      const pin1 = document.getElementById('guard-setup-pin-1').value;
      const pin2 = document.getElementById('guard-setup-pin-2').value;
      if (pin1.length !== 4) return renderAlert('El PIN debe ser de 4 dígitos', true);
      if (pin1 !== pin2) return renderAlert('Los PIN no coinciden', true);

      const guardIdToUse = guardIdDecoded || guardId;

      document.getElementById('btn-save-guard-pin').textContent = 'Activando...';
      const { data: bld } = await supabase.from('buildings').select('id, name, code').eq('code', bldCode).single();
      if (!bld) return renderAlert('Error: Edificio no encontrado', true);

      const { data: guard, error } = await supabase.from('personnel').update({ pin: pin1 }).eq('id', guardIdToUse).select('name').single();
      if (!error && guard) {
        localStorage.setItem('sloty_active_building', bld.code);
        localStorage.setItem('sloty_building_id', bld.id);
        localStorage.setItem('sloty_building_name', bld.name);
        
        window.history.replaceState({}, document.title, '/');
        renderAlert('¡Cuenta activada con éxito! Iniciando sesión...');
        setTimeout(async () => {
          showOnly('main');
          await syncDown(bld.code);
          initGuard(screens.main, guard.name);
        }, 1500);
      } else {
        console.error("Error activando guardia:", error, "ID:", guardIdToUse);
        renderAlert('Error: ' + (error?.message || 'Intenta de nuevo'), true);
        document.getElementById('btn-save-guard-pin').textContent = 'ACTIVAR MI CUENTA';
      }
    };
    return true;
  }

  if (plate && bldCode) {
    showOnly('login');
    screens.login.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
        <div style="margin-bottom:32px;text-align:center;">
          <div style="font-size:3rem; margin-bottom:10px;">🛡️</div>
          <h2 style="color:white; font-weight:900;">BIENVENIDO A SLOTY</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Vas a crear tu PIN para el vehículo: <span style="color:var(--accent);">${plate}</span></p>
        </div>
        <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
          <input type="password" id="setup-pin-1" placeholder="NUEVO PIN (4 DÍGITOS)" maxlength="4"
            style="width:100%;padding:18px;border-radius:12px;border:2px solid var(--accent);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;" />
          <input type="password" id="setup-pin-2" placeholder="REPETIR PIN" maxlength="4"
            style="width:100%;padding:18px;border-radius:12px;border:2px solid var(--accent);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;text-align:center;outline:none;" />
          
          <button id="btn-save-setup-pin" style="width:100%;padding:18px;background:var(--accent);color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
            ACTIVAR MI ACCESO
          </button>
          <p id="setup-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
        </div>
      </div>
    `;
    
    document.getElementById('btn-save-setup-pin').onclick = async () => {
      const pin1 = document.getElementById('setup-pin-1').value;
      const pin2 = document.getElementById('setup-pin-2').value;
      if (pin1.length !== 4) return renderAlert('El PIN debe ser de 4 dígitos', true);
      if (pin1 !== pin2) return renderAlert('Los PIN no coinciden', true);
      
      document.getElementById('btn-save-setup-pin').textContent = 'Activando...';
      const { data: bld } = await supabase.from('buildings').select('id').eq('code', bldCode).single();
      if (!bld) return renderAlert('Error: Edificio no encontrado', true);

      const { data: subs } = await supabase.from('subscriptions').select('*').eq('building_id', bld.id);
      const resident = subs.find(s => s.plate.includes(plate));
      if (!resident) return renderAlert('Error: No se encontró tu registro', true);

      const { error } = await supabase.from('subscriptions').update({ pin: pin1 }).eq('id', resident.id);
      if (!error) {
        // Update local object with the new PIN so we can pass it directly
        resident.pin = pin1;

        // Show a welcoming in-app modal
        const layer = document.createElement('div');
        layer.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:24px;';
        layer.innerHTML = `
          <div style="background:white; padding:40px 25px; border-radius:32px; width:100%; max-width:340px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.3); animation: modalIn 0.35s forwards cubic-bezier(0.17, 0.89, 0.32, 1.28); transform:scale(0.9);">
            <div style="font-size:4rem; margin-bottom:10px;">🎉</div>
            <div style="font-size:0.65rem; font-weight:800; color:#bbb; text-transform:uppercase; letter-spacing:2px; margin-bottom:8px;">¡Bienvenido a Sloty!</div>
            <div style="font-size:1.5rem; font-weight:900; color:#1a1a2e; margin-bottom:8px;">${resident.resident_name}</div>
            <div style="font-size:0.8rem; font-weight:600; color:#999; margin-bottom:30px;">Tu acceso ha sido activado correctamente. Ya puedes gestionar tu pase.</div>
            <button id="welcome-enter-btn" style="width:100%; padding:18px; background:#1a1a2e; color:#F5C518; border:none; border-radius:18px; font-weight:900; font-size:1rem; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">ENTRAR A MI PANEL →</button>
          </div>
          <style>@keyframes modalIn { to { transform: scale(1); } }</style>
        `;
        document.body.appendChild(layer);

        layer.querySelector('#welcome-enter-btn').onclick = () => {
          layer.remove();
          window.history.replaceState({}, document.title, '/');
          import('./modules/resident.js').then(m => {
            m.initResident(screens.residentPanel, resident);
            showOnly('residentPanel');
          });
        };
      }
    };
    return true;
  }
  return false;
};

// ─── INIT ──────────────────────────────────────────────────────
async function init() {
  const isSetup = await checkInvitationLink();
  if (isSetup) return;

  const params = new URLSearchParams(window.location.search)
  const bParam = params.get('building')
  if (bParam) {
    localStorage.setItem('sloty_active_building', bParam)
    renderGuardPin(); showOnly('guardPin'); return
  }
  // Primero mostramos la pantalla de bienvenida (PWA feel)
  renderWelcome(); showOnly('welcome')
  
  // Verificar sesión en segundo plano
  const session = await getSession()
  if (session) await redirectByRole(session.user.id)
  
  initUpdateBanner()
}

init()
