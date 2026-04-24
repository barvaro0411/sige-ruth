import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { 
  LayoutDashboard, Users, ClipboardCheck, 
  Mic2, FileBarChart, ShieldAlert, LogOut, X, GraduationCap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Panel Control' },
    { path: '/estudiantes', icon: Users, label: 'Matrícula' },
    { path: '/asistencia', icon: ClipboardCheck, label: 'Asistencia' },
    { path: '/fonoaudiologia', icon: Mic2, label: 'Fonoaudiología' },
    { path: '/reportes', icon: FileBarChart, label: 'Reportes' },
    { path: '/auditoria', icon: ShieldAlert, label: 'Auditoría' },
  ];

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <GraduationCap size={28} className="text-gold" />
            <span>SIGE Ruth</span>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Cerrar sidebar"><X size={20} /></button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => window.innerWidth < 1024 && onClose()}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.nombre?.[0]}</div>
            <div className="user-details">
              <p className="user-name">{user?.nombre}</p>
              <p className="user-role">{user?.rol}</p>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar {
          width: 280px;
          background: var(--color-navy);
          color: white;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: transform 0.3s ease;
        }

        .sidebar-header {
          padding: 32px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 0 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: #94a3b8;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .sidebar-link:hover {
          color: white;
          background: rgba(255,255,255,0.05);
        }

        .sidebar-link.active {
          color: white;
          background: var(--color-gold);
          box-shadow: 0 4px 12px rgba(180, 83, 9, 0.3);
        }

        .sidebar-footer {
          padding: 24px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: var(--color-gold);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: white;
        }

        .user-name { font-size: 14px; font-weight: 700; margin: 0; }
        .user-role { font-size: 12px; color: #94a3b8; text-transform: capitalize; margin: 0; }

        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border: none;
          border-radius: 10px;
          color: #f87171;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout:hover { background: rgba(239, 68, 68, 0.1); }

        .sidebar-close { display: none; background: none; border: none; color: white; cursor: pointer; }

        @media (max-width: 1024px) {
          .sidebar { position: fixed; transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .sidebar-close { display: block; }
          .sidebar-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 90; backdrop-filter: blur(4px);
          }
        }
      `}</style>
    </>
  );
}
