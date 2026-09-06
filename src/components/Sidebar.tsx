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

  /**
   * Los títulos de sección aparecen cuando hay algo que ordenar.
   *
   * El andamiaje de cinco encabezados se mantenía aunque el menú quedara en
   * tres ítems: para aseo, «Principal / Académico / Personal y Solicitudes»
   * sobre una lista de tres enlaces es más estructura que contenido. Sobre seis
   * ítems la agrupación ayuda a encontrar; por debajo, estorba.
   */
  const totalItems = filteredSections.reduce((suma, s) => suma + s.items.length, 0);
  const mostrarSecciones = totalItems > 6;

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
              {mostrarSecciones && (
                <span className="sidebar-section-title">{section.title}</span>
              )}
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

    </>
  );
}
