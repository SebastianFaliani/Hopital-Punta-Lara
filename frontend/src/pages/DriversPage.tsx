import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';

import TransfersNav
  from '../components/transfers/TransfersNav';

type Driver = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  license_number: string;
  is_active: boolean;
};

const emptyForm = {
  first_name: '',
  last_name: '',
  phone: '',
  license_number: ''
};

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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  function startEdit(
    driver: Driver
  ) {

    setEditing(driver);
    setForm({
      first_name: driver.first_name,
      last_name: driver.last_name,
      phone: driver.phone || '',
      license_number:
        driver.license_number || ''
    });
  }

  function resetForm() {

    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        editing
          ? `/drivers/${editing.id}`
          : '/drivers',
        {
          method:
            editing ? 'PUT' : 'POST',
          body:
            JSON.stringify(form)
        }
      );

      resetForm();
      loadDrivers();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleToggle(
    id: number
  ) {

    await apiFetch(
      `/drivers/${id}/status`,
      { method: 'PATCH' }
    );

    loadDrivers();
  }

  useEffect(() => {

    loadDrivers();

  }, []);

  return (

    <div>

      <TransfersNav />

      <div className="page-header">
        <h1 className="page-title">
          Choferes
        </h1>
      </div>

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver los choferes sin modificar datos.
        </p>
      )}

      {canEdit && (
        <form
          className="management-form"
          onSubmit={handleSubmit}
        >

        <input
          className="form-input"
          name="first_name"
          placeholder="Nombre"
          value={form.first_name}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="last_name"
          placeholder="Apellido"
          value={form.last_name}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="phone"
          placeholder="Telefono"
          value={form.phone}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="license_number"
          placeholder="Licencia"
          value={form.license_number}
          onChange={handleChange}
        />

        <div className="management-actions">
          <button
            className="btn-success"
            type="submit"
          >
            {
              editing
                ? 'Guardar'
                : 'Crear'
            }
          </button>

          {
            editing && (
              <button
                className="btn-secondary"
                type="button"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )
          }
        </div>

        </form>
      )}

      {
        error && (
          <p className="auth-error">
            {error}
          </p>
        )
      }

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Telefono</th>
              <th>Licencia</th>
              <th>Activo</th>
              {canEdit && (
                <th>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td>
                  {driver.first_name} {driver.last_name}
                </td>
                <td>{driver.phone}</td>
                <td>{driver.license_number}</td>
                <td>
                  {driver.is_active ? 'Si' : 'No'}
                </td>
                {canEdit && (
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-primary"
                        onClick={() =>
                          startEdit(driver)
                        }
                      >
                        Editar
                      </button>
                      <button
                        className={
                          driver.is_active
                            ? 'btn-danger'
                            : 'btn-success'
                        }
                        onClick={() =>
                          handleToggle(driver.id)
                        }
                      >
                        {
                          driver.is_active
                            ? 'Desactivar'
                            : 'Activar'
                        }
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {drivers.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4}>
                  No hay choferes cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
