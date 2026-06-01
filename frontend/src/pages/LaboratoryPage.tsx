import {
  useEffect,
  useMemo,
  useState
} from 'react';

import type {
  FormEvent
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';

type LaboratoryRecord = {
  id: number;
  study_date: string;
  patient_last_name: string;
  patient_first_name: string;
  patient_document: string | null;
  has_blood_extraction: boolean | number;
  has_urine_sample: boolean | number;
  is_complete: boolean | number;
  missing_details: string | null;
  completed_at: string | null;
  pickup_date: string | null;
  picked_up_by: string | null;
  pickup_document: string | null;
  notes: string | null;
  created_by_username?: string | null;
};

type LaboratoryStats = {
  total_records: number;
  blood_extractions: number;
  urine_samples: number;
  both_samples: number;
  pending_pickups: number;
  delivered_results: number;
  incomplete_records: number;
  complete_records: number;
};

const emptyForm = {
  study_date: new Date().toISOString().slice(0, 10),
  patient_last_name: '',
  patient_first_name: '',
  patient_document: '',
  has_blood_extraction: true,
  has_urine_sample: false,
  is_complete: true,
  missing_details: '',
  pickup_date: '',
  picked_up_by: '',
  pickup_document: '',
  notes: ''
};

const initialStats = {
  total_records: 0,
  blood_extractions: 0,
  urine_samples: 0,
  both_samples: 0,
  pending_pickups: 0,
  delivered_results: 0,
  incomplete_records: 0,
  complete_records: 0
};

function toDateInput(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString(
    'es-AR',
    {
      timeZone: 'UTC'
    }
  );
}

function yesNo(
  value: boolean | number
) {
  return Boolean(value);
}

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema'
) {
  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant: 'error'
        }
      }
    )
  );
}

function percentOf(
  value: number,
  total: number
) {
  if (!total) {
    return '0%';
  }

  return `${Math.round((value / total) * 100)}%`;
}

export default function LaboratoryPage() {

  const { user } = useAuth();

  const [records, setRecords] =
    useState<LaboratoryRecord[]>([]);

  const [stats, setStats] =
    useState<LaboratoryStats>(initialStats);

  const [filters, setFilters] =
    useState({
      search: '',
      date_from: '',
      date_to: '',
      sample_type: 'todas',
      pickup_status: 'todos',
      completion_status: 'todos',
      page: 1,
      per_page: 25
    });

  const [pagination, setPagination] =
    useState({
      page: 1,
      per_page: 25,
      total: 0,
      total_pages: 1
    });

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<LaboratoryRecord | null>(null);

  const [pickupRecord, setPickupRecord] =
    useState<LaboratoryRecord | null>(null);

  const [showIncompletePickupWarning, setShowIncompletePickupWarning] =
    useState(false);

  const [completionRecord, setCompletionRecord] =
    useState<LaboratoryRecord | null>(null);

  const [completionForm, setCompletionForm] =
    useState({
      is_complete: true,
      missing_details: ''
    });

  const [pickupForm, setPickupForm] =
    useState({
      pickup_date: new Date().toISOString().slice(0, 10),
      picked_up_by: '',
      pickup_document: '',
      notes: ''
    });

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'lab';

  const canChangeCompletion =
    user?.role === 'admin' ||
    user?.role === 'lab';

  const canPickup =
    canEdit ||
    user?.role === 'user';

  const canView =
    user?.role === 'lab' ||
    canEdit ||
    canPickup ||
    user?.role === 'dir';

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(
        ([key, value]) => {
          if (
            value !== '' &&
            value !== null &&
            value !== undefined &&
            value !== 'todas' &&
            value !== 'todos'
          ) {
            params.set(key, String(value));
          }
        }
      );

      const query =
        params.toString();

      return query
        ? `?${query}`
        : '';
    }, [filters]);

  async function loadLaboratory() {
    try {
      const [recordsRes, statsRes] =
        await Promise.all([
          apiFetch(`/laboratory${queryString}`),
          apiFetch(`/laboratory/stats${queryString}`)
        ]);

      setRecords(recordsRes.data);
      setPagination(
        recordsRes.pagination || {
          page: 1,
          per_page: filters.per_page,
          total: recordsRes.data.length,
          total_pages: 1
        }
      );
      setStats({
        ...initialStats,
        ...statsRes.data
      });
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  useEffect(() => {
    loadLaboratory();
  }, [queryString]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(
    record: LaboratoryRecord
  ) {
    setEditing(record);
    setForm({
      study_date: toDateInput(record.study_date),
      patient_last_name: record.patient_last_name || '',
      patient_first_name: record.patient_first_name || '',
      patient_document: record.patient_document || '',
      has_blood_extraction: yesNo(record.has_blood_extraction),
      has_urine_sample: yesNo(record.has_urine_sample),
      is_complete: yesNo(record.is_complete),
      missing_details: record.missing_details || '',
      pickup_date: '',
      picked_up_by: '',
      pickup_document: '',
      notes: record.notes || ''
    });
    setShowForm(true);
  }

  function openPickup(
    record: LaboratoryRecord
  ) {
    setPickupRecord(record);
    setShowIncompletePickupWarning(false);
    setPickupForm({
      pickup_date:
        toDateInput(record.pickup_date) ||
        new Date().toISOString().slice(0, 10),
      picked_up_by: record.picked_up_by || '',
      pickup_document: record.pickup_document || '',
      notes: record.notes || ''
    });
  }

  function openCompletion(
    record: LaboratoryRecord
  ) {
    setCompletionRecord(record);
    setCompletionForm({
      is_complete: yesNo(record.is_complete),
      missing_details: record.missing_details || ''
    });
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!form.patient_last_name || !form.patient_first_name) {
      showSystemAlert('Debe cargar apellido y nombre del paciente');
      return;
    }

    if (
      user?.role === 'lab' &&
      !form.is_complete &&
      !form.missing_details
    ) {
      showSystemAlert('Indica que estudio o resultado esta pendiente');
      return;
    }

    if (
      !form.has_blood_extraction &&
      !form.has_urine_sample
    ) {
      showSystemAlert('Debe seleccionar al menos sangre u orina');
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        editing
          ? `/laboratory/${editing.id}`
          : '/laboratory',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(form)
        }
      );

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function savePickup(
    allowIncompleteDelivery = false
  ) {
    if (!pickupRecord) {
      return;
    }

    if (!pickupForm.pickup_date) {
      showSystemAlert('Debe cargar la fecha de retiro');
      return;
    }

    if (
      !yesNo(pickupRecord.is_complete) &&
      !allowIncompleteDelivery
    ) {
      setShowIncompletePickupWarning(true);
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        `/laboratory/${pickupRecord.id}/pickup`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...pickupForm,
            picked_up_by:
              pickupForm.picked_up_by.trim() ||
              'Titular'
          })
        }
      );

      setPickupRecord(null);
      setShowIncompletePickupWarning(false);
      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletionSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!completionRecord) {
      return;
    }

    if (
      !completionForm.is_complete &&
      !completionForm.missing_details
    ) {
      showSystemAlert('Indica que estudio o resultado esta pendiente');
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        `/laboratory/${completionRecord.id}/completion`,
        {
          method: 'PATCH',
          body: JSON.stringify(completionForm)
        }
      );

      setCompletionRecord(null);
      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickupSubmit(
    e: FormEvent
  ) {
    e.preventDefault();
    await savePickup(false);
  }

  if (!canView) {
    return <h2>No autorizado</h2>;
  }

  const totalRecords =
    Number(stats.total_records || 0);

  const bloodExtractions =
    Number(stats.blood_extractions || 0);

  const urineSamples =
    Number(stats.urine_samples || 0);

  const pendingPickups =
    Number(stats.pending_pickups || 0);

  const deliveredResults =
    Number(stats.delivered_results || 0);

  const incompleteRecords =
    Number(stats.incomplete_records || 0);

  return (

    <div>

      <div className="page-header">

        <div>
          <h1 className="page-title">
            Laboratorio
          </h1>
          <p className="page-subtitle">
            Estudios, muestras y retiros de resultados.
          </p>
        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreate}
          >
            + Nuevo estudio
          </button>
        )}

      </div>

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Total</h3>
          <p>{totalRecords}</p>
          <span>Estudios en el periodo</span>
        </div>

        <div className="dashboard-card">
          <h3>Extracciones</h3>
          <p>{bloodExtractions}</p>
          <span>
            {percentOf(bloodExtractions, totalRecords)} del total
          </span>
        </div>

        <div className="dashboard-card">
          <h3>Orinas</h3>
          <p>{urineSamples}</p>
          <span>
            {percentOf(urineSamples, totalRecords)} del total
          </span>
        </div>

        <div className="dashboard-card">
          <h3>Pendientes</h3>
          <p>{pendingPickups}</p>
          <span>
            {percentOf(pendingPickups, totalRecords)} pendientes · {percentOf(deliveredResults, totalRecords)} retirados
          </span>
        </div>

        <div className="dashboard-card">
          <h3>Incompletos</h3>
          <p>{incompleteRecords}</p>
          <span>
            {percentOf(incompleteRecords, totalRecords)} con resultados pendientes
          </span>
        </div>

      </div>

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar paciente, DNI o quien retiro"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value,
              page: 1
            })
          }
        />

        <input
          className="form-input"
          type="date"
          value={filters.date_from}
          onChange={(e) =>
            setFilters({
              ...filters,
              date_from: e.target.value,
              page: 1
            })
          }
        />

        <input
          className="form-input"
          type="date"
          value={filters.date_to}
          onChange={(e) =>
            setFilters({
              ...filters,
              date_to: e.target.value,
              page: 1
            })
          }
        />

        <select
          className="form-input"
          value={filters.sample_type}
          onChange={(e) =>
            setFilters({
              ...filters,
              sample_type: e.target.value,
              page: 1
            })
          }
        >
          <option value="todas">Todas las muestras</option>
          <option value="sangre">Solo sangre</option>
          <option value="orina">Solo orina</option>
          <option value="ambas">Sangre y orina</option>
        </select>

        <select
          className="form-input"
          value={filters.pickup_status}
          onChange={(e) =>
            setFilters({
              ...filters,
              pickup_status: e.target.value,
              page: 1
            })
          }
        >
          <option value="todos">Todos los retiros</option>
          <option value="pendiente">Pendientes</option>
          <option value="retirado">Retirados</option>
        </select>

        <select
          className="form-input"
          value={filters.completion_status}
          onChange={(e) =>
            setFilters({
              ...filters,
              completion_status: e.target.value,
              page: 1
            })
          }
        >
          <option value="todos">Todos los estados</option>
          <option value="completo">Completos</option>
          <option value="incompleto">Incompletos</option>
        </select>

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              date_from: '',
              date_to: '',
              sample_type: 'todas',
              pickup_status: 'todos',
              completion_status: 'todos',
              page: 1,
              per_page: filters.per_page
            })
          }
        >
          Limpiar
        </button>

      </div>

      <p className="results-summary">
        Mostrando {records.length} de {pagination.total} estudios
      </p>

      <div className="pagination-bar">
        <span>
          Pagina {pagination.page} de {pagination.total_pages}
        </span>

        <div className="table-actions">
          <select
            className="form-input"
            value={filters.per_page}
            onChange={(e) =>
              setFilters({
                ...filters,
                per_page: Number(e.target.value),
                page: 1
              })
            }
          >
            <option value={25}>25 por pagina</option>
            <option value={50}>50 por pagina</option>
            <option value={100}>100 por pagina</option>
          </select>

          <button
            className="btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() =>
              setFilters({
                ...filters,
                page: Math.max(1, pagination.page - 1)
              })
            }
          >
            Anterior
          </button>

          <button
            className="btn-secondary"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() =>
              setFilters({
                ...filters,
                page: Math.min(
                  pagination.total_pages,
                  pagination.page + 1
                )
              })
            }
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="table-container">

        <table className="data-table">

          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>DNI</th>
              <th>Sangre</th>
              <th>Orina</th>
              <th>Estado</th>
              <th>Retiro</th>
              <th>Retiro por</th>
              <th>Observaciones</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>

            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.study_date)}</td>
                <td>
                  {record.patient_last_name} {record.patient_first_name}
                </td>
                <td>{record.patient_document || '-'}</td>
                <td>
                  <span
                    className={
                      yesNo(record.has_blood_extraction)
                        ? 'badge badge-success'
                        : 'badge'
                    }
                  >
                    {yesNo(record.has_blood_extraction) ? 'Si' : 'No'}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      yesNo(record.has_urine_sample)
                        ? 'badge badge-success'
                        : 'badge'
                    }
                  >
                    {yesNo(record.has_urine_sample) ? 'Si' : 'No'}
                  </span>
                </td>
                <td>
                  {yesNo(record.is_complete) ? (
                    '-'
                  ) : (
                    <span
                      className="badge badge-warning"
                      title={record.missing_details || 'Sin detalle cargado'}
                    >
                      Incompleto
                    </span>
                  )}
                </td>
                <td>
                  {record.pickup_date ? (
                    <span className="badge badge-success">
                      {formatDate(record.pickup_date)}
                    </span>
                  ) : (
                    <span className="badge badge-warning">
                      Pendiente
                    </span>
                  )}
                </td>
                <td>{record.picked_up_by || '-'}</td>
                <td>{record.notes || '-'}</td>
                <td>
                  <div className="table-actions">
                    {canEdit && (
                      <button
                        className="btn-primary"
                        onClick={() =>
                          openEdit(record)
                        }
                      >
                        Editar
                      </button>
                    )}

                    {canPickup && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          openPickup(record)
                        }
                      >
                        Registrar retiro
                      </button>
                    )}
                    {canChangeCompletion && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          openCompletion(record)
                        }
                      >
                        Estado
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {records.length === 0 && (
              <tr>
                <td colSpan={10}>
                  No hay estudios para esos filtros.
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
              {editing ? 'Editar estudio' : 'Nuevo estudio'}
            </h2>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >
              <label className="form-label">
                Fecha del estudio
              </label>
              <input
                className="form-input"
                type="date"
                value={form.study_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    study_date: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Apellido"
                value={form.patient_last_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    patient_last_name: e.target.value.toUpperCase()
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Nombre"
                value={form.patient_first_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    patient_first_name: e.target.value.toUpperCase()
                  })
                }
              />

              <input
                className="form-input"
                placeholder="DNI del paciente (opcional)"
                value={form.patient_document}
                onChange={(e) =>
                  setForm({
                    ...form,
                    patient_document: e.target.value
                  })
                }
              />

              <div className="form-check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.has_blood_extraction}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        has_blood_extraction: e.target.checked
                      })
                    }
                  />
                  Extraccion de sangre
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.has_urine_sample}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        has_urine_sample: e.target.checked
                      })
                    }
                  />
                  Orina
                </label>
              </div>

              {user?.role === 'lab' && (
                <>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={!form.is_complete}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          is_complete: !e.target.checked
                        })
                      }
                    />
                    Estudio incompleto
                  </label>

                  {!form.is_complete && (
                    <textarea
                      className="form-input"
                      placeholder="Que falta completar"
                      rows={3}
                      value={form.missing_details}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          missing_details: e.target.value
                        })
                      }
                    />
                  )}
                </>
              )}

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

      {completionRecord && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Estado del estudio
            </h2>

            <p className="page-subtitle">
              {completionRecord.patient_last_name} {completionRecord.patient_first_name}
            </p>

            <form
              className="auth-form"
              onSubmit={handleCompletionSubmit}
            >
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!completionForm.is_complete}
                  onChange={(e) =>
                    setCompletionForm({
                      ...completionForm,
                      is_complete: !e.target.checked
                    })
                  }
                />
                Estudio incompleto
              </label>

              {!completionForm.is_complete && (
                <textarea
                  className="form-input"
                  placeholder="Que falta completar"
                  rows={3}
                  value={completionForm.missing_details}
                  onChange={(e) =>
                    setCompletionForm({
                      ...completionForm,
                      missing_details: e.target.value
                    })
                  }
                />
              )}

              {completionForm.is_complete && (
                <p className="page-subtitle">
                  Al guardar, el estudio quedara marcado como completo.
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setCompletionRecord(null)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showIncompletePickupWarning && pickupRecord && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Estudio incompleto
            </h2>

            <p className="page-subtitle">
              {pickupRecord.patient_last_name} {pickupRecord.patient_first_name}
            </p>

            <p>
              Este estudio figura como incompleto.
            </p>

            <p className="auth-error">
              Falta: {pickupRecord.missing_details || 'sin detalle cargado'}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setShowIncompletePickupWarning(false)
                }
              >
                No entregar
              </button>

              <button
                type="button"
                className="btn-danger"
                disabled={loading}
                onClick={() =>
                  savePickup(true)
                }
              >
                Entregar igual
              </button>
            </div>
          </div>
        </div>
      )}

      {pickupRecord && !showIncompletePickupWarning && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Registrar retiro
            </h2>

            <p className="page-subtitle">
              {pickupRecord.patient_last_name} {pickupRecord.patient_first_name}
            </p>

            <form
              className="auth-form"
              onSubmit={handlePickupSubmit}
            >
              <label className="form-label">
                Fecha de retiro
              </label>
              <input
                className="form-input"
                type="date"
                value={pickupForm.pickup_date}
                onChange={(e) =>
                  setPickupForm({
                    ...pickupForm,
                    pickup_date: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Quien retiro (si queda vacio: Titular)"
                value={pickupForm.picked_up_by}
                onChange={(e) =>
                  setPickupForm({
                    ...pickupForm,
                    picked_up_by: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="DNI de quien retiro (opcional)"
                value={pickupForm.pickup_document}
                onChange={(e) =>
                  setPickupForm({
                    ...pickupForm,
                    pickup_document: e.target.value
                  })
                }
              />

              <textarea
                className="form-input"
                placeholder="Observaciones"
                rows={3}
                value={pickupForm.notes}
                onChange={(e) =>
                  setPickupForm({
                    ...pickupForm,
                    notes: e.target.value
                  })
                }
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setPickupRecord(null)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
