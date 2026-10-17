import { useToast } from './toast-context';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  RotateCcw,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { deriveAlerts } from '../domain/selectors';
import { getRecoveryNotice, useDatabase } from '../store/useDatabase';
import { Confirm } from './ui';

const links = [
  { path: '/dashboard', label: 'Centro de control', icon: LayoutDashboard, number: '01' },
  { path: '/activos', label: 'Activos eléctricos', icon: Boxes, number: '02' },
  { path: '/hallazgos', label: 'Hallazgos', icon: Activity, number: '03' },
  { path: '/epp', label: 'Inventario EPP', icon: ShieldCheck, number: '04' },
  { path: '/estudios-documentos', label: 'Estudios y documentos', icon: FileText, number: '05' },
  { path: '/alertas', label: 'Alertas', icon: Bell, number: '06' },
];
export function Layout() {
  const location = useLocation();
  const db = useDatabase((s) => s.db);
  const reset = useDatabase((s) => s.reset);
  const count = deriveAlerts(db).length;
  const [mobile, setMobile] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const title = links.find((l) => location.pathname.startsWith(l.path))?.label ?? 'SIGEE';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? 'sidebar-open' : ''}`}
        aria-label="Navegación principal"
      >
        <NavLink to="/dashboard" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          <span>
            SIGEE<span className="brand-caption">Seguridad eléctrica</span>
          </span>
        </NavLink>
        <button
          className="mobile-close icon-button"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">D</span>
          <div>
            Espacio de demostración<small>Entorno local</small>
          </div>
          <span className="online-dot" />
        </div>
        <p className="nav-label">GESTIÓN INTEGRADA</p>
        <nav>
          {links.map(({ path, label, icon: Icon, number }) => (
            <NavLink
              to={path}
              key={path}
              onClick={() => setMobile(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {path === '/alertas' ? (
                <span className="nav-count">{count}</span>
              ) : (
                <small>{number}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="tiny-label">UNA VISTA CONECTADA</span>
            <p>Información que se convierte en seguimiento.</p>
            <span>
              Prototipo independiente <ArrowUpRight size={13} />
            </span>
          </div>
          <button className="reset-button" onClick={() => setConfirm(true)}>
            <RotateCcw size={16} />
            Restaurar datos de demostración
          </button>
          <div className="version">
            <span>SIGEE</span>
            <span>Versión 0.1 · Demo</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Espacio de trabajo</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span className="online-dot" />
              Prototipo demostrativo · Datos simulados
            </span>
            <NavLink
              to="/alertas"
              className="notification-button"
              aria-label={`Ver ${count} alertas`}
            >
              <Bell size={18} />
              <span />
            </NavLink>
            <span className="user-avatar" aria-label="Sesión local de demostración">
              D
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {getRecoveryNotice() && (
            <div className="recovery-notice" role="status">
              {getRecoveryNotice()}
            </div>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            Prototipo demostrativo con datos simulados. No apto para decisiones operativas de
            seguridad eléctrica.
          </span>
          <span>Almacenamiento local</span>
        </footer>
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Restaurar datos de demostración"
        description="Se eliminarán los cambios locales y se recuperará el conjunto ficticio original, incluidos sus hallazgos, comentarios y asignaciones."
        label="Restaurar datos"
        danger
        onConfirm={() => {
          reset();
          toast('Datos de demostración restaurados.');
        }}
      />
    </div>
  );
}
