import fs from 'fs';

let code = fs.readFileSync('c:/Users/HP/Desktop/Sloty/Sloty-/src/modules/guard.js', 'utf8');

const target1 = `           window.cachedVisitor = null;
           const resultList = await searchVisitorByPlate(plate);
           const found = resultList && resultList.length > 0 ? resultList[0] : null;
           if (!found) return
            <div style="font-size:0.7rem;opacity:0.7;">\${found.visit_count} visitas anteriores · \${found.r_visits_to || ''}</div>
          </div>
          <div style="font-size:1.5rem;">✓</div>
        \`
        plateEl.parentNode.insertBefore(banner, plateEl.nextSibling)
         }`;

const replacement = `           window.cachedVisitor = null;
           const resultList = await searchVisitorByPlate(plate);
           const found = resultList && resultList.length > 0 ? resultList[0] : null;
           if (!found) return
           
           window.cachedVisitor = found;

           // Display confirmation banner instead of silent form-fill
           const banner = document.createElement('div')
           banner.id = 'visitor-suggestion'
           banner.style.cssText = \`
             background:#F5C518;color:#1a1a2e;padding:12px 16px;border-radius:12px;
             margin-bottom:12px;display:flex;flex-direction:column;gap:8px;
             font-family:'Montserrat',sans-serif;
           \`
           
           let cfHtml = '';
           if (found.last_custom_fields) {
               cfHtml = Object.entries(found.last_custom_fields)
                  .map(([k, v]) => \`\${k.toUpperCase()}: \${v}\`)
                  .join(' · ');
           }
           
           banner.innerHTML = \`
             <div style="display:flex; justify-content:space-between; align-items:center;">
               <div>
                 <div style="font-size:0.6rem;font-weight:900;letter-spacing:1px;">VISITANTE FRECUENTE</div>
                 <div style="font-size:0.95rem;font-weight:900;">\${found.r_full_name}</div>
                 <div style="font-size:0.7rem;opacity:0.8;font-weight:700;">Destino previo: \${found.r_visits_to || ''}</div>
                 \${cfHtml ? \`<div style="font-size:0.65rem;font-weight:900;color:rgba(26,26,46,0.7);margin-top:2px;">\${cfHtml}</div>\` : ''}
               </div>
               <div style="font-size:1.5rem; color:#1a1a2e;">✓</div>
             </div>
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                <button onclick="
                  document.getElementById('entry-phone').value = window.cachedVisitor.r_phone || '';
                  document.getElementById('entry-visits-to').value = window.cachedVisitor.r_visits_to || '';
                  if (window.cachedVisitor.last_custom_fields) {
                     Object.entries(window.cachedVisitor.last_custom_fields).forEach(([k,v]) => {
                        const el = document.getElementById('custom-'+k);
                        if (el) el.value = v;
                     });
                  }
                  this.parentNode.parentNode.innerHTML = '<div style=\\'text-align:center; font-weight:900;\\'>✅ DATOS CARGADOS</div>';
                  setTimeout(() => { const b = document.querySelector('[data-action=\\'CONFIRM_ENTRY\\']'); if(b) b.focus(); }, 100);
                " style="background:#1a1a2e; color:white; border:none; padding:10px; border-radius:8px; font-weight:900; font-size:0.75rem; cursor:pointer;">
                  SÍ, MISMO DESTINO
                </button>
                <button onclick="
                  document.getElementById('entry-phone').value = '';
                  document.getElementById('entry-visits-to').value = '';
                  document.querySelectorAll('[id^=\\'custom-\\']').forEach(el => el.value = '');
                  this.parentNode.parentNode.innerHTML = '<div style=\\'text-align:center; font-weight:900;\\'>✏️ EDITANDO DESTINO...</div>';
                " style="background:transparent; border:2px solid #1a1a2e; color:#1a1a2e; padding:8px; border-radius:8px; font-weight:900; font-size:0.75rem; cursor:pointer;">
                  EDITAR (NUEVO)
                </button>
             </div>
           \`
           plateEl.parentNode.insertBefore(banner, plateEl.nextSibling)
         }`;

if (code.includes('if (!found) return\n            <div style="font-size:0.7rem')) {
    code = code.replace(target1, replacement);
}

// Fallback search
if (!code.includes('background:#F5C518') && code.includes('const found = resultList && resultList.length > 0')) {
    code = code.replace(/window\.cachedVisitor = null;[\s\S]*?plateEl\.parentNode\.insertBefore\(banner, plateEl\.nextSibling\)\n\s*\}/, replacement);
}

fs.writeFileSync('c:/Users/HP/Desktop/Sloty/Sloty-/src/modules/guard.js', code, 'utf8');
console.log('Fixed guard.js syntax seamlessly!');
