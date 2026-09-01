import { supabase } from '../db/database';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

const EXTENSIONES_PERMITIDAS = ['pdf', 'png', 'jpg', 'jpeg'];
const CAMPOS_DOCUMENTO = 'id,estudiante_id,nombre_archivo,ruta_archivo,url_archivo,subido_por,sede_id,created_at';

/**
 * DocumentoService
 * Gestiona la subida de archivos al Storage y su registro en la DB.
 */
export const DocumentoService = {
  /**
   * Obtener todos los documentos de un estudiante
   */
  async getByEstudiante(estudianteId: number) {
    const { data, error } = await supabase
      .from('estudiantes_documentos')
      .select(CAMPOS_DOCUMENTO)
      .eq('estudiante_id', estudianteId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Promise.all((data || []).map(async (documento) => {
      const ruta = documento.ruta_archivo || documento.url_archivo;
      if (!ruta) return documento;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('documentos_estudiantes')
        .createSignedUrl(ruta, 60 * 60);

      if (signedError) throw signedError;
      return { ...documento, url_archivo: signedData.signedUrl };
    }));
  },

  /**
   * Subir un archivo al storage y registrarlo en la DB
   * Nota: La auditoría se realiza automáticamente vía Triggers en la DB.
   */
  async upload(file: File, estudianteId: number, sedeId: string) {
    // El nombre lo controla el usuario: se acepta solo una extensión conocida
    // para que nunca forme parte arbitraria de la ruta del objeto.
    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.includes(fileExt)) {
      throw new Error('Formato no permitido. Solo se aceptan PDF, PNG o JPG.');
    }
    const filePath = `${sedeId}/${estudianteId}/${crypto.randomUUID()}.${fileExt}`;

    // 1. Subir al Storage (Cubo 'documentos_estudiantes')
    const { error: uploadError } = await supabase.storage
      .from('documentos_estudiantes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Registrar la ruta. El bucket es privado y la URL se firma al leer.
    const { data, error: dbError } = await supabase
      .from('estudiantes_documentos')
      .insert({
        estudiante_id: estudianteId,
        nombre_archivo: file.name,
        ruta_archivo: filePath,
        url_archivo: filePath,
        sede_id: sedeId
      })
      .select(CAMPOS_DOCUMENTO)
      .single();

    if (dbError) {
      // Evita archivos huérfanos si falla el registro en la base de datos.
      await supabase.storage.from('documentos_estudiantes').remove([filePath]);
      throw dbError;
    }
    return data;
  },

  /**
   * Eliminar un documento del storage y de la DB
   */
  async delete(docId: string) {
    const { data: documento, error: fetchError } = await supabase
      .from('estudiantes_documentos')
      .select('ruta_archivo, url_archivo')
      .eq('id', docId)
      .single();

    if (fetchError) throw fetchError;

    const path = documento.ruta_archivo || documento.url_archivo;
    if (path) {
      const { error: storageError } = await supabase.storage
        .from('documentos_estudiantes')
        .remove([path]);
      if (storageError) throw storageError;
    }

    // La política de Storage comprueba la metadata: el objeto se elimina
    // mientras esa fila todavía existe. Si la segunda operación falla, queda
    // metadata reparable, nunca un archivo privado huérfano.
    const { data, error } = await supabase
      .from('estudiantes_documentos')
      .delete()
      .eq('id', docId)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  }
};
