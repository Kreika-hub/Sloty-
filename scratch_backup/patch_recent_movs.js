const fs = require('fs');

const path = 'src/modules/guard.js';
let code = fs.readFileSync(path, 'utf8');

const target = `              \${openMovs.slice(0, 10).map(m => \`
                <div style="background:#fafafa; border-radius:12px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center;">
                   <div>
                     <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">\${m.plate || '---'}</div>
                     <div style="font-size:0.5rem; color:#999; font-weight:700;">\${m.type} · \${m.slot}</div>
                   </div>
                   <div style="text-align:right;">
                     <div style="font-size:0.8rem; font-weight:900; color:#22c55e;">+\$\${(m.amount||0).toFixed(2)}</div>
                     <div style="font-size:0.45rem; color:#bbb; font-weight:800;">Ref: \${m.reference || 'EFEC'}</div>
                   </div>
                </div>
              \`).join('')}`;

const replacement = `              \${openMovs.slice(0, 10).map(m => {
                const isPending = isTaskPending(m.id);
                return \`
                <div style="background:#fafafa; border-radius:12px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; border:1.5px solid \${isPending ? 'rgba(245,197,24,0.4)' : 'transparent'};">
                   <div>
                     <div style="font-size:0.8rem; font-weight:900; color:var(--primary); display:flex; align-items:center; gap:6px;">
                       \${m.plate || '---'}
                       \${isPending ? \`<span style="font-size:0.5rem; font-weight:800; background:rgba(245,197,24,0.15); color:#ce8a05; padding:1px 5px; border-radius:4px; border:1px solid rgba(245,197,24,0.25);">PENDIENTE</span>\` : ''}
                     </div>
                     <div style="font-size:0.5rem; color:#999; font-weight:700;">\${m.type} · \${m.slot}</div>
                   </div>
                   <div style="text-align:right;">
                     <div style="font-size:0.8rem; font-weight:900; color:#22c55e;">+\$\${(m.amount||0).toFixed(2)}</div>
                     <div style="font-size:0.45rem; color:#bbb; font-weight:800;">Ref: \${m.reference || 'EFEC'}</div>
                   </div>
                </div>
               \`
              }).join('')}`;

const codeNorm = code.replace(/\r\n/g, '\n');
const targetNorm = target.replace(/\r\n/g, '\n');
const replacementNorm = replacement.replace(/\r\n/g, '\n');

if (codeNorm.includes(targetNorm)) {
    let newCode = codeNorm.replace(targetNorm, replacementNorm);
    if (code.includes('\r\n')) {
        newCode = newCode.replace(/\n/g, '\r\n');
    }
    fs.writeFileSync(path, newCode, 'utf8');
    console.log('SUCCESS');
} else {
    console.log('FAILED');
}
