/**
 * Escritor de archivos .xlsx, sin dependencias.
 *
 * Reemplaza a `xlsx` (SheetJS), que dejó de publicarse en npm en la 0.18.5 y
 * quedó con dos avisos de seguridad sin parche en ese registro. Los dos exigen
 * *parsear* un archivo ajeno y acá solo se escribe, así que el riesgo real era
 * bajo — pero mantenía el `npm audit` del CI en rojo, y con el semáforo en rojo
 * los otros seis pasos dejan de mirarse. De paso se van 283 KB del bundle.
 *
 * Un .xlsx es un ZIP con XML adentro. Nada de esto es magia: se arma el ZIP a
 * mano (~120 líneas) y se escriben las cinco partes que Excel exige. El alcance
 * es deliberadamente el que necesita el proyecto —una hoja, celdas de texto,
 * número o booleano, anchos de columna y la primera fila en negrita— y no una
 * línea más.
 *
 * Las cadenas van a una tabla compartida (`sharedStrings`), que es como lo hace
 * Excel: en un reporte de matrícula «Medio Mayor» o el nombre de la sede se
 * repiten cientos de veces y así se guardan una sola vez.
 */

// -----------------------------------------------------------------------------
// ZIP
// -----------------------------------------------------------------------------

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Comprime con deflate crudo, que es exactamente lo que pide el método 8 del
 * ZIP. Si el entorno no lo ofrece —navegadores anteriores a 2023— devuelve
 * `null` y la entrada se guarda sin comprimir: el archivo pesa más y se abre
 * igual. Nunca falla por no poder comprimir.
 */
async function desinflar(datos: Uint8Array): Promise<Uint8Array | null> {
  try {
    const flujo = new Blob([datos as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  } catch {
    return null;
  }
}

interface ArchivoZip {
  nombre: string;
  contenido: string;
}

/** Fecha fija: la salida no depende del reloj, así las pruebas comparan bytes. */
const FECHA_DOS = 0x0021; // 1980-01-01
const HORA_DOS = 0x0000;

async function crearZip(archivos: ArchivoZip[]): Promise<Uint8Array> {
  const codificador = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const crudo = codificador.encode(archivo.contenido);
    const comprimido = await desinflar(crudo);
    const datos = comprimido ?? crudo;
    const metodo = comprimido ? 8 : 0;
    const nombre = codificador.encode(archivo.nombre);
    const suma = crc32(crudo);

    const local = new Uint8Array(30 + nombre.length);
    const vistaLocal = new DataView(local.buffer);
    vistaLocal.setUint32(0, 0x04034b50, true);
    vistaLocal.setUint16(4, 20, true);       // versión necesaria
    vistaLocal.setUint16(6, 0x0800, true);   // nombres en UTF-8
    vistaLocal.setUint16(8, metodo, true);
    vistaLocal.setUint16(10, HORA_DOS, true);
    vistaLocal.setUint16(12, FECHA_DOS, true);
    vistaLocal.setUint32(14, suma, true);
    vistaLocal.setUint32(18, datos.length, true);
    vistaLocal.setUint32(22, crudo.length, true);
    vistaLocal.setUint16(26, nombre.length, true);
    vistaLocal.setUint16(28, 0, true);       // sin campo extra
    local.set(nombre, 30);

    const central = new Uint8Array(46 + nombre.length);
    const vistaCentral = new DataView(central.buffer);
    vistaCentral.setUint32(0, 0x02014b50, true);
    vistaCentral.setUint16(4, 20, true);     // versión de origen
    vistaCentral.setUint16(6, 20, true);     // versión necesaria
    vistaCentral.setUint16(8, 0x0800, true);
    vistaCentral.setUint16(10, metodo, true);
    vistaCentral.setUint16(12, HORA_DOS, true);
    vistaCentral.setUint16(14, FECHA_DOS, true);
    vistaCentral.setUint32(16, suma, true);
    vistaCentral.setUint32(20, datos.length, true);
    vistaCentral.setUint32(24, crudo.length, true);
    vistaCentral.setUint16(28, nombre.length, true);
    vistaCentral.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);

    locales.push(local, datos);
    centrales.push(central);
    desplazamiento += local.length + datos.length;
  }

  const tamanoCentral = centrales.reduce((total, parte) => total + parte.length, 0);
  const fin = new Uint8Array(22);
  const vistaFin = new DataView(fin.buffer);
  vistaFin.setUint32(0, 0x06054b50, true);
  vistaFin.setUint16(8, archivos.length, true);
  vistaFin.setUint16(10, archivos.length, true);
  vistaFin.setUint32(12, tamanoCentral, true);
  vistaFin.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, fin];
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let cursor = 0;
  for (const parte of partes) {
    salida.set(parte, cursor);
    cursor += parte.length;
  }
  return salida;
}

// -----------------------------------------------------------------------------
// XML
// -----------------------------------------------------------------------------

/**
 * Escapa para XML y descarta los caracteres de control que XML 1.0 no admite.
 * Sin ese descarte, un byte suelto en una observación escrita a mano deja el
 * archivo imposible de abrir, con un error que no dice dónde está el problema.
 */
function escaparXml(texto: string): string {
  return texto
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 1 → A, 26 → Z, 27 → AA. */
export function columnaAletra(indice: number): string {
  let n = indice;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - resto) / 26);
  }
  return letra;
}

/**
 * Excel rechaza `: \ / ? * [ ]` en el nombre de una hoja, la corta en 31
 * caracteres y no acepta que quede vacía.
 */
export function nombreDeHojaValido(nombre: string): string {
  const limpio = nombre.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31).trim();
  return limpio || 'Hoja1';
}

const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export type CeldaXlsx = string | number | boolean | null | undefined;

export interface OpcionesHoja {
  /** Ancho de cada columna, en caracteres. */
  anchos?: number[];
  /** Pone la primera fila en negrita y la deja fija al desplazarse. */
  cabecera?: boolean;
}

function construirHoja(
  filas: CeldaXlsx[][],
  compartidas: Map<string, number>,
  opciones: OpcionesHoja,
): string {
  const partes: string[] = [CABECERA, `<worksheet xmlns="${NS}">`];

  // `sheetViews` va antes que `cols`, y `cols` antes que `sheetData`: el orden
  // de los elementos es parte del esquema, no una preferencia.
  if (opciones.cabecera) {
    partes.push(
      '<sheetViews><sheetView workbookViewId="0">'
      + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '</sheetView></sheetViews>',
    );
  }

  if (opciones.anchos?.length) {
    partes.push('<cols>');
    opciones.anchos.forEach((ancho, i) => {
      partes.push(`<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`);
    });
    partes.push('</cols>');
  }

  partes.push('<sheetData>');

  filas.forEach((fila, indiceFila) => {
    const numeroFila = indiceFila + 1;
    const estilo = opciones.cabecera && indiceFila === 0 ? ' s="1"' : '';
    const celdas: string[] = [];

    fila.forEach((valor, indiceColumna) => {
      // Una celda vacía no se escribe: es lo mismo y ocupa menos.
      if (valor === null || valor === undefined || valor === '') return;
      const referencia = `${columnaAletra(indiceColumna + 1)}${numeroFila}`;

      if (typeof valor === 'number' && Number.isFinite(valor)) {
        celdas.push(`<c r="${referencia}"${estilo}><v>${valor}</v></c>`);
      } else if (typeof valor === 'boolean') {
        celdas.push(`<c r="${referencia}"${estilo} t="b"><v>${valor ? 1 : 0}</v></c>`);
      } else {
        const texto = String(valor);
        let indice = compartidas.get(texto);
        if (indice === undefined) {
          indice = compartidas.size;
          compartidas.set(texto, indice);
        }
        celdas.push(`<c r="${referencia}"${estilo} t="s"><v>${indice}</v></c>`);
      }
    });

    if (celdas.length > 0) {
      partes.push(`<row r="${numeroFila}">${celdas.join('')}</row>`);
    }
  });

  partes.push('</sheetData>');
  partes.push('</worksheet>');
  return partes.join('');
}

function construirCadenasCompartidas(compartidas: Map<string, number>): string {
  const entradas = [...compartidas.keys()]
    .map(texto => `<si><t xml:space="preserve">${escaparXml(texto)}</t></si>`)
    .join('');
  return `${CABECERA}<sst xmlns="${NS}" count="${compartidas.size}" uniqueCount="${compartidas.size}">${entradas}</sst>`;
}

/**
 * Estilos mínimos: dos fuentes (normal y negrita) y dos formatos de celda.
 * Los dos rellenos son obligatorios aunque no se usen — Excel da el archivo
 * por corrupto si `fills` no arranca con `none` y `gray125`.
 */
const ESTILOS = `${CABECERA}<styleSheet xmlns="${NS}">`
  + '<fonts count="2">'
  + '<font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font>'
  + '</fonts>'
  + '<fills count="2">'
  + '<fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '</fills>'
  + '<borders count="1"><border/></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '</cellXfs>'
  + '</styleSheet>';

/**
 * Arma un .xlsx de una hoja y lo devuelve como bytes.
 * Las cadenas se recolectan mientras se escribe la hoja, así que
 * `sharedStrings` se construye después.
 */
export async function escribirXlsx(
  nombreHoja: string,
  filas: CeldaXlsx[][],
  opciones: OpcionesHoja = {},
): Promise<Uint8Array> {
  const hojaValida = nombreDeHojaValido(nombreHoja);
  const compartidas = new Map<string, number>();
  const hoja = construirHoja(filas, compartidas, opciones);

  return crearZip([
    {
      nombre: '[Content_Types].xml',
      contenido: `${CABECERA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        + '</Types>',
    },
    {
      nombre: '_rels/.rels',
      contenido: `${CABECERA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>`
        + '</Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `${CABECERA}<workbook xmlns="${NS}" xmlns:r="${NS_REL}">`
        + `<sheets><sheet name="${escaparXml(hojaValida)}" sheetId="1" r:id="rId1"/></sheets>`
        + '</workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `${CABECERA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
        + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>`
        + `<Relationship Id="rId3" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>`
        + '</Relationships>',
    },
    { nombre: 'xl/styles.xml', contenido: ESTILOS },
    { nombre: 'xl/sharedStrings.xml', contenido: construirCadenasCompartidas(compartidas) },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja },
  ]);
}
