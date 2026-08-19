export const escapeHTML = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
  );
};

export const html = (strings, ...values) => {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    const safeVal = typeof val === 'string' ? escapeHTML(val) : (val !== undefined && val !== null ? val : '');
    return result + safeVal + str;
  });
};
