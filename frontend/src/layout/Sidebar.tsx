import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Sidebar() {

  const { user } = useAuth();

  const displayUsername =
    [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    user?.email ||
    '-';

  const displayRole =
    user?.role_description ||
    user?.role ||
    '-';

  const isAdmin =
    user?.role === 'admin';

  const isDirector =
    user?.role === 'dir';

  const isSecretary =
    user?.facility_type === 'secretaria' ||
    !user?.facility_id;

  const isHospital =
    user?.facility_type === 'hospital' ||
    !user?.facility_id;

  const canUseHospitalModules =
    isAdmin ||
    isSecretary ||
    isHospital;

  const canSeePersonnel =
    isAdmin ||
    (
      user?.role === 'user' &&
      canUseHospitalModules
    ) ||
    (
      isDirector &&
      canUseHospitalModules
    );

  const canSeeTransfers =
    canSeePersonnel;

  const canSeeLaboratory =
    isAdmin ||
    (
      user?.role === 'lab' &&
      canUseHospitalModules
    ) ||
    (
      user?.role === 'user' &&
      canUseHospitalModules
    ) ||
    (
      isDirector &&
      canUseHospitalModules
    );

  const canSeeVaccines =
    isAdmin ||
    user?.role === 'vacu' ||
    isDirector;

  const canSeeMedications =
    isAdmin ||
    user?.role === 'farmacia' ||
    isDirector;

  return (

    <aside className="app-sidebar">

      <div className="app-sidebar-brand">
        <div className="app-sidebar-identity">
          <strong>
            User: {displayUsername}
          </strong>
          <span>
            {displayRole}
          </span>
        </div>
      </div>

      <hr className="app-sidebar-divider" />

      <NavLink to="/dashboard" className="app-nav-link">
        Dashboard
      </NavLink>

      {isAdmin && (
        <NavLink to="/users" className="app-nav-link">
          Usuarios
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/medications/facilities" className="app-nav-link">
          Dependencias
        </NavLink>
      )}

      {canSeePersonnel && (
        <NavLink to="/personnel" className="app-nav-link">
          Personal
        </NavLink>
      )}

      {canSeeVaccines && (
        <NavLink to="/vaccines" className="app-nav-link">
          Vacunas
        </NavLink>
      )}
      
      {canSeeMedications && (
        <NavLink to="/medications" className="app-nav-link">
          Medicamentos
        </NavLink>
      )}

      {canSeeTransfers && (
        <NavLink to="/transfers" className="app-nav-link">
          Traslados
        </NavLink>
      )}

      {canSeeLaboratory && (
        <NavLink to="/laboratory" className="app-nav-link">
          Laboratorio
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/whatsapp" className="app-nav-link">
          WhatsApp
        </NavLink>
      )}

      {(isAdmin || isDirector) && (
        <NavLink to="/audit" className="app-nav-link">
          Auditoria
        </NavLink>
      )}

      <Link to="/" className="app-nav-link app-nav-danger">
        Salir
      </Link>

    </aside>
  );
}
