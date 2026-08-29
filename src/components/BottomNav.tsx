import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { hasPermission, PERMISSIONS } from '../auth/permissions';
import {
  LayoutDashboard, GraduationCap, CalendarDays, Package, Boxes, ShoppingBasket, FileText
} from 'lucide-react';

// El orden importa: solo caben cinco en el celular, y se corta por el final.
// Primero lo que se hace a diario, después lo de consulta.
const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Inicio',     icon: LayoutDashboard, permission: PERMISSIONS.VIEW_DASHBOARD },
  { path: '/insumos',     label: 'Pedir',      icon: ShoppingBasket,  permission: PERMISSIONS.REQUEST_MATERIALS },
  { path: '/materiales',  label: 'Solicitudes', icon: Package,        permission: PERMISSIONS.REQUEST_MATERIALS },
  { path: '/inventario',  label: 'Bodega',     icon: Boxes,           permission: PERMISSIONS.VIEW_INVENTORY },
  { path: '/permisos',    label: 'Permisos',   icon: CalendarDays,    permission: PERMISSIONS.REQUEST_LEAVE },
  { path: '/estudiantes', label: 'Alumnos',    icon: GraduationCap,   permission: PERMISSIONS.VIEW_STUDENTS },
  { path: '/reportes',    label: 'Reportes',   icon: FileText,        permission: PERMISSIONS.EXPORT_REPORTS },
];

export default function BottomNav() {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item =>
    user && hasPermission(user.rol, item.permission)
  ).slice(0, 5);

  return (
    <nav className="bottom-nav" aria-label="Navegación principal móvil">
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <item.icon size={22} className="bottom-nav-icon" aria-hidden="true" />
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
