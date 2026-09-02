import { describe, it, expect } from 'vitest';
import { createExcelBuffer } from './excel';
import * as XLSX from 'xlsx';

describe('createExcelBuffer', () => {
  it('genera un buffer binario XLSX válido que puede ser leído por SheetJS', () => {
    const rows = [
      ['RUT', 'Nombre', 'Nivel', 'Edad'],
      ['12.345.678-5', 'Juan Pérez', 'Medio Mayor', 3],
      ['9.876.543-2', 'María González', 'NT1', 4],
    ];

    const buffer = createExcelBuffer('Alumnos', rows);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);

    // Leer el buffer para verificar su integridad
    const wb = XLSX.read(buffer, { type: 'array' });
    expect(wb.SheetNames).toContain('Alumnos');

    const sheet = wb.Sheets['Alumnos'];
    const parsedRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(parsedRows).toEqual(rows);
  });

  it('respeta límites de longitud para el nombre de la hoja', () => {
    const longName = 'Esta es una hoja de cálculo con un nombre excesivamente largo para Excel';
    const buffer = createExcelBuffer(longName, [['A', 'B']]);
    const wb = XLSX.read(buffer, { type: 'array' });
    expect(wb.SheetNames[0].length).toBeLessThanOrEqual(31);
  });
});
