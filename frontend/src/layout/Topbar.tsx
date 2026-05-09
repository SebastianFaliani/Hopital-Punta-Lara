import { useAuth } from '../auth/useAuth';

export default function Topbar() {

  const { user, logout } = useAuth();

  return (

    <header className="app-topbar">

      <span className="app-topbar-title">
        Panel Hospital
      </span>

      <div className="app-topbar-actions">

        <span className="app-topbar-user">
          {user?.first_name} ({user?.role})
        </span>

        <button
          onClick={logout}
          className="btn-danger"
        >
          Salir
        </button>

      </div>

    </header>
  );
}
