import { ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Lo que el navegador considera enfocable dentro del diálogo. */
const ENFOCABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Diálogo modal.
 *
 * El foco queda atrapado adentro mientras está abierto y vuelve al botón que lo
 * abrió al cerrarse. Antes había un `modalRef` declarado y enganchado al nodo
 * que nunca se leía: la trampa de foco que iba a usarlo no llegó a escribirse,
 * así que con el modal abierto el tabulador se paseaba por el formulario que
 * quedaba detrás — y quien navega con teclado no tenía forma de saber que había
 * salido del diálogo.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const origenRef = useRef<HTMLElement | null>(null);
  // `useId` en vez de una constante: dos modales montados a la vez producían
  // el mismo id y `aria-labelledby` apuntaba a cualquiera de los dos.
  const tituloId = useId();

  const enfocables = useCallback(() => {
    const caja = cajaRef.current;
    if (!caja) return [] as HTMLElement[];
    return [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)]
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    origenRef.current = document.activeElement as HTMLElement | null;

    // El fondo no debe desplazarse mientras el diálogo está abierto: en el
    // celular, arrastrar dentro del modal terminaba moviendo la página.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El primer campo, o la caja misma si el diálogo solo muestra información.
    const primeros = enfocables();
    (primeros[0] ?? cajaRef.current)?.focus();

    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        onClose();
        return;
      }
      if (evento.key !== 'Tab') return;

      const lista = enfocables();
      if (lista.length === 0) {
        evento.preventDefault();
        cajaRef.current?.focus();
        return;
      }

      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement;

      // El ciclo se cierra a mano en los dos extremos: sin esto, el tabulador
      // se escapa a la barra del navegador y de ahí al contenido de atrás.
      if (evento.shiftKey && (activo === primero || !cajaRef.current?.contains(activo))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPresionar, true);

    return () => {
      document.removeEventListener('keydown', alPresionar, true);
      document.body.style.overflow = overflowPrevio;
      // Devolver el foco a donde estaba: si no, al cerrar queda en el <body> y
      // la siguiente pulsación de Tab arranca desde el principio de la página.
      origenRef.current?.focus?.();
    };
  }, [isOpen, onClose, enfocables]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={`modal-box ${size}`}
        ref={cajaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id={tituloId} className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={`Cerrar ventana ${title}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
