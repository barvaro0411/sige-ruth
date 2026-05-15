import React from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { MatriculaDocument } from './MatriculaDocument';
import Modal from '../../components/Modal';
import { FileText, Download, X, Printer } from 'lucide-react';

export default function MatriculaPreviewModal({ isOpen, onClose, estudiante, sede }) {
  if (!estudiante) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ficha de Matrícula: ${estudiante.nombre} ${estudiante.apellidoPaterno}`}>
      <div className="matricula-preview-container" style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
        
        {/* Toolbar superior del Modal */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: 'var(--space-4)', 
          borderBottom: '1px solid var(--color-gray-200)',
          backgroundColor: 'var(--color-gray-50)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 'var(--radius-lg)', 
              backgroundColor: 'var(--color-navy)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Vista Previa Digital</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Generado automáticamente • v6.0</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <PDFDownloadLink 
              document={<MatriculaDocument estudiante={estudiante} sede={sede} />} 
              fileName={`Matricula_${estudiante.apellidoPaterno}_${estudiante.nombre}.pdf`}
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              {({ blob, url, loading, error }) => 
                loading ? 'Cargando...' : (
                  <>
                    <Download size={18} />
                    Descargar PDF
                  </>
                )
              }
            </PDFDownloadLink>
            <button onClick={onClose} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <X size={18} />
              Cerrar
            </button>
          </div>
        </div>

        {/* Visor de PDF */}
        <div style={{ flex: 1, backgroundColor: 'var(--color-gray-100)', overflow: 'hidden' }}>
          <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar={false}>
            <MatriculaDocument estudiante={estudiante} sede={sede} />
          </PDFViewer>
        </div>

        {/* Footer informativo */}
        <div style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          backgroundColor: 'white', 
          borderTop: '1px solid var(--color-gray-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          <Printer size={14} style={{ color: 'var(--color-gray-400)' }} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
            Recomendación: Imprimir en tamaño A4 con orientación vertical para mantener las firmas alineadas.
          </p>
        </div>
      </div>
    </Modal>
  );
}
