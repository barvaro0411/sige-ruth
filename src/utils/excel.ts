import { escribirXlsx, CeldaXlsx } from './xlsx';

export type ExcelRow = CeldaXlsx[];

/** Ancho mínimo y máximo de columna, en caracteres. */
const ANCHO_MINIMO = 10;
const ANCHO_MAXIMO = 50;

function calcularAnchos(rows: ExcelRow[]): number[] {
  if (rows.length === 0) return [];

  const columnas = Math.max(...rows.map(r => r.length));
  const anchos: number[] = [];

  for (let c = 0; c < columnas; c++) {
    let mayor = ANCHO_MINIMO;
    for (const fila of rows) {
      const valor = fila[c];
      if (valor === null || valor === undefined) continue;
      const largo = String(valor).length;
      if (largo > mayor) mayor = largo;
    }
    anchos.push(Math.min(mayor + 3, ANCHO_MAXIMO));
  }

  return anchos;
}

/**
 * Genera un archivo Excel (.xlsx) nativo, con anchos de columna calculados,
 * la primera fila en negrita y fija al desplazarse.
 *
 * Es asíncrono porque comprime el ZIP con `CompressionStream`, que es la
 * diferencia entre un reporte de 25 KB y uno de 200 KB — y acá se descarga
 * con datos móviles.
 */
export async function createExcelBuffer(
  sheetName: string,
  rows: ExcelRow[],
  customColWidths?: number[],
): Promise<Uint8Array> {
  return escribirXlsx(sheetName, rows, {
    anchos: customColWidths ?? calcularAnchos(rows),
    cabecera: rows.length > 0,
  });
}

export async function downloadExcel(
  filename: string,
  sheetName: string,
  rows: ExcelRow[],
  customColWidths?: number[],
): Promise<void> {
  const buffer = await createExcelBuffer(sheetName, rows, customColWidths);
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
