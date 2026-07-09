import { useAuth } from '../auth/useAuth';
import {
  useState
} from 'react';
import ChangePasswordModal from '../components/users/ChangePasswordModal';

type TopbarProps = {
  menuOpen?: boolean;
  onToggleMenu?: () => void;
};

export default function Topbar({
  menuOpen = false,
  onToggleMenu
}: TopbarProps) {

  const { user, logout } = useAuth();

  const dependencyName =
    user?.facility_name ||
    '';

  const [openPasswordModal, setOpenPasswordModal] =
    useState(false);

  return (

    <>

      <header className="app-topbar">

      <button
        type="button"
        className={
          menuOpen
            ? 'app-menu-button app-menu-button-open'
            : 'app-menu-button'
        }
        onClick={onToggleMenu}
        aria-label={
          menuOpen
            ? 'Cerrar menu'
            : 'Abrir menu'
        }
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <span className="app-topbar-title">
        <img
          src="/menu-icons/sigsa-topbar.png"
          alt="SIGSA"
          className="app-topbar-logo"
        />
        <span className="app-topbar-heading">
          {dependencyName}
        </span>
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
          type="button"
          onClick={logout}
          className="app-topbar-logout-button"
          aria-label="Salir"
          title="Salir"
        >
          <img
            src="/menu-icons/salir.png"
            alt=""
            aria-hidden="true"
          />
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
