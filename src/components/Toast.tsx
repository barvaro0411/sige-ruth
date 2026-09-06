import {
  createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Cuánto queda en pantalla cada aviso.
 *
 * Un error no puede durar lo mismo que un «Guardado»: es el único lugar donde
 * la app dice qué salió mal, y cuatro segundos no alcanzan para leerlo y actuar.
 * El éxito, en cambio, solo confirma algo que la persona ya sabe que hizo.
 */
const DURACION: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 7000,
  danger: 9000,
};

const ICONOS = {
  success: CheckCircle,
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // `Date.now()` como id colisiona con dos avisos en el mismo milisegundo, y
  // React descarta uno por clave repetida. Un contador no puede repetirse.
  const siguienteId = useRef(0);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador) {
      clearTimeout(temporizador);
      temporizadores.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const programarCierre = useCallback((id: number, ms: number) => {
    const anterior = temporizadores.current.get(id);
    if (anterior) clearTimeout(anterior);
    temporizadores.current.set(id, setTimeout(() => removeToast(id), ms));
  }, [removeToast]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = siguienteId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    programarCierre(id, DURACION[type]);
  }, [programarCierre]);

  // Los temporizadores pendientes se limpian al desmontar.
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      pendientes.forEach(clearTimeout);
      pendientes.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/*
        Dos regiones y no una: `assertive` interrumpe lo que el lector de
        pantalla esté diciendo, que es lo correcto para un error y molesto para
        un «Guardado». Sin esto, la única confirmación que da la app era
        invisible para quien no ve la pantalla.
      */}
      <div className="toast-container">
        <ToastGroup
          toasts={toasts.filter(t => t.type === 'danger' || t.type === 'warning')}
          politeness="assertive"
          onClose={removeToast}
          onHold={id => {
            const temporizador = temporizadores.current.get(id);
            if (temporizador) clearTimeout(temporizador);
          }}
          onRelease={(id, type) => programarCierre(id, DURACION[type])}
        />
        <ToastGroup
          toasts={toasts.filter(t => t.type === 'success' || t.type === 'info')}
          politeness="polite"
          onClose={removeToast}
          onHold={id => {
            const temporizador = temporizadores.current.get(id);
            if (temporizador) clearTimeout(temporizador);
          }}
          onRelease={(id, type) => programarCierre(id, DURACION[type])}
        />
      </div>
    </ToastContext.Provider>
  );
}

interface ToastGroupProps {
  toasts: Toast[];
  politeness: 'polite' | 'assertive';
  onClose: (id: number) => void;
  onHold: (id: number) => void;
  onRelease: (id: number, type: ToastType) => void;
}

function ToastGroup({ toasts, politeness, onClose, onHold, onRelease }: ToastGroupProps) {
  return (
    <div role={politeness === 'assertive' ? 'alert' : 'status'} aria-live={politeness}>
      {toasts.map(toast => {
        const Icono = ICONOS[toast.type];
        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            // El aviso se queda mientras el puntero esté encima o el foco
            // dentro: un mensaje largo no debe desaparecer a mitad de lectura.
            onMouseEnter={() => onHold(toast.id)}
            onMouseLeave={() => onRelease(toast.id, toast.type)}
            onFocusCapture={() => onHold(toast.id)}
            onBlurCapture={() => onRelease(toast.id, toast.type)}
          >
            <div className="toast-icon" aria-hidden="true">
              <Icono size={18} />
            </div>
            <div className="toast-message">{toast.message}</div>
            <button
              type="button"
              className="toast-close"
              onClick={() => onClose(toast.id)}
              aria-label="Cerrar aviso"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
