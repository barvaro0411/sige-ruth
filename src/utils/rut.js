// RUT Validator for Chilean RUT (Rol Único Tributario)
// Algorithm: Módulo 11 con serie 2-7

export function cleanRut(rut) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function formatRut(rut) {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  let formatted = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted;
    count++;
    if (count === 3 && i > 0) {
      formatted = '.' + formatted;
      count = 0;
    }
  }
  
  return `${formatted}-${dv}`;
}

export function calculateDV(rutBody) {
  const clean = rutBody.toString().replace(/[^0-9]/g, '');
  let sum = 0;
  let multiplier = 2;
  
  for (let i = clean.length - 1; i >= 0; i--) {
    sum += parseInt(clean[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = 11 - (sum % 11);
  
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

export function validateRut(rut) {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  
  if (body.length < 1 || body.length > 8) return false;
  if (!/^\d+$/.test(body)) return false;
  
  const expectedDV = calculateDV(body);
  return dv === expectedDV;
}

export function rutInputHandler(value) {
  const clean = cleanRut(value);
  if (clean.length === 0) return { formatted: '', isValid: false, clean: '' };
  
  const formatted = formatRut(clean);
  const isValid = clean.length >= 2 ? validateRut(clean) : false;
  
  return { formatted, isValid, clean };
}
