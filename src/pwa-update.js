import { registerSW } from 'virtual:pwa-register'

export function initUpdateBanner() {
  const updateSW = registerSW({
    onNeedRefresh() {
      const banner = document.createElement('div')
      banner.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #F5C518; color: #1a1a2e; padding: 14px 20px;
        border-radius: 14px; font-family: 'Montserrat', sans-serif;
        font-weight: 900; font-size: 0.85rem; z-index: 9999;
        display: flex; align-items: center; gap: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `
      banner.innerHTML = `
        <span>Nueva versión disponible</span>
        <button onclick="this.parentElement.remove(); window.__updateSW(true)"
          style="background:#1a1a2e;color:#F5C518;border:none;padding:6px 12px;
          border-radius:8px;font-family:'Montserrat',sans-serif;font-weight:900;cursor:pointer;">
          ACTUALIZAR
        </button>
      `
      document.body.appendChild(banner)
      window.__updateSW = updateSW
    },
    onOfflineReady() {
      console.log('Sloty lista para usar offline')
    }
  })
}
