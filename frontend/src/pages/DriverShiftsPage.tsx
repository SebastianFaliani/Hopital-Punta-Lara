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
  is_active: boolean;
};

type Ambulance = {
  id: number;
  internal_code: string;
  plate: string;
  is_active: boolean;
};

type Shift = {
  id: number;
  driver_id: number;
  ambulance_id: number;
  start_datetime: string;
  end_datetime: string;
  status: string;
  driver_name: string;
  ambulance_code: string;
  ambulance_plate: string;
};

const emptyForm = {
  driver_id: '',
  ambulance_id: '',
  start_datetime: '',
  end_datetime: '',
  status: 'programada'
};

function toInputDateTime(
  value: string
) {

  return String(value)
    .replace(' ', 'T')
    .slice(0, 16);
}

function formatDateTime(
  value: string
) {

  return new Date(value)
    .toLocaleString('es-AR');
}

export default function DriverShiftsPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'transfers.manage',
      ['admin', 'user']
    );

  const [shifts, setShifts] =
    useState<Shift[]>([]);

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

  const [ambulances, setAmbulances] =
    useState<Ambulance[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<Shift | null>(null);

  const [error, setError] =
    useState('');

  async function loadData() {

    try {

      const [
        shiftRes,
        driverRes,
        ambulanceRes
      ] = await Promise.all([
        apiFetch('/driver-shifts'),
        apiFetch('/drivers'),
        apiFetch('/ambulances')
      ]);

      setShifts(shiftRes.data);
      setDrivers(driverRes.data);
      setAmbulances(ambulanceRes.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  function startEdit(
    shift: Shift
  ) {

    setEditing(shift);
    setForm({
      driver_id: String(shift.driver_id),
      ambulance_id:
        String(shift.ambulance_id),
      start_datetime:
        toInputDateTime(
          shift.start_datetime
        ),
      end_datetime:
        toInputDateTime(
          shift.end_datetime
        ),
      status: shift.status
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
          ? `/driver-shifts/${editing.id}`
          : '/driver-shifts',
        {
          method:
            editing ? 'PUT' : 'POST',
          body:
            JSON.stringify({
              ...form,
              driver_id:
                Number(form.driver_id),
              ambulance_id:
                Number(form.ambulance_id)
            })
        }
      );

      resetForm();
      loadData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  useEffect(() => {

    loadData();

  }, []);

  return (

    <div>

      <TransfersNav />

      <div className="page-header">
        <h1 className="page-title">
          Guardias de choferes
        </h1>
      </div>

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver las guardias sin modificar datos.
        </p>
      )}

      {canEdit && (
        <form
          className="management-form"
          onSubmit={handleSubmit}
        >

        <select
          className="form-input"
          name="driver_id"
          value={form.driver_id}
          onChange={handleChange}
        >
          <option value="">
            Chofer
          </option>
          {drivers
            .filter((driver) =>
              driver.is_active
            )
            .map((driver) => (
              <option
                key={driver.id}
                value={driver.id}
              >
                {driver.first_name} {driver.last_name}
              </option>
            ))}
        </select>

        <select
          className="form-input"
          name="ambulance_id"
          value={form.ambulance_id}
          onChange={handleChange}
        >
          <option value="">
            Ambulancia
          </option>
          {ambulances
            .filter((ambulance) =>
              ambulance.is_active
            )
            .map((ambulance) => (
              <option
                key={ambulance.id}
                value={ambulance.id}
              >
                {ambulance.internal_code} - {ambulance.plate}
              </option>
            ))}
        </select>

        <input
          className="form-input"
          type="datetime-local"
          name="start_datetime"
          value={form.start_datetime}
          onChange={handleChange}
        />

        <input
          className="form-input"
          type="datetime-local"
          name="end_datetime"
          value={form.end_datetime}
          onChange={handleChange}
        />

        <select
          className="form-input"
          name="status"
          value={form.status}
          onChange={handleChange}
        >
          <option value="programada">
            Programada
          </option>
          <option value="activa">
            Activa
          </option>
          <option value="finalizada">
            Finalizada
          </option>
        </select>

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
              <th>Chofer</th>
              <th>Ambulancia</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
              {canEdit && (
                <th>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td>{shift.driver_name}</td>
                <td>
                  {shift.ambulance_code} - {shift.ambulance_plate}
                </td>
                <td>
                  {formatDateTime(
                    shift.start_datetime
                  )}
                </td>
                <td>
                  {formatDateTime(
                    shift.end_datetime
                  )}
                </td>
                <td>{shift.status}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn-primary"
                      onClick={() =>
                        startEdit(shift)
                      }
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {shifts.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5}>
                  No hay guardias cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
