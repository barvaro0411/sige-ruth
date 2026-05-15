import { supabase } from '../db/database';

const DOCUMENTS_BUCKET = 'documentos_estudiantes';
const SIGNED_URL_TTL_SECONDS = 60 * 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 180;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function getStoragePath(value: string) {
  return value.includes(`${DOCUMENTS_BUCKET}/`)
    ? value.split(`${DOCUMENTS_BUCKET}/`).pop()
    : value;
}

/**
 * DocumentoService
 * Gestiona archivos en un bucket privado y entrega signed URLs temporales.
 */
export const DocumentoService = {
  async getByEstudiante(estudianteId: number) {
    const { data, error } = await supabase
      .from('estudiantes_documentos')
      .select('id,estudiante_id,nombre_archivo,url_archivo,subido_por,sede_id,created_at')
      .eq('estudiante_id', estudianteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const paths = data.map(doc => getStoragePath(doc.url_archivo)).filter(Boolean) as string[];
    
    const { data: signedUrls, error: signedError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    const signedMap = new Map((signedUrls || []).map(item => [item.path, item.signedUrl]));

    return data.map(doc => {
      const path = getStoragePath(doc.url_archivo);
      return {
        ...doc,
        storage_path: path,
        signed_url: (path && signedMap.get(path)) || null
      };
    });
  },

  async upload(file: File, estudianteId: number, sedeId: string, uploadedBy: string) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error('Tipo de archivo no permitido.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('El archivo es demasiado grande. El maximo permitido es 5MB.');
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filePath = `${estudianteId}/${crypto.randomUUID()}.${fileExt}`;
    const safeFileName = file.name.trim().slice(0, MAX_FILE_NAME_LENGTH) || 'documento';

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data, error: dbError } = await supabase
      .from('estudiantes_documentos')
      .insert({
        estudiante_id: estudianteId,
        nombre_archivo: safeFileName,
        url_archivo: filePath,
        subido_por: uploadedBy,
        sede_id: sedeId
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
      throw dbError;
    }

    return data;
  },

  async delete(docId: string, url: string) {
    const path = getStoragePath(url);

    const { error } = await supabase
      .from('estudiantes_documentos')
      .delete()
      .eq('id', docId);

    if (error) throw error;

    if (path) {
      const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      if (storageError) throw storageError;
    }
  }
};
