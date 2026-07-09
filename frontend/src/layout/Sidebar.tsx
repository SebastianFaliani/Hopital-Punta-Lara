import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { getAvailableNavigation } from '../auth/permissions';

type SidebarProps = {
  onNavigate?: () => void;
};

const navigationIconByPath: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/users': 'usuario',
  '/facilities': 'dependencias',
  '/personnel': 'personal',
  '/personnel/settings': 'configuracion-personal',
  '/vaccines': 'vacunas',
  '/medications': 'medicamentos',
  '/transfers': 'traslados',
  '/laboratory': 'laboratorio',
  '/nutrition': 'nutricion',
  '/housekeeping': 'mayordomia',
  '/whatsapp': 'whatsapp',
  '/audit': 'auditoria'
};

function getNavigationIcon(
  path: string
) {
  const iconName =
    navigationIconByPath[path];

  return iconName
    ? `/menu-icons/${iconName}.png`
    : undefined;
}

function NavIcon({
  path
}: {
  path: string;
}) {
  const icon =
    getNavigationIcon(path);

  if (!icon) {
    return null;
  }

  return (
    <img
      src={icon}
      alt=""
      className="app-nav-icon"
      aria-hidden="true"
    />
  );
}

export default function Sidebar({
  onNavigate
}: SidebarProps) {

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

  const navigationItems =
    getAvailableNavigation(user);

  const mainNavigationItems =
    navigationItems.filter((item) =>
      !item.section
    );

  const administrationItems =
    navigationItems.filter((item) =>
      item.section === 'Administracion'
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

      {mainNavigationItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className="app-nav-link"
          onClick={onNavigate}
        >
          <NavIcon path={item.path} />
          <span>
            {item.label}
          </span>
        </NavLink>
      ))}

      {administrationItems.length > 0 && (
        <>
          <div className="app-nav-section-title">
            Administracion
          </div>

          {administrationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="app-nav-link"
              onClick={onNavigate}
            >
              <NavIcon path={item.path} />
              <span>
                {item.label}
              </span>
            </NavLink>
          ))}
        </>
      )}

    </aside>
  );
}
