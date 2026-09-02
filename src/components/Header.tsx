import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useSede } from '../auth/SedeContext';
import { ROLE_LABELS } from '../auth/permissions';
import { NotificacionService } from '../services/notificacionService';
import { formatDateTime } from '../utils/dates';
import { Menu, MapPin, Bell, User, ChevronDown, Check, BellOff } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

/**
 * Cabecera institucional: sede activa, notificaciones en tiempo real y perfil.
 */
export default function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuth();
  const { sede, setSede, availableSedes } = useSede();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSedeSelector, setShowSedeSelector] = useState(false);

  const notificaciones = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => NotificacionService.getRecientes(),
    enabled: !!user,
    refetchInterval: 1000 * 60 * 2,
  });

  const lista = notificaciones.data ?? [];
  const sinLeer = lista.filter(n => !n.leidaEn).length;

  const marcarTodas = useMutation({
    mutationFn: () => NotificacionService.marcarTodasLeidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const marcarUna = useMutation({
    mutationFn: (id: number) => NotificacionService.marcarLeida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  function abrir(id: number, leida: boolean, enlace: string | null) {
    if (!leida) marcarUna.mutate(id);
    setShowNotifications(false);
    if (enlace) navigate(enlace);
  }

  const notifRef = useRef<HTMLDivElement>(null);
  const sedeRef = useRef<HTMLDivElement>(null);

  const canChangeSede = availableSedes.length > 1;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (sedeRef.current && !sedeRef.current.contains(target)) {
        setShowSedeSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header" aria-label="Cabecera principal">
      <div className="header-left">
        <button 
          type="button"
          className="menu-btn" 
          onClick={onMenuToggle} 
          aria-label="Abrir menú de navegación"
        >
          <Menu size={22} />
        </button>
        
        <div style={{ position: 'relative' }} ref={sedeRef}>
          <div 
            className={`sede-badge ${canChangeSede ? 'clickable' : ''}`}
            onClick={() => canChangeSede && setShowSedeSelector(!showSedeSelector)}
            role={canChangeSede ? 'button' : undefined}
            tabIndex={canChangeSede ? 0 : undefined}
            aria-haspopup={canChangeSede ? 'true' : undefined}
            aria-expanded={canChangeSede ? showSedeSelector : undefined}
            onKeyDown={(e) => {
              if (canChangeSede && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setShowSedeSelector(!showSedeSelector);
              }
            }}
          >
            <MapPin size={15} className="text-gold" />
            <span>{sede.nombre}</span>
            {canChangeSede && <ChevronDown size={14} style={{ opacity: 0.6 }} />}
          </div>

          {showSedeSelector && (
            <div className="dropdown-menu sede-dropdown">
              <div className="dropdown-header">Cambiar de Sede</div>
              {availableSedes.map(s => (
                <button 
                  key={s.id} 
                  type="button"
                  className={`dropdown-item ${s.id === sede.id ? 'active' : ''}`}
                  onClick={() => {
                    setSede(s);
                    setShowSedeSelector(false);
                  }}
                >
                  <span>{s.nombre}</span>
                  {s.id === sede.id && <Check size={16} className="text-gold" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        {/* Notificaciones */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="icon-btn"
            title={sinLeer > 0 ? `${sinLeer} notificaciones sin leer` : 'Notificaciones'}
            aria-label={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {sinLeer > 0 && <span className="notification-dot" />}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown dropdown-menu">
              <div className="notifications-header">
                <h3>Notificaciones</h3>
                {sinLeer > 0 && (
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => marcarTodas.mutate()}
                    disabled={marcarTodas.isPending}
                  >
                    Marcar leídas
                  </button>
                )}
              </div>
              <div className="notifications-body">
                {notificaciones.isLoading ? (
                  <div className="skeleton" style={{ height: 72, margin: '12px' }} />
                ) : lista.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--navy-500)' }}>
                    <BellOff size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No tienes notificaciones pendientes</p>
                  </div>
                ) : (
                  lista.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      className="notification-item"
                      onClick={() => abrir(n.id, !!n.leidaEn, n.enlace)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        font: 'inherit',
                        cursor: n.enlace ? 'pointer' : 'default',
                        background: n.leidaEn ? 'transparent' : 'var(--gold-50)',
                        borderLeft: n.leidaEn ? '3px solid transparent' : '3px solid var(--gold-500)',
                      }}
                    >
                      <div className="notification-content" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                        <p style={{ fontSize: '13.5px', color: 'var(--navy-900)', fontWeight: n.leidaEn ? 600 : 800 }}>
                          {n.titulo}
                        </p>
                        {n.cuerpo && (
                          <span style={{ fontSize: '12.5px', color: 'var(--navy-600)', lineHeight: '1.4' }}>
                            {n.cuerpo}
                          </span>
                        )}
                        <small style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {formatDateTime(n.created_at)}
                        </small>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="header-divider" />
        
        {/* Perfil de Usuario */}
        <div className="profile-summary">
          <div className="profile-info">
            <span className="profile-name">{user?.nombre}</span>
            <span className="profile-role">
              {user?.rol ? ROLE_LABELS[user.rol] : 'Usuario'}
            </span>
          </div>
          <div className="profile-avatar" aria-hidden="true">
            <User size={18} />
          </div>
        </div>
      </div>
    </header>
  );
}
