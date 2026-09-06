import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    if (import.meta.env.DEV) console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen" role="alert">
          <div className="error-card">
            <div className="error-icon" aria-hidden="true">
              <AlertTriangle size={32} />
            </div>

            <h1 className="text-xl font-extrabold text-navy mb-2">
              Algo se rompió en esta pantalla
            </h1>

            <p className="text-secondary mb-6 leading-snug">
              No es culpa tuya y no se perdió nada de lo que ya estaba guardado.
              Recarga la página; si vuelve a pasar, avisa a dirección.
            </p>

            {import.meta.env.DEV && (
              <div className="error-detalle">
                <p className="font-semibold text-danger text-sm">
                  {this.state.error && this.state.error.toString()}
                </p>
                <pre className="text-xs mt-2">
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-gold flex-1"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Recargar página
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="btn btn-outline flex-1"
              >
                <Home size={18} aria-hidden="true" />
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
