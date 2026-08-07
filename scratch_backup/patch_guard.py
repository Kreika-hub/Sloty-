import re

path = r"src/modules/guard.js"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

target = """               document.getElementById('btn-use-freq').onclick = () => {
                  document.getElementById('movement-name').value = found.name || '';
                  document.getElementById('movement-company').value = found.company || '';
                  document.getElementById('movement-ci').value = found.ci || '';
                  
                  const fields = found.last_custom_fields || {};
                  if (fields['torre'] && document.getElementById('cf-torre')) document.getElementById('cf-torre').value = fields['torre'];
                  if (fields['piso'] && document.getElementById('cf-piso')) document.getElementById('cf-piso').value = fields['piso'];
                  if (fields['apartamento'] && document.getElementById('cf-apartamento')) document.getElementById('cf-apartamento').value = fields['apartamento'];
                  if (fields['destino_final'] && document.getElementById('cf-destino_final')) document.getElementById('cf-destino_final').value = fields['destino_final'];
                  
                  banner.remove();
                  document.querySelector('.cat-chip[data-cat="VISITA"]')?.click();
               };
               document.getElementById('btn-edit-freq').onclick = () => {
                  document.getElementById('movement-name').value = found.name || '';
                  document.getElementById('movement-ci').value = found.ci || '';
                  banner.remove();
                  document.querySelector('.cat-chip[data-cat="VISITA"]')?.click();
               };"""

replacement = """               document.getElementById('btn-use-freq').onclick = () => {
                  const phoneEl = document.getElementById('entry-phone');
                  if (phoneEl) phoneEl.value = found.phone || '';
                  const nameEl = document.getElementById('custom-nombre');
                  if (nameEl) nameEl.value = found.name || found.full_name || '';
                  const aptoEl = document.getElementById('custom-apto');
                  if (aptoEl) {
                     const vTo = found.visits_to || found.r_visits_to || '';
                     aptoEl.value = vTo.replace(/^Apto\\s+/i, '');
                  }
                  banner.remove();
               };
               document.getElementById('btn-edit-freq').onclick = () => {
                  const phoneEl = document.getElementById('entry-phone');
                  if (phoneEl) phoneEl.value = found.phone || '';
                  const nameEl = document.getElementById('custom-nombre');
                  if (nameEl) nameEl.value = found.name || found.full_name || '';
                  const aptoEl = document.getElementById('custom-apto');
                  if (aptoEl) {
                     const vTo = found.visits_to || found.r_visits_to || '';
                     aptoEl.value = vTo.replace(/^Apto\\s+/i, '');
                  }
                  banner.remove();
               };"""

code_norm = code.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in code_norm:
    code_norm = code_norm.replace(target_norm, replacement_norm)
    if "\r\n" in code:
        code_norm = code_norm.replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write(code_norm)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
