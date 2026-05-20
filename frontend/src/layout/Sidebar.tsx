import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';

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
    hasPermission(
      user,
      'personnel.view',
      ['admin', 'user', 'dir']
    ) &&
    canUseHospitalModules;

  const canSeeTransfers =
    hasPermission(
      user,
      'transfers.view',
      ['admin', 'user', 'dir']
    ) &&
    canUseHospitalModules;

  const canSeeLaboratory =
    hasPermission(
      user,
      'laboratory.view',
      ['admin', 'lab', 'user', 'dir']
    ) &&
    canUseHospitalModules;

  const canSeeNutrition =
    hasPermission(
      user,
      'nutrition.view',
      ['admin', 'user', 'dir', 'nutri']
    ) &&
    canUseHospitalModules;

  const canSeeVaccines =
    hasPermission(
      user,
      'vaccines.view',
      ['admin', 'vacu', 'dir']
    );

  const canSeeMedications =
    hasPermission(
      user,
      'medications.view',
      ['admin', 'farmacia', 'dir']
    );

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
        <NavLink to="/facilities" className="app-nav-link">
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

      {canSeeNutrition && (
        <NavLink to="/nutrition" className="app-nav-link">
          Nutricion
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/whatsapp" className="app-nav-link">
          WhatsApp
        </NavLink>
      )}

      {hasPermission(
        user,
        'audit.view',
        ['admin', 'dir']
      ) && (
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
