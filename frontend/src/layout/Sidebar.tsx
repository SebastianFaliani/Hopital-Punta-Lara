import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Sidebar() {

  const { user } = useAuth();

  return (

    <aside className="app-sidebar">

      <h2 className="app-sidebar-title">
        Hospital
      </h2>

      <p className="app-sidebar-user">
        {user?.username || user?.email}
      </p>

      <hr className="app-sidebar-divider" />

      <NavLink to="/dashboard" className="app-nav-link">
        Dashboard
      </NavLink>

      {user?.role === 'admin' && (
        <NavLink to="/users" className="app-nav-link">
          Usuarios
        </NavLink>
      )}

      {(user?.role === 'admin' || user?.role === 'user') && (
        <NavLink to="/personnel" className="app-nav-link">
          Personal
        </NavLink>
      )}
      
      {(user?.role === 'admin' || user?.role === 'farmacia') && (
      <NavLink to="/medications" className="app-nav-link">
        Medicamentos
      </NavLink>

        )}

      {(user?.role === 'admin' || user?.role === 'user') && (
        <NavLink to="/transfers" className="app-nav-link">
          Traslados
        </NavLink>
      )}

      {(user?.role === 'admin' || user?.role === 'user') && (
        <NavLink to="/whatsapp" className="app-nav-link">
          WhatsApp
        </NavLink>
      )}

      <Link to="/" className="app-nav-link app-nav-danger">
        Salir
      </Link>

    </aside>
  );
}
