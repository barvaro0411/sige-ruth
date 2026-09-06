import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { MatriculaDocument } from './MatriculaDocument';
import Modal from '../../components/Modal';
import { FileText, Download, X, Printer } from 'lucide-react';
import { Estudiante, Sede } from '../../types';

interface MatriculaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  estudiante: Estudiante | null;
  sede: Sede;
}

export default function MatriculaPreviewModal({ isOpen, onClose, estudiante, sede }: MatriculaPreviewModalProps) {
  if (!estudiante) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ficha de Matrícula: ${estudiante.nombre} ${estudiante.apellidoPaterno}`}>
      <div className="matricula-preview-container" style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>

        {/* Toolbar superior del Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid var(--border-medium)',
          backgroundColor: 'var(--bg-subtle)'
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-navy)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <p className="font-bold text-sm text-navy">Vista Previa Digital</p>
              <p className="text-xs text-secondary">Generado automáticamente • v6.0</p>
            </div>
          </div>

          <div className="flex gap-3">
            <PDFDownloadLink
              document={<MatriculaDocument estudiante={estudiante} sede={sede} />}
              fileName={`Matricula_${estudiante.apellidoPaterno}_${estudiante.nombre}.pdf`}
              className="btn btn-gold"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {({ loading }) =>
                loading ? 'Cargando...' : (
                  <>
                    <Download size={18} />
                    Descargar PDF
                  </>
                )
              }
            </PDFDownloadLink>
            <button onClick={onClose} className="btn btn-outline flex items-center gap-2">
              <X size={18} />
              Cerrar
            </button>
          </div>
        </div>

        {/* Visor de PDF */}
        <div className="flex-1 bg-subtle overflow-hidden">
          <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar={false}>
            <MatriculaDocument estudiante={estudiante} sede={sede} />
          </PDFViewer>
        </div>

        {/* Footer informativo */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'white',
          borderTop: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Printer size={14} style={{ color: 'var(--text-light)' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Recomendación: Imprimir en tamaño A4 con orientación vertical para mantener las firmas alineadas.
          </p>
        </div>
      </div>
    </Modal>
  );
}
