import { describe, expect, it } from 'vitest';
import { createCsv, csvCell } from './csv';

describe('csvCell', () => {
  it('escapa comillas y saltos de linea', () => {
    expect(csvCell('Ana "Nina"\nCurso A')).toBe('"Ana ""Nina""\nCurso A"');
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("x")'])(
    'neutraliza formula %s',
    value => expect(csvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`),
  );

  it('genera filas RFC 4180 con BOM', () => {
    expect(createCsv([['a', 'b'], ['1', '2']])).toBe('\uFEFF"a","b"\r\n"1","2"\r\n');
  });
});
