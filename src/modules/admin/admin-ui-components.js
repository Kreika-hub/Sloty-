/**
 * Admin UI Components — Pure constants and utility functions
 * Extracted from admin.js monolith (Phase C refactor)
 * These are stateless: no closure dependencies, no side effects.
 */

// ─── SVG ICON CONSTANTS ─────────────────────────────────────────
export const ICONS = {
  HOME: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  HISTORY: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  FINANCE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  STRUCTURE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  PERSONAL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  LOGOUT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  TRASH: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6m4-4v6"/></svg>`,
  EDIT: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  PLUS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  SETTINGS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  BELL: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  PALETTE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.647-.494 2.091-1.243.221-.374.332-.811.391-1.242.16-.58.148-1.167.373-1.607.453-.88 1.447-1.408 2.51-1.408H20c1.1 0 2-.9 2-2 0-5.5-4.5-10-10-10z"/></svg>`,
  SUBS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>`,
  CARD: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg>`,
  WHATSAPP: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 9 9.1z"/></svg>`
}

// ─── SKELETON LOADERS ─────────────────────────────────────────
export const SKELETONS = {
  pulse: `<style>.sk-pulse{animation:skPulse 1.4s ease-in-out infinite}.sk-pulse2{animation:skPulse 1.4s ease-in-out 0.2s infinite}.sk-pulse3{animation:skPulse 1.4s ease-in-out 0.4s infinite}@keyframes skPulse{0%,100%{opacity:1}50%{opacity:0.4}} button { transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1); } button:active { transform: scale(0.95); }</style>`,
  HOME: `<div style="padding:20px;">
      <div class="sk-pulse" style="height:90px;background:#e8e8e8;border-radius:24px;margin-bottom:12px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="sk-pulse" style="height:100px;background:#e8e8e8;border-radius:24px;"></div>
        <div class="sk-pulse" style="height:100px;background:#e8e8e8;border-radius:24px;animation-delay:0.15s;"></div>
      </div>
      <div class="sk-pulse" style="height:64px;background:#e8e8e8;border-radius:20px;margin-bottom:12px;animation-delay:0.3s;"></div>
      <div class="sk-pulse" style="height:64px;background:#e8e8e8;border-radius:20px;margin-bottom:12px;animation-delay:0.45s;"></div>
      <div class="sk-pulse" style="height:64px;background:#e8e8e8;border-radius:20px;animation-delay:0.6s;"></div>
    </div>`,
  SUBS: `<div style="padding:20px;">
      <div class="sk-pulse" style="height:52px;background:#e8e8e8;border-radius:16px;margin-bottom:16px;"></div>
      ${[0,1,2,3,4].map(i => `<div class="sk-pulse" style="height:80px;background:#e8e8e8;border-radius:20px;margin-bottom:10px;animation-delay:${i*0.1}s;"></div>`).join('')}
    </div>`,
  FINANCE: `<div style="padding:20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="sk-pulse" style="height:100px;background:#e8e8e8;border-radius:28px;"></div>
        <div class="sk-pulse" style="height:100px;background:#e8e8e8;border-radius:28px;animation-delay:0.15s;"></div>
      </div>
      <div class="sk-pulse" style="height:100px;background:#e8e8e8;border-radius:28px;margin-bottom:12px;animation-delay:0.3s;"></div>
      <div class="sk-pulse" style="height:52px;background:#e8e8e8;border-radius:16px;margin-bottom:12px;animation-delay:0.45s;"></div>
      ${[0,1,2].map(i => `<div class="sk-pulse" style="height:64px;background:#e8e8e8;border-radius:20px;margin-bottom:10px;animation-delay:${0.6+i*0.1}s;"></div>`).join('')}
    </div>`,
  DEFAULT: `<div style="padding:20px;">
      ${[0,1,2,3].map(i => `<div class="sk-pulse" style="height:72px;background:#e8e8e8;border-radius:20px;margin-bottom:10px;animation-delay:${i*0.12}s;"></div>`).join('')}
    </div>`
}

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────
export const getCategoryColor = (cat, categories = []) => {
  const found = categories.find(c => c.id === cat)
  return found ? found.color : '#F5C518'
}

export const getCategoryLabel = (cat, categories = []) => {
  const found = categories.find(c => c.id === cat)
  return found ? found.tag : 'V'
}

export const compressBase64Image = (base64Str, max = 200, quality = 0.6) => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    if (base64Str.length < 55000) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width; let h = img.height;
      if (w > h) { if (w > max) { h *= max / w; w = max; } }
      else { if (h > max) { w *= max / h; h = max; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};
