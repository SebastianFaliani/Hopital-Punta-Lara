import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';

import { useAuth }
  from '../auth/useAuth';
import {
  formatDisplayDate,
  formatDisplayDateTime
} from '../utils/dateFormat';

type DashboardStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  pharmacy: {
    medications: number;
    activeMedications: number;
    batches: number;
    lowStock: number;
    expiringBatches: number;
    expiredBatches: number;
  };
  transfers: {
    total: number;
    pending: number;
    today: number;
    activeAmbulances: number;
    activeDrivers: number;
    activeShifts: number;
  };
  vaccines: {
    total: number;
    active: number;
    batches: number;
    lowStock: number;
    expiringBatches: number;
    expiredBatches: number;
  };
  personnel: {
    activeEmployees: number;
    absentToday: number;
    pendingLeaveRequests: number;
  };
  upcomingTransfers: Array<{
    id: number;
    patient_name: string;
    destination_type: string;
    destination_address: string;
    trip_type: string;
    scheduled_datetime: string | null;
    status: string;
    ambulance_code: string | null;
    driver_name: string | null;
  }>;
  criticalMedications: Array<{
    id: number;
    name: string;
    minimum_stock: number;
    total_stock: number;
  }>;
  criticalVaccines: Array<{
    id: number;
    name: string;
    minimum_stock: number;
    total_stock: number;
  }>;
  expiringMedicationBatches: Array<{
    name: string;
    batch_number: string;
    expiration_date: string;
    current_stock: number;
  }>;
  expiringVaccineBatches: Array<{
    name: string;
    batch_number: string;
    expiration_date: string;
    current_stock: number;
  }>;
};

function formatDateTime(
  value: string | null
) {

  if (!value) {
    return 'Sin horario';
  }

  return formatDisplayDateTime(value, 'Sin horario');
}

function formatDate(
  value: string
) {
  return formatDisplayDate(value);
}

export default function DashboardPage() {

  const { user } = useAuth();

  const [stats, setStats] =
    useState<DashboardStats | null>(null);

  const [error, setError] =
    useState('');

  async function loadDashboard() {

    try {

      const res =
        await apiFetch('/dashboard');

      setStats(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  useEffect(() => {

    loadDashboard();

  }, []);

  if (!stats) {

    return (
      <div>
        <h1 className="page-title">
          Bienvenido, {user?.first_name}
        </h1>
        <p className="page-subtitle">
          {error || 'Cargando indicadores...'}
        </p>
      </div>
    );
  }

  return (

    <div>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            Bienvenido, {user?.first_name}
          </h1>
          <p className="page-subtitle">
            Panel operativo del sistema hospitalario
          </p>
        </div>
      </div>

      <div className="dashboard-grid">

        <Card
          title="Usuarios activos"
          value={stats.users.active}
          detail={`${stats.users.total} usuarios totales`}
          color="#3c9ec2"
        />

        <Card
          title="Medicamentos activos"
          value={stats.pharmacy.activeMedications}
          detail={`${stats.pharmacy.lowStock} con stock bajo`}
          color="#1f6e29"
        />

        <Card
          title="Lotes"
          value={stats.pharmacy.batches}
          detail={`${stats.pharmacy.expiringBatches} vencen en 30 dias`}
          color="#8a1616"
        />

        <Card
          title="Traslados hoy"
          value={stats.transfers.today}
          detail={`${stats.transfers.pending} pendientes o en curso`}
          color="#7c3aed"
        />

        <Card
          title="Vacunas activas"
          value={stats.vaccines.active}
          detail={`${stats.vaccines.lowStock} con stock bajo`}
          color="#0891b2"
        />

        <Card
          title="Personal activo"
          value={stats.personnel.activeEmployees}
          detail={`${stats.personnel.absentToday} ausentes hoy`}
          color="#4d7c0f"
        />

        <Card
          title="Ambulancias activas"
          value={stats.transfers.activeAmbulances}
          detail={`${stats.transfers.activeDrivers} choferes activos`}
          color="#0f766e"
        />

        <Card
          title="Guardias activas"
          value={stats.transfers.activeShifts}
          detail={`${stats.transfers.total} traslados historicos`}
          color="#b45309"
        />

        <Card
          title="Licencias pendientes"
          value={stats.personnel.pendingLeaveRequests}
          detail="Solicitudes para revisar"
          color="#be123c"
        />

      </div>

      <div className="dashboard-sections">

        <section className="dashboard-panel">
          <h2>Proximos traslados</h2>

          <div className="dashboard-list">
            {stats.upcomingTransfers.map((trip) => (
              <div
                className="dashboard-list-item"
                key={`${trip.id}-${trip.trip_type}`}
              >
                <strong>
                  {trip.patient_name} - {trip.trip_type}
                </strong>
                <span>
                  {formatDateTime(
                    trip.scheduled_datetime
                  )}
                </span>
                <span>
                  {trip.destination_type}: {trip.destination_address}
                </span>
                <span>
                  {trip.ambulance_code || 'Sin ambulancia'}
                  {' / '}
                  {trip.driver_name || 'Sin chofer'}
                </span>
              </div>
            ))}

            {
              stats.upcomingTransfers.length === 0 && (
                <p className="page-subtitle">
                  No hay traslados pendientes.
                </p>
              )
            }
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Medicamentos criticos</h2>

          <div className="dashboard-list">
            {stats.criticalMedications.map((medication) => (
              <div
                className="dashboard-list-item"
                key={medication.id}
              >
                <strong>
                  {medication.name}
                </strong>
                <span>
                  Stock actual: {Number(medication.total_stock)}
                </span>
                <span>
                  Stock minimo: {Number(medication.minimum_stock)}
                </span>
              </div>
            ))}

            {
              stats.criticalMedications.length === 0 && (
                <p className="page-subtitle">
                  No hay medicamentos con stock bajo.
                </p>
              )
            }
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Vacunas criticas</h2>

          <div className="dashboard-list">
            {stats.criticalVaccines.map((vaccine) => (
              <div
                className="dashboard-list-item"
                key={vaccine.id}
              >
                <strong>
                  {vaccine.name}
                </strong>
                <span>
                  Stock actual: {Number(vaccine.total_stock)}
                </span>
                <span>
                  Stock minimo: {Number(vaccine.minimum_stock)}
                </span>
              </div>
            ))}

            {
              stats.criticalVaccines.length === 0 && (
                <p className="page-subtitle">
                  No hay vacunas con stock bajo.
                </p>
              )
            }
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Medicamentos por vencer</h2>

          <div className="dashboard-list">
            {stats.expiringMedicationBatches.map((batch) => (
              <div
                className="dashboard-list-item"
                key={`${batch.name}-${batch.batch_number}`}
              >
                <strong>
                  {batch.name} - lote {batch.batch_number}
                </strong>
                <span>
                  Vence: {formatDate(batch.expiration_date)}
                </span>
                <span>
                  Stock: {Number(batch.current_stock)}
                </span>
              </div>
            ))}

            {
              stats.expiringMedicationBatches.length === 0 && (
                <p className="page-subtitle">
                  No hay medicamentos por vencer en 30 dias.
                </p>
              )
            }
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Vacunas por vencer</h2>

          <div className="dashboard-list">
            {stats.expiringVaccineBatches.map((batch) => (
              <div
                className="dashboard-list-item"
                key={`${batch.name}-${batch.batch_number}`}
              >
                <strong>
                  {batch.name} - lote {batch.batch_number}
                </strong>
                <span>
                  Vence: {formatDate(batch.expiration_date)}
                </span>
                <span>
                  Stock: {Number(batch.current_stock)}
                </span>
              </div>
            ))}

            {
              stats.expiringVaccineBatches.length === 0 && (
                <p className="page-subtitle">
                  No hay vacunas por vencer en 30 dias.
                </p>
              )
            }
          </div>
        </section>

      </div>

    </div>
  );
}

function Card({
  title,
  value,
  detail,
  color
}: {
  title: string;
  value: number;
  detail: string;
  color: string;
}) {

  return (

    <div
      className="dashboard-card"
      style={{
        borderLeftColor: color
      }}
    >
      <h3>{title}</h3>
      <p>{value}</p>
      <span>{detail}</span>
    </div>
  );
}
