import { useAuth } from '../auth/useAuth';
import {
  useState
} from 'react';
import ChangePasswordModal from '../components/users/ChangePasswordModal';

export default function Topbar() {

  const { user, logout } = useAuth();

  const dependencyName =
    user?.facility_name ||
    'Administracion general';

  const [openPasswordModal, setOpenPasswordModal] =
    useState(false);

  return (

    <>

      <header className="app-topbar">

      <span className="app-topbar-title">
        {dependencyName}
      </span>

      <div className="app-topbar-actions">

        <span className="app-topbar-user">
          {user?.first_name} ({user?.role})
        </span>

        <button
          type="button"
          onClick={() =>
            setOpenPasswordModal(true)
          }
          className="btn-secondary"
        >
          Cambiar contraseña
        </button>

        <button
          onClick={logout}
          className="btn-danger"
        >
          Salir
        </button>

      </div>

      </header>

      {
        openPasswordModal && (
          <ChangePasswordModal
            onClose={() =>
              setOpenPasswordModal(false)
            }
          />
        )
      }

    </>
  );
}
