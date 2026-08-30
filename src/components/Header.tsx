import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useSede } from '../auth/SedeContext';
import { ROLE_LABELS } from '../auth/permissions';
import { NotificacionService } from '../services/notificacionService';
import { formatDateTime } from '../utils/dates';
import { Menu, MapPin, Bell, User, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

/**
 * Cabecera: sede activa, notificaciones y perfil.
 *
 * La campanita mostraba un «¡Bienvenido a SIGE!» escrito a mano y fijo,
 * mientras la base escribía notificaciones reales de materiales, permisos y
 * mantenciones que nadie llegaba a ver. Es el mismo error que el «Asistencia
 * Hoy: 0 %»: algo que se lee como un dato y en realidad no lo es.
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
    // La bandeja se refresca sola cada dos minutos: una solicitud urgente no
    // debería esperar a que la persona recargue la página.
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

  // El contexto ya entrega solo las sedes autorizadas para este perfil.
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
    <header className="header">
      <div className="header-left">
        <button className="menu-btn" onClick={onMenuToggle} aria-label="Abrir menú">
          <Menu size={24} />
        </button>
        
        <div style={{ position: 'relative' }} ref={sedeRef}>
          <div 
            className={`sede-badge ${canChangeSede ? 'clickable' : ''}`}
            onClick={() => canChangeSede && setShowSedeSelector(!showSedeSelector)}
          >
            <MapPin size={16} />
            <span>{sede.nombre}</span>
            {canChangeSede && <ChevronDown size={14} style={{ marginLeft: '4px', opacity: 0.5 }} />}
          </div>

          {showSedeSelector && (
            <div className="dropdown-menu sede-dropdown animate-in">
              <div className="dropdown-header">Cambiar de Sede</div>
              {availableSedes.map(s => (
                <button 
                  key={s.id} 
                  className={`dropdown-item ${s.id === sede.id ? 'active' : ''}`}
                  onClick={() => {
                    setSede(s);
                    setShowSedeSelector(false);
                  }}
                >
                  <span>{s.nombre}</span>
                  {s.id === sede.id && <Check size={16} />}
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
            className="icon-btn"
            title={sinLeer > 0 ? `${sinLeer} sin leer` : 'Notificaciones'}
            aria-label={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {/* El punto aparece solo si hay algo. Un indicador siempre encendido
                deja de significar nada a la semana. */}
            {sinLeer > 0 && <span className="notification-dot" />}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown dropdown-menu animate-in">
              <div className="notifications-header">
                <h3>Notificaciones</h3>
                {sinLeer > 0 && (
                  <button
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
                  <div className="skeleton" style={{ height: 64, margin: '8px' }} />
                ) : lista.length === 0 ? (
                  <p className="text-muted" style={{ padding: '20px 16px', margin: 0, fontSize: '13px' }}>
                    No tienes notificaciones.
                  </p>
                ) : (
                  lista.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      className="notification-item"
                      onClick={() => abrir(n.id, !!n.leidaEn, n.enlace)}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', font: 'inherit',
                        cursor: n.enlace ? 'pointer' : 'default',
                        background: n.leidaEn ? 'transparent' : 'var(--gold-50)',
                      }}
                    >
                      <div className="notification-content">
                        <p><strong>{n.titulo}</strong></p>
                        {n.cuerpo && <span>{n.cuerpo}</span>}
                        <small>{formatDateTime(n.created_at)}</small>
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
          <div className="profile-avatar">
            <User size={18} />
          </div>
        </div>
      </div>
    </header>
  );
}
