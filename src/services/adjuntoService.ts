import { supabase } from '../db/database';
import { mapAdjunto } from '../utils/mappers';
import { Adjunto, MomentoAdjunto, OrigenAdjunto } from '../types';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

/**
 * AdjuntoService
 * Fotos y documentos de solicitudes y mantenciones.
 *
 * El bucket es privado: se guarda la ruta y la URL se firma al leer, por una
 * hora. La ruta empieza por la sede porque las políticas de Storage validan
 * justamente eso — `can_access_sede(split_part(name, '/', 1))`.
 *
 * Las fotos se comprimen a WebP *antes* de subir. Una foto de celular pesa
 * entre 3 y 6 MB, y acá se sube con datos móviles, muchas veces desde el patio.
 * A 1600 px de lado mayor y calidad 0,72 una foto de una filtración queda en
 * unos 150 KB y se sigue viendo perfectamente qué está mojado.
 */

const LADO_MAXIMO = 1600;
const CALIDAD = 0.72;
/** Coincide con el límite del bucket. */
const PESO_MAXIMO = 5 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/**
 * Reduce una foto a WebP. Si el navegador no sabe generar WebP —o si el
 * resultado sale más pesado que el original, que pasa con capturas de
 * pantalla— devuelve el archivo tal cual. Nunca falla por no poder comprimir:
 * subir la foto grande es mejor que no subir nada.
 */
export async function comprimirFoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const img = await cargarImagen(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/webp', CALIDAD)
    );
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], nombre, { type: 'image/webp' });
  } catch {
    return file;
  }
}

export interface SubirAdjunto {
  origen: OrigenAdjunto;
  origenId: number;
  sedeId: string;
  subidoPor: string;
  momento?: MomentoAdjunto | null;
}

export const AdjuntoService = {
  /** Los adjuntos de un origen, ya con su URL firmada. */
  async getPorOrigen(origen: OrigenAdjunto, origenId: number): Promise<Adjunto[]> {
    const { data, error } = await supabase
      .from('adjuntos_solicitudes')
      .select('*')
      .eq('origen', origen)
      .eq('origen_id', origenId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const adjuntos = (data ?? []).map(mapAdjunto);
    if (adjuntos.length === 0) return [];

    const { data: firmadas, error: errorFirma } = await supabase.storage
      .from('adjuntos_solicitudes')
      .createSignedUrls(adjuntos.map(a => a.rutaArchivo), 60 * 60);

    // Sin firma se devuelve el listado igual: se ve el nombre aunque no la foto.
    if (errorFirma) return adjuntos;

    return adjuntos.map((a, i) => ({ ...a, url: firmadas?.[i]?.signedUrl ?? undefined }));
  },

  /**
   * Sube un archivo y lo registra. Las imágenes pasan primero por WebP.
   * Si el registro falla, el objeto se borra: nada de archivos huérfanos.
   */
  async subir(file: File, input: SubirAdjunto): Promise<Adjunto> {
    const archivo = await comprimirFoto(file);

    const extension = EXTENSION_POR_MIME[archivo.type];
    if (!extension) {
      throw new Error('Formato no permitido. Se aceptan fotos (JPG, PNG, WebP) o PDF.');
    }
    if (archivo.size > PESO_MAXIMO) {
      throw new Error('El archivo pesa más de 5 MB, incluso comprimido.');
    }

    // El nombre lo escribe el usuario: nunca forma parte de la ruta del objeto.
    const ruta = `${input.sedeId}/${input.origen}/${input.origenId}/${crypto.randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from('adjuntos_solicitudes')
      .upload(ruta, archivo, { contentType: archivo.type });

    if (errorSubida) throw errorSubida;

    const { data, error } = await supabase
      .from('adjuntos_solicitudes')
      .insert({
        origen: input.origen,
        origen_id: input.origenId,
        sede_id: input.sedeId,
        nombre_archivo: file.name,
        ruta_archivo: ruta,
        tipo_mime: archivo.type,
        tamano_bytes: archivo.size,
        momento: input.momento ?? null,
        subido_por: input.subidoPor,
      })
      .select('*')
      .single();

    if (error) {
      await supabase.storage.from('adjuntos_solicitudes').remove([ruta]);
      throw error;
    }

    return mapAdjunto(data);
  },

  /** Solo quien lo subió puede borrarlo — lo exige la RLS, no el botón. */
  async eliminar(adjunto: Adjunto): Promise<void> {
    // Storage autoriza el borrado mirando la metadata, por eso el objeto va
    // primero. El orden contrario deja archivos privados huérfanos.
    const { error: storageError } = await supabase.storage
      .from('adjuntos_solicitudes')
      .remove([adjunto.rutaArchivo]);
    if (storageError) throw storageError;

    const { data, error } = await supabase
      .from('adjuntos_solicitudes')
      .delete()
      .eq('id', adjunto.id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },
};
