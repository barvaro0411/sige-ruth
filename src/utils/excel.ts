import * as XLSX from 'xlsx';

export type ExcelRow = (string | number | boolean | null | undefined)[];

/**
 * Genera y descarga un archivo Excel (.xlsx) nativo en el navegador.
 * 
 * Configura tipos de celda adecuados, anchos de columna automáticos
 * y asegura compatibilidad con Microsoft Excel, LibreOffice y Google Sheets.
 */
export function createExcelBuffer(
  sheetName: string,
  rows: ExcelRow[],
  customColWidths?: number[]
): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Calcular anchos automáticos de columna si no se proporcionan
  if (!customColWidths && rows.length > 0) {
    const colCount = Math.max(...rows.map(r => r.length));
    const colWidths: { wch: number }[] = [];

    for (let c = 0; c < colCount; c++) {
      let maxLen = 10;
      for (let r = 0; r < rows.length; r++) {
        const val = rows[r][c];
        if (val !== null && val !== undefined) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      }
      // Añadir margen para legibilidad y limitar a 50
      colWidths.push({ wch: Math.min(maxLen + 3, 50) });
    }
    ws['!cols'] = colWidths;
  } else if (customColWidths) {
    ws['!cols'] = customColWidths.map(wch => ({ wch }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const excelBuffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  });

  return new Uint8Array(excelBuffer);
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  rows: ExcelRow[],
  customColWidths?: number[]
): void {
  const buffer = createExcelBuffer(sheetName, rows, customColWidths);
  const blob = new Blob([buffer.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
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
