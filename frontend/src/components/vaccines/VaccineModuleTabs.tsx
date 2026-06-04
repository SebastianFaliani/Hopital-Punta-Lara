import {
  NavLink
} from 'react-router-dom';

const tabs = [
  {
    to: '/vaccines',
    label: 'Vacunas',
    end: true
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
