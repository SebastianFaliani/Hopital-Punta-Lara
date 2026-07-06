import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { getAvailableNavigation } from '../auth/permissions';

type SidebarProps = {
  onNavigate?: () => void;
};

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
          {item.label}
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
              {item.label}
            </NavLink>
          ))}
        </>
      )}

      <Link
        to="/"
        className="app-nav-link app-nav-danger"
        onClick={onNavigate}
      >
        Salir
      </Link>

    </aside>
  );
}
