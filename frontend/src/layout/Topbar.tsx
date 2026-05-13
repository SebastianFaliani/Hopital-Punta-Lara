import { useAuth } from '../auth/useAuth';

export default function Topbar() {

  const { user, logout } = useAuth();

  return (

    <div
      style={{
        height: 60,
        background: 'white',
        borderBottom: '1px solid #dbe3ea',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px'
      }}
    >

      <span>
        Panel Hospital
      </span>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>

        <span style={{ fontSize: 14 }}>
          {user?.first_name} ({user?.role})
        </span>

        <button
          onClick={logout}
          className="btn-danger"
        >
          Salir
        </button>

      </div>

    </div>
  );
}