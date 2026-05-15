import { registerSW } from 'virtual:pwa-register'

// ── INSTALL PROMPT BANNER ─────────────────────────────────────
// Captura el evento del navegador antes de que desaparezca
let deferredPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // Bloquea el mini-banner nativo del navegador
  deferredPrompt = e
  showInstallBanner()
})

const showInstallBanner = () => {
  // 1. No mostrar si ya existe el banner
  if (document.getElementById('pwa-install-banner')) return

  // 2. No mostrar si ya está en modo APP (PWA instalada)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  if (isStandalone) return

  // 3. No mostrar si ya se instaló (marca manual)
  if (localStorage.getItem('pwa_installed') === 'true') return

  // 4. No mostrar si se rechazó recientemente (ahora 30 días)
  const dismissedAt = localStorage.getItem('pwa_dismissed_at')
  if (dismissedAt) {
    const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
    if (daysSince < 30) return 
  }

  const banner = document.createElement('div')
  banner.id = 'pwa-install-banner'
  banner.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 40px);
    max-width: 400px;
    background: #1a1a2e;
    border: 1.5px solid rgba(245,197,24,0.3);
    border-radius: 20px;
    padding: 18px 20px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-family: 'Montserrat', sans-serif;
    animation: slideUp 0.4s ease;
  `

  banner.innerHTML = `
    <style>
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
      }
    </style>
    <div style="width:44px;height:44px;border-radius:12px;background:#F5C518;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </div>
    <div style="flex:1;">
      <div style="color:#F5C518;font-size:0.65rem;font-weight:900;letter-spacing:1px;margin-bottom:2px;">INSTALAR APP</div>
      <div style="color:white;font-size:0.85rem;font-weight:700;line-height:1.3;">Agrega Sloty a tu pantalla de inicio</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <button id="pwa-install-btn" style="
        background:#F5C518;color:#1a1a2e;border:none;
        padding:10px 16px;border-radius:10px;
        font-family:'Montserrat',sans-serif;font-weight:900;
        font-size:0.75rem;cursor:pointer;white-space:nowrap;
      ">INSTALAR</button>
      <button id="pwa-dismiss-btn" style="
        background:transparent;color:rgba(255,255,255,0.4);
        border:none;font-family:'Montserrat',sans-serif;
        font-size:0.65rem;font-weight:700;cursor:pointer;
        padding:4px;
      ">Ahora no</button>
    </div>
  `

  document.body.appendChild(banner)

  document.getElementById('pwa-install-btn').onclick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    banner.remove()
    if (outcome === 'accepted') {
      console.log('Sloty instalada correctamente')
    }
  }

  document.getElementById('pwa-dismiss-btn').onclick = () => {
    banner.remove()
    // Volver a mostrar después de 3 días
    localStorage.setItem('pwa_dismissed_at', Date.now())
  }
}

// No mostrar si fue rechazado hace menos de 3 días
window.addEventListener('load', () => {
  const dismissedAt = localStorage.getItem('pwa_dismissed_at')
  if (dismissedAt) {
    const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
    if (daysSince < 3) return // Esperar 3 días antes de volver a mostrar
  }
})

// ── UPDATE BANNER ─────────────────────────────────────────────
export function initUpdateBanner() {
  registerSW({
    onNeedRefresh() {
      const banner = document.createElement('div')
      banner.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #1a1a2e; color: white; padding: 14px 20px;
        border: 1.5px solid #F5C518;
        border-radius: 14px; font-family: 'Montserrat', sans-serif;
        font-weight: 900; font-size: 0.85rem; z-index: 9999;
        display: flex; align-items: center; gap: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `
      banner.innerHTML = `
        <span style="color:rgba(255,255,255,0.8);">Nueva versión disponible</span>
        <button onclick="window.location.reload()"
          style="background:#F5C518;color:#1a1a2e;border:none;padding:6px 14px;
          border-radius:8px;font-family:'Montserrat',sans-serif;font-weight:900;
          font-size:0.75rem;cursor:pointer;">
          ACTUALIZAR
        </button>
      `
      document.body.appendChild(banner)
    },
    onOfflineReady() {
      console.log('Sloty lista para usar offline')
    }
  })
}
