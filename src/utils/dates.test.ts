import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, formatDateTime, getToday, getMonthName } from './dates';

/**
 * Regresión de un desfase de un día.
 *
 * Las columnas `date` de Postgres llegan como "2026-08-29", sin hora. `new Date`
 * las interpreta como medianoche UTC, y Chile está detrás de UTC: al mostrarlas
 * salían corridas un día hacia atrás. Un permiso que empezaba el 29 se leía como
 * el 28, y un préstamo vencía un día antes de lo que decía la base.
 *
 * Las pruebas comprueban los componentes de la fecha y no el texto exacto: el
 * separador de `es-CL` depende de la versión de ICU y cambia entre Node y el
 * navegador. Lo que no puede cambiar nunca es el día.
 */

/** [día, mes, año] de una fecha ya formateada, sea con guiones o con barras. */
function partes(texto: string): string[] {
  return texto.split(/[^\d]+/).filter(Boolean);
}

describe('fechas sin hora', () => {
  it('se muestran el mismo día que dice la base', () => {
    expect(partes(formatDate('2026-08-29'))).toEqual(['29', '08', '2026']);
  });

  it('no se corren en el cambio de mes', () => {
    expect(partes(formatDate('2026-09-01'))).toEqual(['01', '09', '2026']);
    expect(partes(formatDate('2026-03-01'))).toEqual(['01', '03', '2026']);
  });

  it('no se corren en el cambio de año', () => {
    expect(partes(formatDate('2027-01-01'))).toEqual(['01', '01', '2027']);
  });

  it('el 29 de febrero de un año bisiesto se mantiene', () => {
    expect(partes(formatDate('2028-02-29'))).toEqual(['29', '02', '2028']);
  });

  it('ninguna fecha del año se corre', () => {
    // Barrido completo: si alguna vuelve a desfasarse, esta prueba la nombra.
    for (let mes = 1; mes <= 12; mes++) {
      for (const dia of [1, 15, 28]) {
        const mm = String(mes).padStart(2, '0');
        const dd = String(dia).padStart(2, '0');
        const iso = `2026-${mm}-${dd}`;
        expect(partes(formatDate(iso)), `se corrió ${iso}`).toEqual([dd, mm, '2026']);
      }
    }
  });
});

describe('marcas de tiempo completas', () => {
  it('se respetan tal cual: un timestamp trae su propia zona', () => {
    expect(partes(formatDate('2026-08-29T15:30:00-04:00'))).toEqual(['29', '08', '2026']);
  });

  it('formatTime devuelve hora y minutos', () => {
    expect(formatTime('2026-08-29T15:30:00-04:00')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formatDateTime junta fecha y hora', () => {
    const r = formatDateTime('2026-08-29T15:30:00-04:00');
    expect(r).toContain('29');
    expect(r).toMatch(/\d{1,2}:\d{2}/);
  });

  it('acepta un objeto Date', () => {
    expect(partes(formatDate(new Date(2026, 7, 29, 12, 0, 0)))).toEqual(['29', '08', '2026']);
  });
});

describe('ayudantes', () => {
  it('getToday devuelve el formato que espera un input date', () => {
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getToday se puede volver a formatear sin perder el día', () => {
    const hoy = getToday();
    const [a, m, d] = hoy.split('-');
    expect(partes(formatDate(hoy))).toEqual([d, m, a]);
  });

  it('getMonthName cubre los doce meses', () => {
    for (let i = 0; i < 12; i++) {
      expect(getMonthName(i), `mes ${i}`).toBeTruthy();
    }
    expect(getMonthName(0)).toBe('Enero');
    expect(getMonthName(11)).toBe('Diciembre');
  });
});
