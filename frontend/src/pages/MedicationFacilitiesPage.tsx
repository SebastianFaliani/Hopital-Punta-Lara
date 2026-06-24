import {
  useEffect,
  useState
} from 'react';

import {
  apiFetch
} from '../api/api';

import {
  useAuth
} from '../auth/useAuth';

type Facility = {
  id: number;
  name: string;
  facility_type: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
};

const typeLabels: Record<string, string> = {
  secretaria: 'Secretaria',
  hospital: 'Hospital',
  unidad_sanitaria: 'Unidad sanitaria',
  otro: 'Otro'
};

const emptyForm = {
  name: '',
  facility_type: 'unidad_sanitaria',
  address: '',
  phone: '',
  notes: ''
};

export default function MedicationFacilitiesPage() {

  const { user } =
    useAuth();

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [selectedFacility, setSelectedFacility] =
    useState<Facility | null>(null);

  const [showFormModal, setShowFormModal] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const canEdit =
    user?.role === 'admin';

  async function loadFacilities() {

    try {

      setError('');

      const res =
        await apiFetch(
          '/health-facilities?includeInactive=true'
        );

      setFacilities(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function startEdit(
    facility: Facility
  ) {

    setSelectedFacility(facility);

    setForm({
      name: facility.name,
      facility_type: facility.facility_type,
      address: facility.address || '',
      phone: facility.phone || '',
      notes: facility.notes || ''
    });

    setShowFormModal(true);
  }

  function clearForm() {

    setSelectedFacility(null);
    setForm(emptyForm);
    setShowFormModal(false);
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        selectedFacility
          ? `/health-facilities/${selectedFacility.id}`
          : '/health-facilities',
        {
          method: selectedFacility
            ? 'PUT'
            : 'POST',
          body: JSON.stringify(form)
        }
      );

      clearForm();
      await loadFacilities();

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
        `/health-facilities/${id}/toggle`,
        {
          method: 'PATCH'
        }
      );

      await loadFacilities();

    } catch (error: any) {

      setError(error.message);
    }
  }

  useEffect(() => {

    loadFacilities();

  }, []);

  return (

    <div>

      <div className="page-header">

        <div>

          <h1 className="page-title">
            Dependencias
          </h1>

          <p className="page-subtitle">
            Secretaria, hospital y unidades sanitarias del sistema.
          </p>

        </div>

        {canEdit && (
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              setSelectedFacility(null);
              setForm(emptyForm);
              setShowFormModal(true);
            }}
          >
            + Nueva dependencia
          </button>
        )}

      </div>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      {canEdit && showFormModal && (

        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              className="modal-close-button"
              type="button"
              onClick={clearForm}
            >
              x
            </button>

            <h2 className="modal-title">
              {
                selectedFacility
                  ? 'Editar dependencia'
                  : 'Nueva dependencia'
              }
            </h2>

        <form
          className="personnel-form"
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

          <select
            className="form-input"
            value={form.facility_type}
            onChange={(e) =>
              setForm({
                ...form,
                facility_type: e.target.value
              })
            }
          >
            <option value="secretaria">
              Secretaria
            </option>
            <option value="hospital">
              Hospital
            </option>
            <option value="unidad_sanitaria">
              Unidad sanitaria
            </option>
            <option value="otro">
              Otro
            </option>
          </select>

          <input
            className="form-input"
            placeholder="Direccion"
            value={form.address}
            onChange={(e) =>
              setForm({
                ...form,
                address: e.target.value
              })
            }
          />

          <input
            className="form-input"
            placeholder="Telefono"
            value={form.phone}
            onChange={(e) =>
              setForm({
                ...form,
                phone: e.target.value
              })
            }
          />

          <textarea
            className="form-input"
            placeholder="Observaciones"
            rows={3}
            value={form.notes}
            onChange={(e) =>
              setForm({
                ...form,
                notes: e.target.value
              })
            }
          />

          <div className="modal-actions">

            {selectedFacility && (
              <button
                type="button"
                className="btn-secondary"
                onClick={clearForm}
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              className="btn-success"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Guardar'
              }
            </button>

          </div>

        </form>
          </div>
        </div>
      )}

      <div className="table-container">

        <table className="data-table">

          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Direccion</th>
              <th>Telefono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>

            {facilities.map((facility) => (
              <tr key={facility.id}>
                <td>{facility.name}</td>
                <td>{typeLabels[facility.facility_type]}</td>
                <td>{facility.address || '-'}</td>
                <td>{facility.phone || '-'}</td>
                <td>
                  <span
                    className={
                      facility.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {
                      facility.is_active
                        ? 'Activo'
                        : 'Inactivo'
                    }
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {canEdit && (
                      <button
                        className="btn-primary"
                        onClick={() =>
                          startEdit(facility)
                        }
                      >
                        Editar
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className={
                          facility.is_active
                            ? 'btn-danger'
                            : 'btn-success'
                        }
                        onClick={() =>
                          handleToggle(facility.id)
                        }
                      >
                        {
                          facility.is_active
                            ? 'Desactivar'
                            : 'Activar'
                        }
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {facilities.length === 0 && (
              <tr>
                <td colSpan={6}>
                  No hay puntos cargados.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}
