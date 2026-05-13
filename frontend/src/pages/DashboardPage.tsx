import { useAuth } from '../auth/useAuth';

export default function DashboardPage() {

  const {
    user,
    logout
  } = useAuth();

  return (
    <div
      style={{
        padding: 40
      }}
    >

      <h1>
        Dashboard
      </h1>

      <p>
        Usuario:
        {' '}
        {user?.email}
      </p>

      <p>
        Rol:
        {' '}
        {user?.role}
      </p>

      <button onClick={logout}>
        Logout
      </button>

    </div>
  );
}