import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import TransfersHeader
  from '../components/transfers/TransfersHeader';
import {
  formatDisplayDate
} from '../utils/dateFormat';

type Driver = {
  id: number | null;
  employee_id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  license_number: string | null;
  license_expiration_date: string | null;
  license_alert_level: number;
  is_active: boolean;
};

const emptyForm = {
  employee_id: '',
  license_number: '',
  license_expiration_date: ''
};

const pageSize =
  10;

function licenseBadgeClass(
  driver: Driver
) {
  if (driver.license_alert_level === 2) {
    return 'badge badge-danger';
  }

  if (driver.license_alert_level === 1) {
    return 'badge badge-warning';
  }

  return 'badge badge-success';
}

function licenseBadgeText(
  driver: Driver
) {
  if (!driver.license_expiration_date) {
    return 'Sin vencimiento';
  }

  const dateText =
    formatDisplayDate(
      driver.license_expiration_date
    );

  if (driver.license_alert_level === 2) {
    return `Vencida ${dateText}`;
  }

  if (driver.license_alert_level === 1) {
    return `Por vencer ${dateText}`;
  }

  return dateText;
}

export default function DriversPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'transfers.manage',
      ['admin', 'user']
    );

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<Driver | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function loadDrivers() {
    try {
      const res =
        await apiFetch('/drivers');

      setDrivers(res.data);
    } catch (error: any) {
      setError(error.message);
    }
  }

  function openEdit(
    driver: Driver
  ) {
    setEditing(driver);
    setForm({
      employee_id:
        driver.employee_id
          ? String(driver.employee_id)
          : '',
      license_number:
        driver.license_number || '',
      license_expiration_date:
        driver.license_expiration_date || ''
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
    setError('');
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setForm({
      ...form,
      [event.target.name]:
        event.target.value
    });
  }

  async function saveDriver(
    event: React.FormEvent
  ) {
    event.preventDefault();
    setError('');

    try {
      setLoading(true);

      await apiFetch(
        editing?.id
          ? `/drivers/${editing.id}`
          : '/drivers',
        {
          method:
            editing?.id ? 'PUT' : 'POST',
          body:
            JSON.stringify(form)
        }
      );

      closeForm();
      await loadDrivers();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleDriver(
    id: number | null
  ) {
    if (!id) {
      return;
    }

    try {
      await apiFetch(
        `/drivers/${id}/status`,
        { method: 'PATCH' }
      );

      await loadDrivers();
    } catch (error: any) {
      setError(error.message);
    }
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  const filteredDrivers =
    useMemo(
      () => {
        const term =
          search.trim().toLowerCase();

        return drivers.filter((driver) => {
          if (!term) {
            return true;
          }

          return [
            driver.first_name,
            driver.last_name,
            driver.full_name,
            driver.phone,
            driver.license_number
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(term)
            );
        });
      },
      [drivers, search]
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredDrivers.length / pageSize
      )
    );

  const safePage =
    Math.min(page, totalPages);

  const paginatedDrivers =
    filteredDrivers.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
    );

  return (
    <div>
      <TransfersHeader
        title="Choferes"
        description="Gestiona los empleados del sector choferes, su licencia y vencimiento."
      />

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver los choferes sin modificar datos.
        </p>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Buscar por nombre, telefono o licencia"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <p className="results-summary">
        Mostrando {paginatedDrivers.length} de {filteredDrivers.length} choferes
      </p>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Telefono</th>
              <th>Licencia</th>
              <th>Vencimiento</th>
              <th>Activo</th>
              {canEdit && (
                <th>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedDrivers.map((driver) => (
              <tr key={driver.id}>
                <td>
                  {driver.full_name || `${driver.first_name} ${driver.last_name}`}
                </td>
                <td>{driver.phone || '-'}</td>
                <td>{driver.license_number || '-'}</td>
                <td>
                  <span className={licenseBadgeClass(driver)}>
                    {licenseBadgeText(driver)}
                  </span>
                </td>
                <td>
                  {driver.is_active ? 'Si' : 'No'}
                </td>
                {canEdit && (
                  <td>
                    <div className="table-actions">
                      <IconButton
                        icon="edit"
                        label="Vincular licencia y vencimiento"
                        onClick={() =>
                          openEdit(driver)
                        }
                        variant="primary"
                      />
                      {driver.id && (
                        <IconButton
                          icon={driver.is_active ? 'lock' : 'unlock'}
                          label={driver.is_active ? 'Desactivar chofer' : 'Activar chofer'}
                          onClick={() =>
                            toggleDriver(driver.id)
                          }
                          variant={
                            driver.is_active
                              ? 'danger'
                              : 'success'
                          }
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {filteredDrivers.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5}>
                  No hay empleados en el sector choferes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span>
          Pagina {safePage} de {totalPages}
        </span>
        <div className="table-actions">
          <button
            className="btn-secondary"
            disabled={safePage <= 1}
            onClick={() =>
              setPage((value) =>
                Math.max(1, value - 1)
              )
            }
            type="button"
          >
            Anterior
          </button>
          <button
            className="btn-secondary"
            disabled={safePage >= totalPages}
            onClick={() =>
              setPage((value) =>
                Math.min(totalPages, value + 1)
              )
            }
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              aria-label="Cerrar"
              className="modal-close-button"
              onClick={closeForm}
              type="button"
            >
              x
            </button>
            <h2 className="modal-title">
              Licencia de chofer
            </h2>
            {editing && (
              <p className="modal-subtitle">
                {editing.full_name}
              </p>
            )}

            <form
              className="auth-form"
              onSubmit={saveDriver}
            >
              <input
                className="form-input"
                name="license_number"
                placeholder="Numero de licencia"
                value={form.license_number}
                onChange={handleChange}
              />

              <input
                className="form-input"
                name="license_expiration_date"
                type="date"
                value={form.license_expiration_date}
                onChange={handleChange}
              />

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeForm}
                >
                  Cancelar
                </button>
                <button
                  className="btn-success"
                  disabled={loading}
                  type="submit"
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
