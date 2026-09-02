import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS, ROLE_LABELS, Permiso } from '../auth/permissions';
import {
  LayoutDashboard, Users,
  Mic2, FileBarChart, ShieldAlert, LogOut, X, GraduationCap, UserCog, CalendarDays,
  Package, Boxes, ShoppingBasket, Wrench, ArrowLeftRight, Activity, LucideIcon
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  path: string;
  icon: LucideIcon;
  label: string;
  permission: Permiso;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, can } = useAuth();

  const menuSections: MenuSection[] = [
    {
      title: 'Principal',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Panel Control', permission: PERMISSIONS.VIEW_DASHBOARD },
        { path: '/operaciones', icon: Activity, label: 'Operaciones', permission: PERMISSIONS.VIEW_OPERATIONS },
      ]
    },
    {
      title: 'Académico',
      items: [
        { path: '/estudiantes', icon: Users, label: 'Matrícula', permission: PERMISSIONS.VIEW_STUDENTS },
        { path: '/fonoaudiologia', icon: Mic2, label: 'Fonoaudiología', permission: PERMISSIONS.VIEW_SESSIONS },
      ]
    },
    {
      title: 'Personal y Solicitudes',
      items: [
        { path: '/permisos', icon: CalendarDays, label: 'Permisos y Días', permission: PERMISSIONS.REQUEST_LEAVE },
        { path: '/insumos', icon: ShoppingBasket, label: 'Pedir Insumos', permission: PERMISSIONS.REQUEST_MATERIALS },
        { path: '/materiales', icon: Package, label: 'Mis Solicitudes', permission: PERMISSIONS.REQUEST_MATERIALS },
      ]
    },
    {
      title: 'Recursos e Infraestructura',
      items: [
        { path: '/inventario', icon: Boxes, label: 'Bodega y Stock', permission: PERMISSIONS.VIEW_INVENTORY },
        { path: '/mantenciones', icon: Wrench, label: 'Mantenciones', permission: PERMISSIONS.REPORT_MAINTENANCE },
        { path: '/prestamos', icon: ArrowLeftRight, label: 'Préstamos', permission: PERMISSIONS.VIEW_LOANS },
      ]
    },
    {
      title: 'Administración',
      items: [
        { path: '/reportes', icon: FileBarChart, label: 'Centro de Reportes', permission: PERMISSIONS.EXPORT_REPORTS },
        { path: '/auditoria', icon: ShieldAlert, label: 'Auditoría', permission: PERMISSIONS.VIEW_AUDIT },
        { path: '/usuarios', icon: UserCog, label: 'Usuarios y Cuentas', permission: PERMISSIONS.MANAGE_USERS },
      ]
    }
  ];

  // Filtrar secciones y dejar solo las que contengan al menos un elemento autorizado
  const filteredSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => can(item.permission))
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* Overlay móvil con backdrop-blur sobre todo el viewport */}
      {isOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={onClose}
          aria-hidden="true" 
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navegación lateral">
        {/* Cabecera con Logo Institucional */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <GraduationCap size={24} />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Gestión Ruth</span>
              <span className="sidebar-brand-tag">Escuela de Lenguaje</span>
            </div>
          </div>
          <button 
            type="button" 
            className="sidebar-close" 
            onClick={onClose} 
            aria-label="Cerrar menú lateral"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de Navegación Categorizada */}
        <nav className="sidebar-nav" aria-label="Menú principal">
          {filteredSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              <span className="sidebar-section-title">{section.title}</span>
              <div className="sidebar-section-items">
                {section.items.map((item) => (
                  <NavLink 
                    key={item.path} 
                    to={item.path} 
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                  >
                    <item.icon size={18} className="sidebar-icon" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Tarjeta de Usuario y Botón de Salir */}
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" aria-hidden="true">
              {user?.nombre?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <p className="user-name">{user?.nombre}</p>
              <span className="user-role-badge">
                {user?.rol ? ROLE_LABELS[user.rol] : 'Usuario'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-logout" 
            onClick={() => void logout()}
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar {
          width: 280px;
          background: linear-gradient(180deg, var(--navy-950) 0%, #070e1b 100%);
          color: white;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
        }

        .sidebar-header {
          padding: 22px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sidebar-logo-icon {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, var(--gold-600) 0%, var(--gold-500) 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 14px rgba(184, 134, 11, 0.35);
          flex-shrink: 0;
        }

        .sidebar-brand-text {
          display: flex;
          flex-direction: column;
        }

        .sidebar-brand-name {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: white;
          line-height: 1.2;
        }

        .sidebar-brand-tag {
          font-size: 11px;
          color: var(--gold-400);
          font-weight: 600;
        }

        .sidebar-close {
          display: none;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: white;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .sidebar-close:hover {
          background: rgba(255, 255, 255, 0.16);
          transform: scale(1.05);
        }

        .sidebar-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px 14px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }

        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-section-title {
          font-size: 10px;
          font-weight: 800;
          color: var(--gold-400);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0 12px 6px;
          opacity: 0.9;
        }

        .sidebar-section-items {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          color: #cbd5e1;
          text-decoration: none;
          font-weight: 600;
          font-size: 13.5px;
          border-radius: 10px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          min-height: 42px;
        }

        .sidebar-link:hover {
          color: white;
          background: rgba(255, 255, 255, 0.07);
          transform: translateX(3px);
        }

        .sidebar-link.active {
          color: white;
          background: linear-gradient(135deg, var(--gold-600) 0%, var(--gold-500) 100%);
          box-shadow: 0 4px 14px rgba(184, 134, 11, 0.35);
          font-weight: 700;
        }

        .sidebar-icon {
          flex-shrink: 0;
          opacity: 0.9;
        }

        .sidebar-footer {
          padding: 16px 18px;
          padding-bottom: max(18px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.28);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--gold-600), var(--gold-500));
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .user-details {
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-name {
          font-size: 13.5px;
          font-weight: 700;
          margin: 0;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .user-role-badge {
          font-size: 11px;
          color: var(--gold-300);
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 9px;
          color: #fca5a5;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 38px;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.22);
          color: #fee2e2;
          border-color: rgba(239, 68, 68, 0.45);
        }

        @media (max-width: 1024px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);
            z-index: 1200;
            width: min(85vw, 300px);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-close {
            display: flex;
          }
          .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(7, 13, 24, 0.7);
            z-index: 1150;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
        }
      `}</style>
    </>
  );
}
