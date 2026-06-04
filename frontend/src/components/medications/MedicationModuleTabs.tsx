import {
  NavLink
} from 'react-router-dom';

const tabs = [
  {
    to: '/medications',
    label: 'Medicamentos',
    end: true
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
  return (
    <div className="module-tabs">
      {tabs.map((tab) => (
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
