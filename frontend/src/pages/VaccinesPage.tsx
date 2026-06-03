import {
  Link
} from 'react-router-dom';

import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import VaccineModuleTabs from '../components/vaccines/VaccineModuleTabs';

type Vaccine = {
  id: number;
  name: string;
  target_disease: string | null;
  presentation: string | null;
  dose_unit: string | null;
  description: string | null;
  minimum_stock: number;
  total_stock: number;
  is_active: boolean;
};

type VaccineBatch = {
  id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  is_active: boolean;
};

type VaccineAlert = {
  vaccine: Vaccine;
  batches: VaccineBatch[];
};

const emptyForm = {
  name: '',
  target_disease: '',
  presentation: '',
  dose_unit: '',
  description: '',
  minimum_stock: 0
};

export default function VaccinesPage() {

  const { user } = useAuth();

  const [vaccines, setVaccines] =
    useState<Vaccine[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<Vaccine | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [filters, setFilters] =
    useState({
      search: '',
      presentation: 'todas',
      status: 'todos',
      stock: 'todos'
    });

  const [batchAlerts, setBatchAlerts] =
    useState<VaccineAlert[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function loadVaccines() {
    try {
      const res =
        await apiFetch('/vaccines');

      setVaccines(res.data);

      const alerts =
        await Promise.all(
          res.data.map(async (vaccine: Vaccine) => {
            const batchesRes =
              await apiFetch(
                `/vaccines/${vaccine.id}/batches`
              );

            return {
              vaccine,
              batches: batchesRes.data.batches
            };
          })
        );

      setBatchAlerts(alerts);
    } catch (error: any) {
      setError(error.message);
    }
  }

  useEffect(() => {
    loadVaccines();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEdit(
    vaccine: Vaccine
  ) {
    setEditing(vaccine);
    setForm({
      name: vaccine.name || '',
      target_disease: vaccine.target_disease || '',
      presentation: vaccine.presentation || '',
      dose_unit: vaccine.dose_unit || '',
      description: vaccine.description || '',
      minimum_stock: Number(vaccine.minimum_stock || 0)
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError('');

    if (!form.name) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        editing
          ? `/vaccines/${editing.id}`
          : '/vaccines',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(form)
        }
      );

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await loadVaccines();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(
    id: number
  ) {
    try {
      await apiFetch(
        `/vaccines/${id}/toggle`,
        {
          method: 'PATCH'
        }
      );

      loadVaccines();
    } catch (error: any) {
      setError(error.message);
    }
  }

  if (
    user?.role !== 'admin' &&
    user?.role !== 'vacu' &&
    user?.role !== 'dir'
  ) {
    return <h2>No autorizado</h2>;
  }

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'vacu';

  const presentations =
    Array.from(
      new Set(
        vaccines
          .map((v) => v.presentation)
          .filter(Boolean)
      )
    );

  const filteredVaccines =
    vaccines.filter((v) => {
      const search =
        filters.search.toLowerCase();

      const totalStock =
        Number(v.total_stock || 0);

      const minimumStock =
        Number(v.minimum_stock || 0);

      return (
        (
          v.name.toLowerCase().includes(search) ||
          (v.target_disease || '').toLowerCase().includes(search) ||
          (v.presentation || '').toLowerCase().includes(search)
        ) &&
        (
          filters.presentation === 'todas' ||
          v.presentation === filters.presentation
        ) &&
        (
          filters.status === 'todos' ||
          (filters.status === 'activo' && v.is_active) ||
          (filters.status === 'inactivo' && !v.is_active)
        ) &&
        (
          filters.stock === 'todos' ||
          (filters.stock === 'bajo' && totalStock <= minimumStock) ||
          (filters.stock === 'sin_stock' && totalStock <= 0) ||
          (filters.stock === 'con_stock' && totalStock > minimumStock)
        )
      );
    });

  const lowStockVaccines =
    vaccines.filter((v) =>
      Number(v.total_stock || 0) <=
      Number(v.minimum_stock || 0)
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
          vaccineName: item.vaccine.name
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
          vaccineName: item.vaccine.name
        }))
    );

  return (

    <div>

      <div className="page-header">

        <h1 className="page-title">
          Vacunas
        </h1>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreate}
          >
            + Nueva vacuna
          </button>
        )}

      </div>

      <VaccineModuleTabs />

      {user?.facility_id && user.facility_type !== 'secretaria' && (
        <p className="page-subtitle">
          Estas viendo el stock de {user.facility_name || 'tu dependencia'}.
        </p>
      )}

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Stock bajo</h3>
          <p>{lowStockVaccines.length}</p>
          <span>Vacunas para revisar</span>
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
            {lowStockVaccines.slice(0, 5).map((vaccine) => (
              <div
                className="dashboard-list-item"
                key={vaccine.id}
              >
                <strong>{vaccine.name}</strong>
                <span>Stock: {Number(vaccine.total_stock || 0)}</span>
                <span>Minimo: {Number(vaccine.minimum_stock || 0)}</span>
              </div>
            ))}
            {lowStockVaccines.length === 0 && (
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
                <strong>{batch.vaccineName} - lote {batch.batch_number}</strong>
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
          placeholder="Buscar por vacuna, enfermedad o presentacion"
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
              value={presentation || ''}
            >
              {presentation}
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
          <option value="todos">Todos los estados</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
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
          <option value="todos">Todo el stock</option>
          <option value="bajo">Stock bajo</option>
          <option value="sin_stock">Sin stock</option>
          <option value="con_stock">Stock suficiente</option>
        </select>

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              presentation: 'todas',
              status: 'todos',
              stock: 'todos'
            })
          }
        >
          Limpiar
        </button>

      </div>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <p className="results-summary">
        Mostrando {filteredVaccines.length} de {vaccines.length} vacunas
      </p>

      <div className="table-container">

        <table className="data-table">

          <thead>

            <tr>
              <th>ID</th>
              <th>Vacuna</th>
              <th>Previene</th>
              <th>Presentacion</th>
              <th>Unidad</th>
              <th>Stock minimo</th>
              <th>Stock total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>

          </thead>

          <tbody>

            {filteredVaccines.map((vaccine) => (
              <tr key={vaccine.id}>
                <td>{vaccine.id}</td>
                <td>{vaccine.name}</td>
                <td>{vaccine.target_disease || '-'}</td>
                <td>{vaccine.presentation || '-'}</td>
                <td>{vaccine.dose_unit || '-'}</td>
                <td>{Number(vaccine.minimum_stock || 0)}</td>
                <td>
                  <span
                    className={
                      Number(vaccine.total_stock || 0) <=
                      Number(vaccine.minimum_stock || 0)
                        ? 'badge badge-danger'
                        : 'badge badge-success'
                    }
                  >
                    {Number(vaccine.total_stock || 0)}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      vaccine.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {vaccine.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {canEdit && (
                      <button
                        className="btn-primary"
                        onClick={() =>
                          openEdit(vaccine)
                        }
                      >
                        Editar
                      </button>
                    )}

                    <Link
                      className="btn-secondary table-link-button"
                      to={`/vaccines/${vaccine.id}/batches`}
                    >
                      Ver lotes
                    </Link>

                    {canEdit && (
                      <button
                        className={
                          vaccine.is_active
                            ? 'btn-danger'
                            : 'btn-success'
                        }
                        onClick={() =>
                          handleToggle(vaccine.id)
                        }
                      >
                        {vaccine.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredVaccines.length === 0 && (
              <tr>
                <td colSpan={9}>
                  No hay vacunas para esos filtros.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              {editing ? 'Editar vacuna' : 'Nueva vacuna'}
            </h2>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >
              <input
                className="form-input"
                placeholder="Nombre"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Enfermedad que previene"
                value={form.target_disease}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_disease: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Presentacion"
                value={form.presentation}
                onChange={(e) =>
                  setForm({
                    ...form,
                    presentation: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Unidad o dosis"
                value={form.dose_unit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dose_unit: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                placeholder="Stock minimo"
                value={form.minimum_stock}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minimum_stock: Number(e.target.value)
                  })
                }
              />

              <textarea
                className="form-input"
                placeholder="Observaciones"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value
                  })
                }
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

