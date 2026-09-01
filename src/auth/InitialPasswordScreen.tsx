import { FormEvent, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';

const PASSWORD_SEGURA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function InitialPasswordScreen() {
  const { changeInitialPassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!PASSWORD_SEGURA.test(password)) {
      setError('Usa al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await changeInitialPassword(password);
    if (!result.success) setError(result.error || 'No se pudo cambiar la contraseña.');
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-header">
          <div className="login-logo"><ShieldCheck size={32} /></div>
          <h1 className="login-title">Crea tu contraseña</h1>
          <p className="login-subtitle">Debes reemplazar la contraseña temporal antes de continuar.</p>
        </header>
        {error && <div className="login-error" role="alert">{error}</div>}
        <form className="login-form" onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input id="new-password" className="form-input" type="password" minLength={12}
                autoComplete="new-password" value={password} disabled={loading}
                onChange={event => setPassword(event.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Repite la contraseña</label>
            <input id="confirm-password" className="form-input" type="password" minLength={12}
              autoComplete="new-password" value={confirmation} disabled={loading}
              onChange={event => setConfirmation(event.target.value)} required />
          </div>
          <button className="btn btn-gold login-submit" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
          <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
