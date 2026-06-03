import {
  NavLink
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

const tabs = [
  {
    to: '/vaccines',
    label: 'Vacunas',
    end: true
  },
  {
    to: '/medications/facilities',
    label: 'Dependencias',
    adminOnly: true
  },
  {
    to: '/vaccines/transfers',
    label: 'Traslados'
  },
  {
    to: '/vaccines/deliveries',
    label: 'Entregas'
  }
];

export default function VaccineModuleTabs() {
  const { user } = useAuth();

  const visibleTabs =
    tabs.filter((tab) =>
      !tab.adminOnly ||
      user?.role === 'admin'
    );

  return (
    <div className="module-tabs">
      {visibleTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            isActive
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
