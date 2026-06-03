import {
  NavLink
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

const tabs = [
  {
    to: '/medications',
    label: 'Medicamentos',
    end: true
  },
  {
    to: '/medications/facilities',
    label: 'Dependencias',
    adminOnly: true
  },
  {
    to: '/medications/transfers',
    label: 'Traslados'
  },
  {
    to: '/medications/deliveries',
    label: 'Entregas'
  },
  {
    to: '/medications/chronic',
    label: 'Cronicos'
  }
];

export default function MedicationModuleTabs() {
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
