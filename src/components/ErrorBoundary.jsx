import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // In a real app, you would log this error to an error reporting service
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-color)',
          padding: 'var(--space-4)',
          fontFamily: 'var(--font-primary)'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
            boxShadow: 'var(--shadow-xl)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)'
            }}>
              <AlertTriangle size={32} />
            </div>
            
            <h1 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              Oops! Algo salió mal.
            </h1>
            
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-6)',
              lineHeight: 1.5
            }}>
              Ocurrió un error inesperado. Nuestro equipo ha sido notificado del problema.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div style={{
                textAlign: 'left',
                backgroundColor: 'var(--color-gray-100)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: 'var(--space-6)',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                <p style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                  {this.state.error && this.state.error.toString()}
                </p>
                <pre style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn-primary"
                style={{ flex: 1, padding: 'var(--space-3)' }}
              >
                <RefreshCw size={18} />
                Recargar página
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                className="btn btn-outline"
                style={{ flex: 1, padding: 'var(--space-3)' }}
              >
                <Home size={18} />
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
