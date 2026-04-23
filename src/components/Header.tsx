import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSede } from '../config/SedeContext';
import { ROLE_LABELS } from '../auth/permissions';
import { Menu, MapPin, Bell, User, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

/**
 * Header Component - Refactored
 * Handles sede selection, notifications and user profile summary.
 */
export default function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuth();
  const { sede, setSede, availableSedes } = useSede();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSedeSelector, setShowSedeSelector] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const sedeRef = useRef<HTMLDivElement>(null);

  const isGlobalUser = !user?.sedeId;

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
            className={`sede-badge ${isGlobalUser ? 'clickable' : ''}`}
            onClick={() => isGlobalUser && setShowSedeSelector(!showSedeSelector)}
          >
            <MapPin size={16} />
            <span>{sede.nombre}</span>
            {isGlobalUser && <ChevronDown size={14} style={{ marginLeft: '4px', opacity: 0.5 }} />}
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
          <button className="icon-btn" title="Notificaciones" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={20} />
            <span className="notification-dot" />
          </button>
          
          {showNotifications && (
            <div className="notifications-dropdown dropdown-menu animate-in">
              <div className="notifications-header">
                <h3>Notificaciones</h3>
                <button className="text-btn" onClick={() => setShowNotifications(false)}>Marcar leídas</button>
              </div>
              <div className="notifications-body">
                <div className="notification-item">
                  <div className="notification-icon">👋</div>
                  <div className="notification-content">
                    <p><strong>¡Bienvenido a SIGE!</strong></p>
                    <span>Revisa las últimas actualizaciones del sistema.</span>
                    <small>Hace 1 hora</small>
                  </div>
                </div>
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
