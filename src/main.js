import { login, getSession, getUserRole, setDevRole } from './auth.js'
import { initGuard } from './modules/guard.js'
import { initAdmin } from './modules/admin.js'
import { initMaster } from './modules/master.js'
import { getParkingState, saveParkingState } from './db.js'
import { initUpdateBanner } from './pwa-update.js'

const $ = id => document.getElementById(id)

const screens = {
  welcome: $('welcome-screen'),
  login: $('login-screen'),
  register: $('register-screen'),
  guardPin: $('guard-pin-screen'),
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
    <div style="min-height:100vh;min-height:100dvh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top, 40px) 24px env(safe-area-inset-bottom, 40px);">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;gap:0;">
        <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:75%;max-width:300px;height:auto;display:block;margin:0 auto;" />
        <p style="color:rgba(255,255,255,0.5);font-size:0.8rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:20px 0 0;text-align:center;">GESTIÓN INTELIGENTE DE<br>ESTACIONAMIENTOS</p>
      </div>
      <div style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:14px;padding-bottom:20px;">
        <button id="btn-goto-register" style="width:100%;padding:20px;background:#F5C518;color:#1a1a2e;border:none;border-radius:18px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;letter-spacing:1px;">
          REGISTRAR MI EDIFICIO
        </button>
        <button id="btn-goto-login" style="width:100%;padding:20px;background:transparent;color:white;border:2px solid rgba(255,255,255,0.2);border-radius:18px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:700;cursor:pointer;">
          YA TENGO CUENTA
        </button>
        <button id="btn-goto-guard" style="width:100%;padding:14px;background:transparent;color:rgba(255,255,255,0.4);border:none;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;letter-spacing:1px;">
          SOY GUARDIA →
        </button>
        <p style="color:rgba(255,255,255,0.15);font-size:0.65rem;font-weight:600;text-align:center;letter-spacing:2px;margin-top:4px;">POWERED BY KREIKA</p>
      </div>
    </div>
  `
  $('btn-goto-register').onclick = () => { renderRegister(); showOnly('register') }
  $('btn-goto-login').onclick = () => { renderLogin(); showOnly('login') }
  $('btn-goto-guard').onclick = () => { renderGuardPin(); showOnly('guardPin') }
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────
const renderLogin = () => {
  screens.login.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-login" style="position:absolute;top:24px;left:24px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
      <div style="margin-bottom:32px;text-align:center;">
        <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:180px;height:auto;display:block;margin:0 auto 8px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;font-weight:600;margin-top:4px;">Panel Administrador</p>
      </div>
      <div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:14px;">
        <input type="email" id="email" placeholder="Correo electrónico" autocomplete="email"
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;" />
        <input type="password" id="password" placeholder="Contraseña"
          style="width:100%;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:white;font-family:'Montserrat',sans-serif;font-size:0.95rem;outline:none;" />
        <div style="display:flex;gap:8px;">
          <button class="role-chip active" data-role="MASTER" style="flex:1;padding:10px;border-radius:10px;border:2px solid #F5C518;background:#F5C518;color:#1a1a2e;font-weight:900;cursor:pointer;font-size:0.75rem;font-family:'Montserrat',sans-serif;">Master</button>
          <button class="role-chip" data-role="ADMIN" style="flex:1;padding:10px;border-radius:10px;border:2px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.5);font-weight:700;cursor:pointer;font-size:0.75rem;font-family:'Montserrat',sans-serif;">Admin</button>
        </div>
        <button id="btn-login" style="width:100%;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-top:8px;">
          ENTRAR
        </button>
        <p id="login-error" style="color:#e63946;text-align:center;font-size:0.85rem;font-weight:700;min-height:20px;"></p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;text-align:center;">
          <a href="#" id="forgot-password" style="color:rgba(255,255,255,0.3);font-size:0.8rem;display:block;">¿Olvidaste tu contraseña?</a>
          <a href="#" id="goto-register" style="color:#F5C518;font-size:0.85rem;font-weight:900;text-decoration:none;">REGISTRAR NUEVO EDIFICIO</a>
          <a href="#" id="goto-guard" style="color:rgba(255,255,255,0.4);font-size:0.8rem;margin-top:10px;">Soy Guardia →</a>
        </div>
      </div>
    </div>
  `
  $('goto-register').onclick = () => { renderRegister(); showOnly('register') }
  $('goto-guard').onclick = () => { renderGuardPin(); showOnly('guardPin') }
  $('btn-back-login').onclick = () => { renderLogin(); showOnly('login') } // Now it just re-renders itself or we could go back to welcome if we kept it

  const chips = screens.login.querySelectorAll('.role-chip')
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.style.background = 'transparent'
        c.style.borderColor = 'rgba(255,255,255,0.2)'
        c.style.color = 'rgba(255,255,255,0.5)'
      })
      chip.style.background = '#F5C518'
      chip.style.borderColor = '#F5C518'
      chip.style.color = '#1a1a2e'
      setDevRole(chip.dataset.role)
    })
  })

  $('btn-login').onclick = async () => {
    const email = $('email').value.trim()
    const password = $('password').value.trim()
    if (!email || !password) { $('login-error').textContent = 'Completa todos los campos'; return }
    $('btn-login').textContent = 'Entrando...'
    $('btn-login').disabled = true
    try {
      const data = await login(email, password)
      await redirectByRole(data.user.id)
    } catch (err) {
      $('login-error').textContent = 'Correo o contraseña incorrectos'
      $('btn-login').textContent = 'ENTRAR'
      $('btn-login').disabled = false
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
  }

  const finishRegister = async () => {
    $('btn-reg-next').textContent = 'Creando cuenta...'
    $('btn-reg-next').disabled = true
    const state = getParkingState()
    state.buildingName = data.buildingName
    state.adminInfo = { name: data.adminName, email: data.email, registered: true }
    saveParkingState(state)
    screens.register.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;">
        <div style="font-size:4rem;margin-bottom:24px;">🎉</div>
        <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:180px;height:auto;display:block;margin:0 auto 16px;" />
        <h2 style="color:white;font-size:1.5rem;font-weight:900;margin:0 0 8px;">${data.buildingName}</h2>
        <p style="color:rgba(255,255,255,0.5);margin-bottom:40px;">Tu edificio está listo. Ahora configura tus niveles y comienza.</p>
        <button id="btn-enter-admin" style="width:100%;max-width:300px;padding:18px;background:#F5C518;color:#1a1a2e;border:none;border-radius:14px;font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:900;cursor:pointer;margin-bottom:14px;">
          IR A MI PANEL →
        </button>
        <button id="btn-back-welcome" style="width:100%;max-width:300px;padding:14px;background:transparent;color:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:14px;font-family:'Montserrat',sans-serif;font-size:0.85rem;font-weight:700;cursor:pointer;">
          ← VOLVER AL INICIO
        </button>
      </div>
    `
    $('btn-enter-admin').onclick = () => {
      showOnly('main')
      initAdmin(screens.main)
    }
    $('btn-back-welcome').onclick = () => {
      showOnly('welcome')
      renderWelcome()
    }
  }

  render()
}

// ─── GUARD BUILDING LOGIN ──────────────────────────────────────
const renderBuildingLogin = () => {
  const state = getParkingState()
  let code = ''

  screens.guardPin.innerHTML = `
    <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;">
      <button id="btn-back-welcome" style="position:absolute;top:24px;left:24px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
      <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:140px;height:auto;display:block;margin-bottom:8px;" />
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

  $('btn-back-welcome').onclick = () => showOnly('welcome')
  $('btn-validate-build').onclick = () => {
    const entered = $('build-code-input').value.trim().toUpperCase()
    if (entered.length > 0) { // Relaxed for development: allows any non-empty code
      localStorage.setItem('sloty_active_building', entered)
      renderGuardPin()
    } else {
      $('build-error').textContent = 'Ingresa un código'
    }
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

  const renderSelection = () => {
    screens.guardPin.innerHTML = `
      <div style="min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:40px 24px;">
        <div style="display:flex;width:100%;justify-content:space-between;align-items:center;margin-bottom:30px;">
          <button id="btn-back-guard" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;">←</button>
          <button id="btn-change-build" style="background:rgba(255,255,255,0.1);border:none;color:white;padding:6px 12px;border-radius:8px;font-size:0.6rem;font-weight:900;cursor:pointer;">CAMBIAR EDIFICIO</button>
        </div>
        <img src="/sloty-logo-v2.png.png" alt="Sloty" style="width:120px;height:auto;display:block;margin-bottom:8px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:0.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px;">SELECCIONA TU PERFIL</p>
        
        <div style="width:100%;max-width:320px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${(state.personnel || []).map(p => `
            <div class="guard-card" data-id="${p.id}" style="background:rgba(255,255,255,0.05);padding:20px 10px;border-radius:18px;text-align:center;cursor:pointer;border:2px solid transparent;transition:all 0.2s;">
              <div style="width:60px;height:60px;border-radius:50%;background:#333;margin:0 auto 10px;overflow:hidden;border:2px solid rgba(255,255,255,0.1);">
                ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-weight:900;">${p.name.charAt(0)}</div>`}
              </div>
              <div style="color:white;font-weight:700;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
            </div>
          `).join(state.personnel?.length ? '' : '<p style="color:rgba(255,255,255,0.3);grid-column:span 2;padding:40px 0;">No hay guardias registrados.</p>')}
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
    case 'ADMIN':  initAdmin(screens.main);  break
    case 'GUARD':  renderGuardPin(); showOnly('guardPin'); break
    default:
      screens.main.innerHTML = `<p style="padding:40px;">Rol: ${roleData.role}</p>`
  }
}

// ─── INIT ──────────────────────────────────────────────────────
async function init() {
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
