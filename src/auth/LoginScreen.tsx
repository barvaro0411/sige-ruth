import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
  const { login, error: contextError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Ingrese su correo y contraseña');
      return;
    }

    setLoading(true);
    setError('');
    
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Error de autenticación');
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-header">
          <div className="login-logo">
            <ShieldCheck size={32} />
          </div>
          <h1 className="login-title">SIGE Ruth</h1>
          <p className="login-subtitle">Sistema de Gestión Escolar v6.0</p>
        </header>

        {(error || contextError) && (
          <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error || contextError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Correo Electrónico</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-gold login-submit ${loading ? 'loading' : ''}`}
            disabled={loading || !email || !password}
          >
            {loading ? 'Iniciando sesión...' : 'Entrar al Sistema'}
          </button>
        </form>

        <footer className="login-footer">
          <p>© 2026 Escuela de Lenguaje Ruth</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', color: 'var(--color-navy-light)', fontSize: '12px', fontWeight: 600 }}>
             <span>SECURE-AUTH</span>
             <span>•</span>
             <span>SUPABASE-NATIVE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
