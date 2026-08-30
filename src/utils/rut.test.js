import { describe, it, expect } from 'vitest';
import { cleanRut, formatRut, calculateDV, validateRut, rutInputHandler } from './rut';

/**
 * El RUT identifica a cada estudiante y es la clave con la que se evitan
 * duplicados al matricular. Un validador que acepta un RUT invalido deja
 * entrar un registro que despues nadie sabe de quien es.
 */
describe('digito verificador', () => {
  // Propiedad: un RUT armado con su propio DV siempre es valido. Cubre mas
  // casos que una lista escrita a mano, y no depende de que yo calcule bien.
  it('todo cuerpo mas su DV calculado es valido', () => {
    const cuerpos = ['12345678', '11111111', '9999999', '1', '5000000', '22222222', '7654321'];
    for (const cuerpo of cuerpos) {
      const dv = calculateDV(cuerpo);
      expect(validateRut(cuerpo + dv), `${cuerpo}-${dv} deberia ser valido`).toBe(true);
    }
  });

  it('coincide con RUT conocidos', () => {
    expect(calculateDV('12345678')).toBe('5');
    expect(calculateDV('11111111')).toBe('1');
  });

  it('devuelve K cuando el resto lo exige', () => {
    // Se busca un cuerpo cuyo DV sea K en vez de inventarlo a mano.
    let conK = null;
    for (let i = 1000000; i < 1000200; i++) {
      if (calculateDV(String(i)) === 'K') { conK = String(i); break; }
    }
    expect(conK, 'no se encontro ningun cuerpo con DV = K').not.toBeNull();
    expect(validateRut(conK + 'K')).toBe(true);
  });
});

describe('validateRut', () => {
  it('rechaza un DV equivocado', () => {
    const dv = calculateDV('12345678');
    const otro = dv === '1' ? '2' : '1';
    expect(validateRut('12345678' + otro)).toBe(false);
  });

  it('rechaza basura', () => {
    for (const malo of ['', '1', 'abc', '---', '0']) {
      expect(validateRut(malo), `${malo} no deberia pasar`).toBe(false);
    }
  });

  it('rechaza un cuerpo demasiado largo', () => {
    expect(validateRut('1234567890' + calculateDV('1234567890'))).toBe(false);
  });

  it('acepta el RUT con puntos y guion, como lo escribe una persona', () => {
    expect(validateRut('12.345.678-5')).toBe(true);
  });

  it('acepta la K en minuscula', () => {
    let conK = null;
    for (let i = 1000000; i < 1000200; i++) {
      if (calculateDV(String(i)) === 'K') { conK = String(i); break; }
    }
    expect(validateRut(conK + 'k')).toBe(true);
  });
});

describe('formato', () => {
  it('agrupa de a tres y separa el DV', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
  });

  it('formatea un RUT corto sin puntos sobrantes', () => {
    expect(formatRut('12345')).toBe('1.234-5');
  });

  it('cleanRut deja solo digitos y K en mayuscula', () => {
    expect(cleanRut('12.345.678-k')).toBe('123456785'.slice(0, 8) + 'K');
    expect(cleanRut('  12.345.678-5  ')).toBe('123456785');
  });
});

describe('rutInputHandler', () => {
  it('formatea mientras se escribe y avisa si ya es valido', () => {
    const r = rutInputHandler('123456785');
    expect(r.formatted).toBe('12.345.678-5');
    expect(r.isValid).toBe(true);
    expect(r.clean).toBe('123456785');
  });

  it('un RUT a medio escribir no es valido todavia, pero no revienta', () => {
    const r = rutInputHandler('123');
    expect(r.isValid).toBe(false);
    expect(typeof r.formatted).toBe('string');
  });

  it('el campo vacio devuelve todo vacio', () => {
    expect(rutInputHandler('')).toEqual({ formatted: '', isValid: false, clean: '' });
  });
});
