import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Sidebar() {

  const { user } = useAuth();

  return (

    <div
      style={{
        width: 250,
        background: '#1f2937',
        color: 'white',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >

      <h2 style={{ color: '#3c9ec2' }}>
        Hospital
      </h2>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        {user?.email}
      </p>

      <hr style={{ opacity: 0.2 }} />

      <Link to="/dashboard" style={{ color: 'white' }}>
        Dashboard
      </Link>

      {user?.role === 'admin' && (
        <Link to="/users" style={{ color: 'white' }}>
          Usuarios
        </Link>
      )}
      
      {(user?.role === 'admin' || user?.role === 'farmacia') && (
      <Link to="/medications" style={{ color: 'white' }}>
        Medicamentos
      </Link>

        )}

      {(user?.role === 'admin' || user?.role === 'user') && (
        <Link to="/transfers" style={{ color: 'white' }}>
          Traslados
        </Link>
      )}

      <Link to="/" style={{ color: '#8a1616' }}>
        Cerrar Session
      </Link>

    </div>
  );
}
