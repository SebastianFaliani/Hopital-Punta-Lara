import {
  Link
} from 'react-router-dom';

import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import CreateMedicationModal from '../components/medications/CreateMedicationModal';
import EditMedicationModal from '../components/medications/EditMedicationModal';

type Medication = {
  id: number;
  name: string;
  generic_name: string;
  presentation: string;
  concentration: string;
  unit: string;
  description: string;
  minimum_stock: number;
  total_stock: number;
  is_active: boolean;
};

type MedicationBatch = {
  id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  is_active: boolean;
};

type MedicationAlert = {
  medication: Medication;
  batches: MedicationBatch[];
};

export default function MedicationsPage() {

  const { user } = useAuth();

  const [medications, setMedications] =
    useState<Medication[]>([]);

  const [openCreateModal, setOpenCreateModal] =
    useState(false);

  const [selectedMedication,
    setSelectedMedication] =
    useState<Medication | null>(null);

  const [filters, setFilters] =
    useState({
      search: '',
      presentation: 'todas',
      unit: 'todas',
      status: 'todos',
      stock: 'todos'
    });

  const [batchAlerts, setBatchAlerts] =
    useState<MedicationAlert[]>([]);


  async function loadMedications() {

    try {

      const res =
        await apiFetch('/medications');

      setMedications(res.data);

      const alerts =
        await Promise.all(
          res.data.map(async (medication: Medication) => {
            const batchesRes =
              await apiFetch(
                `/medications/${medication.id}/batches`
              );

            return {
              medication,
              batches: batchesRes.data.batches
            };
          })
        );

      setBatchAlerts(alerts);

    } catch (error) {

      console.error(error);
    }
  }

  useEffect(() => {

    loadMedications();

  }, []);

  async function handleToggle(
    id: number
  ) {

    try {

      await apiFetch(
        `/medications/${id}/toggle`,
        {
          method: 'PATCH'
        }
      );

      loadMedications();

    } catch (error) {

      console.error(error);
    }
  }

  if (!user) {

    return null;
  }

  const canEdit =
    user.role === 'admin' ||
    user.role === 'farmacia';

  const presentations =
    Array.from(
      new Set(
        medications
          .map((m) => m.presentation)
          .filter(Boolean)
      )
    );

  const units =
    Array.from(
      new Set(
        medications
          .map((m) => m.unit)
          .filter(Boolean)
      )
    );

  const filteredMedications =
    medications.filter((m) => {

      const search =
        filters.search.toLowerCase();

      const matchesSearch =
        m.name
          .toLowerCase()
          .includes(search) ||
        (m.generic_name || '')
          .toLowerCase()
          .includes(search) ||
        (m.concentration || '')
          .toLowerCase()
          .includes(search);

      const matchesPresentation =
        filters.presentation === 'todas' ||
        m.presentation === filters.presentation;

      const matchesUnit =
        filters.unit === 'todas' ||
        m.unit === filters.unit;

      const matchesStatus =
        filters.status === 'todos' ||
        (
          filters.status === 'activo' &&
          m.is_active
        ) ||
        (
          filters.status === 'inactivo' &&
          !m.is_active
        );

      const totalStock =
        Number(m.total_stock || 0);

      const minimumStock =
        Number(m.minimum_stock || 0);

      const matchesStock =
        filters.stock === 'todos' ||
        (
          filters.stock === 'bajo' &&
          totalStock <= minimumStock
        ) ||
        (
          filters.stock === 'sin_stock' &&
          totalStock <= 0
        ) ||
        (
          filters.stock === 'con_stock' &&
          totalStock > minimumStock
        );

      return (
        matchesSearch &&
        matchesPresentation &&
        matchesUnit &&
        matchesStatus &&
        matchesStock
      );
    });

  const lowStockMedications =
    medications.filter((m) =>
      Number(m.total_stock || 0) <=
      Number(m.minimum_stock || 0)
    );

  const today =
    new Date();

  const in30Days =
    new Date();

  in30Days.setDate(
    today.getDate() + 30
  );

  const expiringBatches =
    batchAlerts.flatMap((item) =>
      item.batches
        .filter((batch) => {
          const expiration =
            new Date(batch.expiration_date);

          return (
            batch.is_active &&
            expiration >= today &&
            expiration <= in30Days
          );
        })
        .map((batch) => ({
          ...batch,
          medicationName: item.medication.name
        }))
    );

  const expiredBatches =
    batchAlerts.flatMap((item) =>
      item.batches
        .filter((batch) =>
          batch.is_active &&
          new Date(batch.expiration_date) < today
        )
        .map((batch) => ({
          ...batch,
          medicationName: item.medication.name
        }))
    );

  return (

    <div>

      <div className="page-header">

        <h1 className="page-title">
          Medicamentos
        </h1>

        <div className="table-actions">

          <Link
            className="btn-secondary table-link-button"
            to="/medications/facilities"
          >
            Puntos de stock
          </Link>

          <Link
            className="btn-secondary table-link-button"
            to="/medications/transfers"
          >
            Traslados
          </Link>

          <Link
            className="btn-secondary table-link-button"
            to="/medications/deliveries"
          >
            Entregas
          </Link>

          <Link
            className="btn-secondary table-link-button"
            to="/medications/chronic"
          >
            Cronicos
          </Link>

          {canEdit && (
            <button
              className="btn-primary"
              onClick={() =>
                setOpenCreateModal(true)
              }
            >
              + Nuevo medicamento
            </button>
          )}

        </div>

      </div>

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Stock bajo</h3>
          <p>{lowStockMedications.length}</p>
          <span>Medicamentos para revisar</span>
        </div>

        <div className="dashboard-card">
          <h3>Por vencer</h3>
          <p>{expiringBatches.length}</p>
          <span>Lotes en los proximos 30 dias</span>
        </div>

        <div className="dashboard-card">
          <h3>Vencidos</h3>
          <p>{expiredBatches.length}</p>
          <span>Lotes activos vencidos</span>
        </div>

      </div>

      <div className="dashboard-sections">

        <section className="dashboard-panel">
          <h2>Alertas de stock</h2>
          <div className="dashboard-list">
            {lowStockMedications.slice(0, 5).map((medication) => (
              <div
                className="dashboard-list-item"
                key={medication.id}
              >
                <strong>{medication.name}</strong>
                <span>Stock: {Number(medication.total_stock || 0)}</span>
                <span>Minimo: {Number(medication.minimum_stock || 0)}</span>
              </div>
            ))}
            {lowStockMedications.length === 0 && (
              <p className="page-subtitle">Sin alertas de stock.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Vencimientos proximos</h2>
          <div className="dashboard-list">
            {expiringBatches.slice(0, 5).map((batch) => (
              <div
                className="dashboard-list-item"
                key={batch.id}
              >
                <strong>{batch.medicationName} - lote {batch.batch_number}</strong>
                <span>Vence: {new Date(batch.expiration_date).toLocaleDateString('es-AR')}</span>
                <span>Stock: {Number(batch.current_stock)}</span>
              </div>
            ))}
            {expiringBatches.length === 0 && (
              <p className="page-subtitle">Sin vencimientos proximos.</p>
            )}
          </div>
        </section>

      </div>

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar por nombre, generico o concentracion"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value
            })
          }
        />

        <select
          className="form-input"
          value={filters.presentation}
          onChange={(e) =>
            setFilters({
              ...filters,
              presentation: e.target.value
            })
          }
        >
          <option value="todas">
            Todas las presentaciones
          </option>
          {presentations.map((presentation) => (
            <option
              key={presentation}
              value={presentation}
            >
              {presentation}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.unit}
          onChange={(e) =>
            setFilters({
              ...filters,
              unit: e.target.value
            })
          }
        >
          <option value="todas">
            Todas las unidades
          </option>
          {units.map((unit) => (
            <option
              key={unit}
              value={unit}
            >
              {unit}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.status}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: e.target.value
            })
          }
        >
          <option value="todos">
            Todos los estados
          </option>
          <option value="activo">
            Activos
          </option>
          <option value="inactivo">
            Inactivos
          </option>
        </select>

        <select
          className="form-input"
          value={filters.stock}
          onChange={(e) =>
            setFilters({
              ...filters,
              stock: e.target.value
            })
          }
        >
          <option value="todos">
            Todo el stock
          </option>
          <option value="bajo">
            Stock bajo
          </option>
          <option value="sin_stock">
            Sin stock
          </option>
          <option value="con_stock">
            Stock suficiente
          </option>
        </select>

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              presentation: 'todas',
              unit: 'todas',
              status: 'todos',
              stock: 'todos'
            })
          }
        >
          Limpiar
        </button>

      </div>

      <p className="results-summary">
        Mostrando {filteredMedications.length} de {medications.length} medicamentos
      </p>

<div className="table-container">
      <table className="data-table">

        <thead>

          <tr style={{
            background: '#f3f4f6'
          }}>

            <th>ID</th>

            <th>Nombre</th>

            <th>Genérico</th>

            <th>Presentación</th>

            <th>Concentración</th>

            <th>Stock mínimo</th>

            <th>Stock total</th>

            <th>Estado</th>

            <th>Acciones</th>

          </tr>

        </thead>



        <tbody>

          {filteredMedications.map((m) => (

            <tr key={m.id}
              style={{
                borderBottom:
                  '1px solid #e5e7eb'
              }}>

              <td>{m.id}</td>

              <td>{m.name}</td>

              <td>{m.generic_name}</td>

              <td>{m.presentation}</td>

              <td>{m.concentration}</td>

              <td>
                {m.minimum_stock}
              </td>

              <td>
                <span
                  className={
                    Number(m.total_stock || 0) <=
                    Number(m.minimum_stock || 0)
                      ? 'badge badge-danger'
                      : 'badge badge-success'
                  }
                >
                  {Number(m.total_stock || 0)}
                </span>
              </td>

              <td>
                <span
                  className={
                    m.is_active
                      ? 'badge badge-success'
                      : 'badge badge-danger'
                  }
                >

                  {
                    m.is_active
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </td>

              <td >

                <div className="table-actions">

                  {canEdit && (
                    <button
                      className="btn-primary"
                      onClick={() =>
                        setSelectedMedication(m)
                      }
                    >
                      Editar
                    </button>
                  )}

                  <Link
                    className="btn-secondary table-link-button"
                    to={`/medications/${m.id}/batches`}
                  >
                    Ver lotes
                  </Link>

                  {canEdit && (
                    <button
                      className={
                        m.is_active
                          ? 'btn-danger'
                          : 'btn-success'
                      }
                      onClick={() =>
                        handleToggle(m.id)
                      }
                    >
                      {
                        m.is_active
                          ? 'Desactivar'
                          : 'Activar'
                      }
                    </button>
                  )}

                </div>

              </td>

            </tr>

          ))}

          {
            filteredMedications.length === 0 && (

              <tr>
                <td colSpan={9}>
                  No hay medicamentos para esos filtros.
                </td>
              </tr>
            )
          }

        </tbody>

      </table>

</div>




      {
        openCreateModal && (

          <CreateMedicationModal
            onClose={() =>
              setOpenCreateModal(false)
            }
            onCreated={() => {

              loadMedications();

              setOpenCreateModal(false);
            }}
          />

        )
      }



      {
        selectedMedication && (

          <EditMedicationModal
            medication={selectedMedication}
            onClose={() =>
              setSelectedMedication(null)
            }
            onUpdated={() => {

              loadMedications();

              setSelectedMedication(null);
            }}
          />

        )
      }

    </div>
  );
}


