import { useState, useEffect } from 'react';
import { DocumentoService } from '../../services/documentoService';
import { useAuth } from '../../auth/AuthContext';
import { useSede } from '../../config/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { FileText, Upload, Trash2, Download, Loader2 } from 'lucide-react';

interface Props {
  estudianteId: number;
  nombreEstudiante: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentManager({ estudianteId, nombreEstudiante, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) loadDocuments();
  }, [isOpen, estudianteId]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const data = await DocumentoService.getByEstudiante(estudianteId);
      setDocuments(data);
    } catch (err) {
      addToast('Error al cargar documentos', 'danger');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('El archivo es demasiado grande (máximo 5MB)', 'warning');
      return;
    }

    setUploading(true);
    try {
      await DocumentoService.upload(file, estudianteId, sede.id);
      addToast('Documento subido con éxito', 'success');
      loadDocuments();
    } catch (err: any) {
      addToast('Error al subir: ' + err.message, 'danger');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, url: string) {
    if (!user || !confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      await DocumentoService.delete(id, url);
      addToast('Documento eliminado', 'success');
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      addToast('Error al eliminar: ' + err.message, 'danger');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Documentos: ${nombreEstudiante}`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ border: '2px dashed var(--color-gray-200)', padding: '20px', borderRadius: '12px', textAlign: 'center', background: 'var(--color-gray-50)' }}>
          <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {uploading ? <Loader2 size={32} className="animate-spin text-info" /> : <Upload size={32} className="text-secondary" />}
            <span style={{ fontWeight: 600 }}>{uploading ? 'Subiendo...' : 'Haga clic para subir un archivo'}</span>
            <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg" />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Archivos Registrados</h4>
          {loading ? <p>Cargando...</p> : documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} className="text-info" />
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{doc.nombre_archivo}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={doc.url_archivo} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><Download size={18} /></a>
                    <button onClick={() => handleDelete(doc.id, doc.url_archivo)} className="btn btn-ghost btn-sm text-danger"><Trash2 size={18} /></button>
                </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
