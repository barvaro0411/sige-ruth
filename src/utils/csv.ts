/**
 * Serializa una celda según RFC 4180 y neutraliza fórmulas de Excel/Sheets.
 * El apóstrofo hace que =, +, - y @ se interpreten como texto, incluso si el
 * valor trae espacios iniciales.
 */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
