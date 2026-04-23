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
    return data || [];
  },

  /**
   * Subir un archivo al storage y registrarlo en la DB
   * Nota: La auditoría se realiza automáticamente vía Triggers en la DB.
   */
  async upload(file: File, estudianteId: number, sedeId: string) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${estudianteId}/${crypto.randomUUID()}.${fileExt}`;

    // 1. Subir al Storage (Cubo 'documentos_estudiantes')
    const { error: uploadError } = await supabase.storage
      .from('documentos_estudiantes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Obtener la URL pública del archivo
    const { data: urlData } = supabase.storage
      .from('documentos_estudiantes')
      .getPublicUrl(filePath);

    // 3. Registrar el documento en la tabla correspondiente
    const { data, error: dbError } = await supabase
      .from('estudiantes_documentos')
      .insert({
        estudiante_id: estudianteId,
        nombre_archivo: file.name,
        url_archivo: urlData.publicUrl,
        sede_id: sedeId
      })
      .select()
      .single();

    if (dbError) throw dbError;
    return data;
  },

  /**
   * Eliminar un documento del storage y de la DB
   */
  async delete(docId: string, url: string) {
    const path = url.split('documentos_estudiantes/').pop();
    if (path) {
      await supabase.storage.from('documentos_estudiantes').remove([path]);
    }

    const { error } = await supabase
      .from('estudiantes_documentos')
      .delete()
      .eq('id', docId);

    if (error) throw error;
  }
};
