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

      <style>{`
        .bottom-nav {
          display: none;
        }

        @media (max-width: 1024px) {
          .bottom-nav {
            display: flex;
            justify-content: space-around;
            align-items: center;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 62px;
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: saturate(180%) blur(16px);
            -webkit-backdrop-filter: saturate(180%) blur(16px);
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            box-shadow: 0 -4px 18px rgba(11, 21, 40, 0.05);
            z-index: 1000;
            padding: 0 8px;
            padding-bottom: env(safe-area-inset-bottom);
          }

          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            color: #64748b;
            flex: 1;
            height: 100%;
            min-height: 44px;
            padding: 4px 0;
            gap: 2px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            -webkit-tap-highlight-color: transparent;
            background: none;
            border: none;
            cursor: pointer;
          }

          .bottom-nav-icon-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 28px;
            border-radius: 14px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .bottom-nav-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: -0.01em;
            line-height: 1.1;
            transition: color 0.2s;
          }

          .bottom-nav-item.active .bottom-nav-icon-container {
            background: var(--gold-100);
            color: var(--gold-700);
            box-shadow: 0 2px 8px rgba(212, 168, 67, 0.2);
          }

          .bottom-nav-item.active .bottom-nav-label {
            color: var(--gold-700);
            font-weight: 800;
          }

          .bottom-nav-item:active {
            transform: scale(0.94);
          }

          .bottom-nav-menu-btn:hover .bottom-nav-icon-container {
            background: var(--navy-50);
            color: var(--navy-900);
          }
        }
      `}</style>
    </nav>
  );
}
