import { useNavigate } from 'react-router-dom';

import TransfersHeader from '../components/transfers/TransfersHeader';

const transferSections = [
  {
    title: 'Ambulancias',
    detail: 'Gestiona unidades, patentes, estado y disponibilidad.',
    path: '/transfers/ambulances'
  },
  {
    title: 'Choferes',
    detail: 'Administra los choferes activos y sus datos principales.',
    path: '/transfers/drivers'
  },
  {
    title: 'Guardias',
    detail: 'Carga y revisa las guardias de choferes y ambulancias.',
    path: '/transfers/shifts'
  }
];

export default function TransfersPage() {
  const navigate =
    useNavigate();

  return (
    <div>
      <TransfersHeader
        title="Traslados"
        description="Modulo en reorganizacion. Por ahora trabajamos con ambulancias, choferes y guardias."
      />

      <div className="dashboard-grid">
        {transferSections.map((section) => (
          <button
            className="dashboard-card"
            key={section.path}
            type="button"
            onClick={() =>
              navigate(section.path)
            }
          >
            <h2>{section.title}</h2>
            <p>{section.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
