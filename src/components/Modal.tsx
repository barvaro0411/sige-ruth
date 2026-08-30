import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode; // Optional footer
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-box ${size}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {/* Es el unico contenido del boton, asi que sin `aria-label` un
              lector de pantalla lo anuncia como «boton», sin decir cual. */}
          <button className="modal-close" onClick={onClose} aria-label={`Cerrar ${title}`}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
