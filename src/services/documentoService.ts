import { supabase } from '../db/database';

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
      .select('*')
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
    const fileExt = file.name.split('.').pop();
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
      .select()
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
  async delete(docId: string, _url?: string) {
    const { data: documento, error: fetchError } = await supabase
      .from('estudiantes_documentos')
      .select('ruta_archivo, url_archivo')
      .eq('id', docId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('estudiantes_documentos')
      .delete()
      .eq('id', docId);

    if (error) throw error;

    const path = documento.ruta_archivo || documento.url_archivo;
    if (path) {
      const { error: storageError } = await supabase.storage
        .from('documentos_estudiantes')
        .remove([path]);
      if (storageError) throw storageError;
    }
  }
};
