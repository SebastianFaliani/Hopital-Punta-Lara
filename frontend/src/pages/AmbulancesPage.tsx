import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';

import TransfersNav
  from '../components/transfers/TransfersNav';

type Ambulance = {
  id: number;
  internal_code: string;
  plate: string;
  brand: string;
  model: string;
  type: string;
  status: string;
  is_active: boolean;
};

const emptyForm = {
  internal_code: '',
  plate: '',
  brand: '',
  model: '',
  type: 'traslado',
  status: 'disponible'
};

export default function AmbulancesPage() {
  const { user } =
    useAuth();

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'user';

  const [ambulances, setAmbulances] =
    useState<Ambulance[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<Ambulance | null>(null);

  const [error, setError] =
    useState('');

  async function loadAmbulances() {

    try {

      const res =
        await apiFetch('/ambulances');

      setAmbulances(res.data);

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
    ambulance: Ambulance
  ) {

    setEditing(ambulance);
    setForm({
      internal_code:
        ambulance.internal_code,
      plate:
        ambulance.plate,
      brand:
        ambulance.brand || '',
      model:
        ambulance.model || '',
      type:
        ambulance.type,
      status:
        ambulance.status
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
          ? `/ambulances/${editing.id}`
          : '/ambulances',
        {
          method:
            editing ? 'PUT' : 'POST',
          body:
            JSON.stringify(form)
        }
      );

      resetForm();
      loadAmbulances();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleToggle(
    id: number
  ) {

    await apiFetch(
      `/ambulances/${id}/status`,
      { method: 'PATCH' }
    );

    loadAmbulances();
  }

  useEffect(() => {

    loadAmbulances();

  }, []);

  return (

    <div>

      <TransfersNav />

      <div className="page-header">
        <h1 className="page-title">
          Ambulancias
        </h1>
      </div>

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver las ambulancias sin modificar datos.
        </p>
      )}

      {canEdit && (
        <form
          className="management-form"
          onSubmit={handleSubmit}
        >

        <input
          className="form-input"
          name="internal_code"
          placeholder="Codigo interno"
          value={form.internal_code}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="plate"
          placeholder="Patente"
          value={form.plate}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="brand"
          placeholder="Marca"
          value={form.brand}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="model"
          placeholder="Modelo"
          value={form.model}
          onChange={handleChange}
        />

        <select
          className="form-input"
          name="type"
          value={form.type}
          onChange={handleChange}
        >
          <option value="traslado">
            Traslado
          </option>
          <option value="utim">
            UTIM
          </option>
          <option value="pediatrica">
            Pediatrica
          </option>
        </select>

        <select
          className="form-input"
          name="status"
          value={form.status}
          onChange={handleChange}
        >
          <option value="disponible">
            Disponible
          </option>
          <option value="en_viaje">
            En viaje
          </option>
          <option value="mantenimiento">
            Mantenimiento
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
              <th>Codigo</th>
              <th>Patente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Activo</th>
              {canEdit && (
                <th>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {ambulances.map((ambulance) => (
              <tr key={ambulance.id}>
                <td>{ambulance.internal_code}</td>
                <td>{ambulance.plate}</td>
                <td>{ambulance.type}</td>
                <td>{ambulance.status}</td>
                <td>
                  {ambulance.is_active ? 'Si' : 'No'}
                </td>
                {canEdit && (
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-primary"
                        onClick={() =>
                          startEdit(ambulance)
                        }
                      >
                        Editar
                      </button>
                      <button
                        className={
                          ambulance.is_active
                            ? 'btn-danger'
                            : 'btn-success'
                        }
                        onClick={() =>
                          handleToggle(ambulance.id)
                        }
                      >
                        {
                          ambulance.is_active
                            ? 'Desactivar'
                            : 'Activar'
                        }
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {ambulances.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5}>
                  No hay ambulancias cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
