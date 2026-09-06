import { describe, it, expect } from 'vitest';
import { createExcelBuffer } from './excel';
import { columnaAletra, nombreDeHojaValido, escribirXlsx } from './xlsx';

/** Descomprime con la API del navegador: el inverso exacto de lo que escribe. */
async function inflarCrudo(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/**
 * Lector de ZIP mínimo, solo para las pruebas.
 *
 * Recorre el directorio central en vez de los encabezados locales: es el índice
 * que usa cualquier lector real, así que si esto abre el archivo, Excel también.
 * Sin dependencias de ningún tipo.
 */
async function leerZip(bytes: Uint8Array): Promise<Map<string, string>> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El fin del directorio central se busca desde el final: lleva firma propia.
  let finCentral = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (vista.getUint32(i, true) === 0x06054b50) { finCentral = i; break; }
  }
  if (finCentral < 0) throw new Error('ZIP sin directorio central');

  const cantidad = vista.getUint16(finCentral + 10, true);
  let cursor = vista.getUint32(finCentral + 16, true);
  const decodificador = new TextDecoder();
  const archivos = new Map<string, string>();

  for (let n = 0; n < cantidad; n++) {
    if (vista.getUint32(cursor, true) !== 0x02014b50) throw new Error('Entrada central inválida');
    const metodo = vista.getUint16(cursor + 10, true);
    const tamanoComprimido = vista.getUint32(cursor + 20, true);
    const tamanoCrudo = vista.getUint32(cursor + 24, true);
    const largoNombre = vista.getUint16(cursor + 28, true);
    const largoExtra = vista.getUint16(cursor + 30, true);
    const largoComentario = vista.getUint16(cursor + 32, true);
    const desplazamientoLocal = vista.getUint32(cursor + 42, true);
    const nombre = decodificador.decode(bytes.subarray(cursor + 46, cursor + 46 + largoNombre));

    // El encabezado local repite los largos: el dato empieza después de ellos.
    const largoNombreLocal = vista.getUint16(desplazamientoLocal + 26, true);
    const largoExtraLocal = vista.getUint16(desplazamientoLocal + 28, true);
    const inicio = desplazamientoLocal + 30 + largoNombreLocal + largoExtraLocal;
    const crudo = bytes.subarray(inicio, inicio + tamanoComprimido);

    const contenido = metodo === 8 ? await inflarCrudo(crudo) : crudo;
    expect(contenido.length).toBe(tamanoCrudo);
    archivos.set(nombre, decodificador.decode(contenido));

    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }

  return archivos;
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Reconstruye la matriz de celdas leyendo la hoja y la tabla de cadenas. */
function leerFilas(archivos: Map<string, string>): (string | number | boolean)[][] {
  const compartidas = [...(archivos.get('xl/sharedStrings.xml') ?? '')
    .matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)]
    .map(m => desescapar(m[1]));

  const hoja = archivos.get('xl/worksheets/sheet1.xml') ?? '';
  const filas: (string | number | boolean)[][] = [];

  for (const filaXml of hoja.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)) {
    const celdas: (string | number | boolean)[] = [];
    for (const celda of filaXml[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)><v>([\s\S]*?)<\/v><\/c>/g)) {
      const columna = celda[1].split('').reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0);
      const atributos = celda[2];
      const valor = celda[3];
      while (celdas.length < columna - 1) celdas.push('');
      if (atributos.includes('t="s"')) celdas[columna - 1] = compartidas[Number(valor)];
      else if (atributos.includes('t="b"')) celdas[columna - 1] = valor === '1';
      else celdas[columna - 1] = Number(valor);
    }
    filas[Number(filaXml[1]) - 1] = celdas;
  }

  return filas;
}

describe('createExcelBuffer', () => {
  it('genera un .xlsx que un lector de ZIP puede abrir y recorrer', async () => {
    const rows = [
      ['RUT', 'Nombre', 'Nivel', 'Edad'],
      ['123456785', 'Juan Pérez', 'Medio Mayor', 3],
      ['987654332', 'María González', 'NT1', 4],
    ];

    const buffer = await createExcelBuffer('Alumnos', rows);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
    // Firma de ZIP: 'PK\x03\x04'.
    expect([...buffer.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const archivos = await leerZip(buffer);
    expect(leerFilas(archivos)).toEqual(rows);
  });

  it('incluye las seis partes que Excel exige', async () => {
    const archivos = await leerZip(await createExcelBuffer('Hoja', [['A']]));
    expect([...archivos.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/sharedStrings.xml',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('escribe el nombre de la hoja y lo recorta a 31 caracteres', async () => {
    const largo = 'Esta es una hoja con un nombre excesivamente largo para Excel';
    const archivos = await leerZip(await createExcelBuffer(largo, [['A', 'B']]));
    const nombre = /<sheet name="([^"]*)"/.exec(archivos.get('xl/workbook.xml') ?? '')?.[1];
    expect(nombre).toBe(largo.slice(0, 31).trim());
    expect(nombre!.length).toBeLessThanOrEqual(31);
  });

  it('escapa el XML en vez de romper el archivo', async () => {
    const rows = [['Nombre & "apodo"', '<script>alert(1)</script>', "O'Higgins"]];
    const archivos = await leerZip(await createExcelBuffer('Escapes', rows));
    expect(archivos.get('xl/sharedStrings.xml')).not.toContain('<script>');
    expect(leerFilas(archivos)[0]).toEqual(rows[0]);
  });

  it('descarta los caracteres de control que dejarían el archivo ilegible', async () => {
    const sucio = `hola${String.fromCharCode(0, 7, 11, 27)}mundo`;
    const archivos = await leerZip(await createExcelBuffer('Control', [[sucio]]));
    expect(leerFilas(archivos)[0][0]).toBe('holamundo');
  });

  it('distingue número, booleano y texto', async () => {
    const archivos = await leerZip(await createExcelBuffer('Tipos', [[42, true, false, '42']]));
    expect(leerFilas(archivos)[0]).toEqual([42, true, false, '42']);
  });

  it('reutiliza las cadenas repetidas en vez de escribirlas de nuevo', async () => {
    const rows = Array.from({ length: 50 }, () => ['NT1', 'Gambino']);
    const archivos = await leerZip(await createExcelBuffer('Repetidas', rows));
    const unicas = /uniqueCount="(\d+)"/.exec(archivos.get('xl/sharedStrings.xml') ?? '')?.[1];
    expect(unicas).toBe('2');
  });

  it('deja una hoja vacía en un archivo válido, no en uno corrupto', async () => {
    const archivos = await leerZip(await createExcelBuffer('Vacia', []));
    expect(archivos.get('xl/worksheets/sheet1.xml')).toContain('<sheetData></sheetData>');
  });
});

describe('escribirXlsx', () => {
  it('produce los mismos bytes para la misma entrada', async () => {
    const filas = [['a', 1], ['b', 2]];
    const uno = await escribirXlsx('H', filas);
    const otro = await escribirXlsx('H', filas);
    expect([...uno]).toEqual([...otro]);
  });
});

describe('columnaAletra', () => {
  it('convierte índices a letras de columna', () => {
    expect(columnaAletra(1)).toBe('A');
    expect(columnaAletra(26)).toBe('Z');
    expect(columnaAletra(27)).toBe('AA');
    expect(columnaAletra(52)).toBe('AZ');
    expect(columnaAletra(702)).toBe('ZZ');
  });
});

describe('nombreDeHojaValido', () => {
  it('reemplaza los caracteres que Excel rechaza', () => {
    expect(nombreDeHojaValido('Ventas/2026')).toBe('Ventas 2026');
    expect(nombreDeHojaValido('a[b]c*d?e:f\\g')).toBe('a b c d e f g');
  });

  it('nunca devuelve un nombre vacío', () => {
    expect(nombreDeHojaValido('   ')).toBe('Hoja1');
    expect(nombreDeHojaValido('///')).toBe('Hoja1');
  });
});
