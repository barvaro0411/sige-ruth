import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { hasPermission, PERMISSIONS } from '../auth/permissions';
import {
  LayoutDashboard, ShoppingBasket, Package, Wrench, Menu, Boxes
} from 'lucide-react';

interface BottomNavProps {
  onMenuToggle?: () => void;
}

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Inicio',      icon: LayoutDashboard, permission: PERMISSIONS.VIEW_DASHBOARD },
  { path: '/insumos',     label: 'Pedir',       icon: ShoppingBasket,  permission: PERMISSIONS.REQUEST_MATERIALS },
  { path: '/materiales',  label: 'Pedidos',     icon: Package,         permission: PERMISSIONS.REQUEST_MATERIALS },
  { path: '/mantenciones', label: 'Arreglos',   icon: Wrench,          permission: PERMISSIONS.REPORT_MAINTENANCE },
  { path: '/inventario',  label: 'Bodega',      icon: Boxes,           permission: PERMISSIONS.VIEW_INVENTORY },
];

export default function BottomNav({ onMenuToggle }: BottomNavProps) {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item =>
    user && hasPermission(user.rol, item.permission)
  ).slice(0, 4);

  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="bottom-nav-icon-container">
            <item.icon size={20} className="bottom-nav-icon" aria-hidden="true" />
          </div>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}

      {/* Botón de Menú Rápido para acceder a todos los módulos con una mano */}
      {onMenuToggle && (
        <button
          type="button"
          className="bottom-nav-item bottom-nav-menu-btn"
          onClick={onMenuToggle}
          aria-label="Abrir menú completo de opciones"
        >
          <div className="bottom-nav-icon-container">
            <Menu size={20} className="bottom-nav-icon" aria-hidden="true" />
          </div>
          <span className="bottom-nav-label">Más</span>
        </button>
      )}

    </nav>
  );
}
