export const escapeHTML = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
  );
};

// Marca un string como HTML de confianza (ya renderizado), para que html`` no lo escape
class SafeHTML {
  constructor(str) { this.value = String(str); }
}
export const raw = (str) => new SafeHTML(str);

export const html = (strings, ...values) => {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    let safeVal;
    if (val instanceof SafeHTML) {
      safeVal = val.value;
    } else if (typeof val === 'string') {
      safeVal = escapeHTML(val);
    } else {
      safeVal = (val !== undefined && val !== null) ? val : '';
    }
    return result + safeVal + str;
  });
};
