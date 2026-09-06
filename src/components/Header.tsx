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

  // Sin `refetchInterval`: `useRealtimeSync` ya invalida esta consulta cuando
  // la base inserta una notificación para esta persona. Sondear cada dos
  // minutos además del canal en vivo era hacer el mismo trabajo dos veces, con
  // datos móviles y batería de por medio.
  const notificaciones = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => NotificacionService.getRecientes(),
    enabled: !!user,
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
    function alTocarFuera(event: MouseEvent) {
      const objetivo = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(objetivo)) {
        setShowNotifications(false);
      }
      if (sedeRef.current && !sedeRef.current.contains(objetivo)) {
        setShowSedeSelector(false);
      }
    }

    // Escape cierra lo que esté abierto y devuelve el foco al botón: antes solo
    // se cerraban con clic afuera, así que con teclado no había forma de salir.
    function alPresionar(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (showNotifications) {
        setShowNotifications(false);
        notifRef.current?.querySelector('button')?.focus();
      }
      if (showSedeSelector) {
        setShowSedeSelector(false);
        sedeRef.current?.querySelector('button')?.focus();
      }
    }

    document.addEventListener('mousedown', alTocarFuera);
    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('mousedown', alTocarFuera);
      document.removeEventListener('keydown', alPresionar);
    };
  }, [showNotifications, showSedeSelector]);

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
        
        <div className="relative" ref={sedeRef}>
          {/*
            Un <button> de verdad, no un <div role="button"> con tabIndex y
            manejo manual de Enter y Espacio. El elemento nativo trae el foco,
            el anuncio y el teclado resueltos, y no hay forma de que se
            desincronicen.
          */}
          {canChangeSede ? (
            <button
              type="button"
              className="sede-badge clickable"
              onClick={() => setShowSedeSelector(!showSedeSelector)}
              aria-haspopup="menu"
              aria-expanded={showSedeSelector}
            >
              <MapPin size={15} className="text-gold" aria-hidden="true" />
              <span>{sede.nombre}</span>
              <ChevronDown size={14} className="sede-badge-chevron" aria-hidden="true" />
            </button>
          ) : (
            <span className="sede-badge">
              <MapPin size={15} className="text-gold" aria-hidden="true" />
              <span>{sede.nombre}</span>
            </span>
          )}

          {showSedeSelector && (
            <div className="dropdown-menu sede-dropdown" role="menu">
              <div className="dropdown-header">Cambiar de Sede</div>
              {availableSedes.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s.id === sede.id}
                  className={`dropdown-item ${s.id === sede.id ? 'active' : ''}`}
                  onClick={() => {
                    setSede(s);
                    setShowSedeSelector(false);
                  }}
                >
                  <span>{s.nombre}</span>
                  {s.id === sede.id && <Check size={16} className="text-gold" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        {/* Notificaciones */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="icon-btn"
            title={sinLeer > 0 ? `${sinLeer} notificaciones sin leer` : 'Notificaciones'}
            aria-label={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
            aria-haspopup="true"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} aria-hidden="true" />
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
                  <div className="skeleton notificaciones-esqueleto" />
                ) : lista.length === 0 ? (
                  <div className="notificaciones-vacio">
                    <BellOff size={28} aria-hidden="true" />
                    <p>No tienes notificaciones pendientes</p>
                  </div>
                ) : (
                  lista.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      className={`notification-item ${n.leidaEn ? '' : 'sin-leer'}`}
                      onClick={() => abrir(n.id, !!n.leidaEn, n.enlace)}
                    >
                      <span className="notification-content">
                        <span className="notification-title">{n.titulo}</span>
                        {n.cuerpo && <span className="notification-body">{n.cuerpo}</span>}
                        <span className="notification-time">{formatDateTime(n.created_at)}</span>
                      </span>
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
