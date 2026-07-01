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
import { hasPermission } from '../auth/permissions';
import {
  formatDisplayDate
} from '../utils/dateFormat';

type LaboratoryTest = {
  id: number;
  test_id?: number;
  category: string;
  code: string;
  name: string;
  display_order: number;
  requested?: boolean;
  received?: boolean;
};

type LaboratoryRecord = {
  id: number;
  protocol_number: string | null;
  study_date: string;
  patient_last_name: string;
  patient_first_name: string;
  patient_document: string | null;
  patient_birth_date: string | null;
  has_blood_extraction: boolean | number;
  has_urine_sample: boolean | number;
  is_complete: boolean | number;
  status: string;
  missing_details: string | null;
  completed_at: string | null;
  pickup_date: string | null;
  picked_up_by: string | null;
  pickup_document: string | null;
  notes: string | null;
  requested_tests_count: number;
  received_tests_count: number;
  tests: LaboratoryTest[];
  created_by_username?: string | null;
};

type LaboratoryStats = {
  total_records: number;
  blood_extractions: number;
  urine_samples: number;
  pending_pickups: number;
  delivered_results: number;
  incomplete_records: number;
  complete_records: number;
  sent_records: number;
  partial_records: number;
};

const emptyForm = {
  protocol_number: '',
  study_date: new Date().toISOString().slice(0, 10),
  patient_last_name: '',
  patient_first_name: '',
  patient_document: '',
  patient_birth_date: '',
  has_blood_extraction: false,
  has_urine_sample: false,
  requested_test_ids: [] as number[],
  notes: ''
};

const initialStats = {
  total_records: 0,
  blood_extractions: 0,
  urine_samples: 0,
  pending_pickups: 0,
  delivered_results: 0,
  incomplete_records: 0,
  complete_records: 0,
  sent_records: 0,
  partial_records: 0
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
  return formatDisplayDate(value);
}

function yesNo(
  value: boolean | number
) {
  return Boolean(value);
}

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema',
  variant = 'error'
) {
  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant
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

function getStatusLabel(
  status: string,
  isComplete: boolean | number,
  pickupDate?: string | null
) {
  if (pickupDate || status === 'retirado') {
    if (!yesNo(isComplete)) {
      return {
        text: 'Retirado incompleto',
        className: 'badge badge-danger'
      };
    }

    return {
      text: 'Retirado',
      className: 'badge badge-info'
    };
  }

  if (yesNo(isComplete) || status === 'completo') {
    return {
      text: 'Completo',
      className: 'badge badge-success'
    };
  }

  if (status === 'parcial') {
    return {
      text: 'Parcial',
      className: 'badge badge-warning'
    };
  }

  return {
    text: 'Enviado',
    className: 'badge badge-info'
  };
}

export default function LaboratoryPage() {

  const { user } = useAuth();

  const [records, setRecords] =
    useState<LaboratoryRecord[]>([]);

  const [catalog, setCatalog] =
    useState<LaboratoryTest[]>([]);

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
      test_status: 'todos',
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

  const [receivedTestIds, setReceivedTestIds] =
    useState<number[]>([]);

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
    hasPermission(
      user,
      'laboratory.manage',
      ['admin', 'lab']
    );

  const canChangeCompletion =
    user?.role === 'admin' ||
    user?.role === 'lab';

  const canPickup =
    canEdit ||
    hasPermission(
      user,
      'laboratory.pickup',
      ['admin', 'lab', 'user']
    );

  const canView =
    canEdit ||
    canPickup ||
    hasPermission(
      user,
      'laboratory.view',
      ['admin', 'lab', 'user', 'dir']
    );

  const testsByCategory =
    useMemo(() => {
      return catalog.reduce(
        (
          groups: Record<string, LaboratoryTest[]>,
          test
        ) => {
          groups[test.category] ||= [];
          groups[test.category].push(test);
          return groups;
        },
        {}
      );
    }, [catalog]);

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
      const [recordsRes, statsRes, catalogRes] =
        await Promise.all([
          apiFetch(`/laboratory${queryString}`),
          apiFetch(`/laboratory/stats${queryString}`),
          apiFetch('/laboratory/catalog')
        ]);

      setRecords(recordsRes.data);
      setCatalog(catalogRes.data);
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
      protocol_number: record.protocol_number || '',
      study_date: toDateInput(record.study_date),
      patient_last_name: record.patient_last_name || '',
      patient_first_name: record.patient_first_name || '',
      patient_document: record.patient_document || '',
      patient_birth_date: toDateInput(record.patient_birth_date),
      has_blood_extraction: yesNo(record.has_blood_extraction),
      has_urine_sample: yesNo(record.has_urine_sample),
      requested_test_ids:
        (record.tests || [])
          .filter((test) => test.requested)
          .map((test) => Number(test.test_id || test.id)),
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
    setReceivedTestIds(
      (record.tests || [])
        .filter((test) => test.received)
        .map((test) => Number(test.test_id || test.id))
    );
  }

  function toggleRequestedTest(
    testId: number
  ) {
    setForm((current) => ({
      ...current,
      requested_test_ids:
        current.requested_test_ids.includes(testId)
          ? current.requested_test_ids.filter((id) =>
            id !== testId
          )
          : [
            ...current.requested_test_ids,
            testId
          ]
    }));
  }

  function areAllRequestedTestsSelected(
    tests: LaboratoryTest[]
  ) {
    return tests.length > 0 &&
      tests.every((test) =>
        form.requested_test_ids.includes(test.id)
      );
  }

  function toggleRequestedCategory(
    tests: LaboratoryTest[]
  ) {
    const testIds =
      tests.map((test) =>
        test.id
      );

    const allSelected =
      testIds.every((id) =>
        form.requested_test_ids.includes(id)
      );

    setForm((current) => {
      const selected =
        new Set(current.requested_test_ids);

      testIds.forEach((id) => {
        if (allSelected) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
      });

      return {
        ...current,
        requested_test_ids:
          Array.from(selected)
      };
    });
  }

  function toggleReceivedTest(
    testId: number
  ) {
    setReceivedTestIds((current) =>
      current.includes(testId)
        ? current.filter((id) =>
          id !== testId
        )
        : [
          ...current,
          testId
        ]
    );
  }

  function getLaboratoryTestIdentifier(
    test: LaboratoryTest
  ) {
    return Number(test.test_id || test.id);
  }

  function areAllReceivedTestsSelected(
    tests: LaboratoryTest[]
  ) {
    return tests.length > 0 &&
      tests.every((test) =>
        receivedTestIds.includes(
          getLaboratoryTestIdentifier(test)
        )
      );
  }

  function toggleReceivedCategory(
    tests: LaboratoryTest[]
  ) {
    const testIds =
      tests.map(getLaboratoryTestIdentifier);

    const allSelected =
      testIds.every((id) =>
        receivedTestIds.includes(id)
      );

    setReceivedTestIds((current) => {
      const selected =
        new Set(current);

      testIds.forEach((id) => {
        if (allSelected) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
      });

      return Array.from(selected);
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

    if (form.requested_test_ids.length === 0) {
      showSystemAlert('Debe seleccionar al menos una practica solicitada');
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

    try {
      setLoading(true);

      await apiFetch(
        `/laboratory/${completionRecord.id}/completion`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            received_test_ids: receivedTestIds
          })
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

  const pendingPickups =
    Number(stats.pending_pickups || 0);

  const deliveredResults =
    Number(stats.delivered_results || 0);

  const partialRecords =
    Number(stats.partial_records || 0);

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
            Hoja de ruta, resultados recibidos y retiro de estudios.
          </p>
        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreate}
          >
            + Nueva hoja de ruta
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
          <h3>En proceso</h3>
          <p>{incompleteRecords}</p>
          <span>{percentOf(incompleteRecords, totalRecords)} con resultados pendientes</span>
        </div>

        <div className="dashboard-card">
          <h3>Parciales</h3>
          <p>{partialRecords}</p>
          <span>{percentOf(partialRecords, totalRecords)} llegaron incompletos</span>
        </div>

        <div className="dashboard-card">
          <h3>Para retirar</h3>
          <p>{pendingPickups}</p>
          <span>{percentOf(pendingPickups, totalRecords)} completos sin retiro</span>
        </div>

        <div className="dashboard-card">
          <h3>Retirados</h3>
          <p>{deliveredResults}</p>
          <span>{percentOf(deliveredResults, totalRecords)} entregados</span>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Buscar paciente, DNI, protocolo o quien retiro"
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
          <option value="incompleto">Con pendientes</option>
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
              test_status: 'todos',
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
              <th>Protocolo</th>
              <th>Paciente</th>
              <th>DNI</th>
              <th>Prácticas</th>
              <th>Estado</th>
              <th>Retiro</th>
              <th>Retiro por</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => {
              const status =
                getStatusLabel(
                  record.status,
                  record.is_complete,
                  record.pickup_date
                );

              const canModifyRecord =
                !record.pickup_date ||
                user?.role === 'admin';

              return (
                <tr key={record.id}>
                  <td>{formatDate(record.study_date)}</td>
                  <td>{record.protocol_number || '-'}</td>
                  <td>
                    {record.patient_last_name} {record.patient_first_name}
                  </td>
                  <td>{record.patient_document || '-'}</td>
                  <td>
                    <div className="laboratory-practice-preview">
                      <strong>
                        {record.received_tests_count || 0}/{record.requested_tests_count || 0}
                      </strong>
                      <span>
                        {(record.tests || [])
                          .slice(0, 4)
                          .map((test) => test.name)
                          .join(', ') || '-'}
                      </span>
                      {(record.tests || []).length > 0 && (
                        <div className="laboratory-practice-tooltip">
                          <strong>Prácticas solicitadas</strong>
                          <ul>
                            {(record.tests || []).map((test) => (
                              <li key={test.test_id || test.id}>
                                <span>
                                  {test.category} - {test.name}
                                </span>
                                <em>
                                  {test.received ? 'Recibido' : 'Pendiente'}
                                </em>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={status.className}>
                      {status.text}
                    </span>
                  </td>
                  <td>
                    {record.pickup_date ? (
                      <span
                        className={
                          yesNo(record.is_complete)
                            ? 'badge badge-success'
                            : 'badge badge-danger'
                        }
                      >
                        {formatDate(record.pickup_date)}
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td>{record.picked_up_by || '-'}</td>
                  <td>
                    <div className="table-actions">
                      {canEdit && canModifyRecord && (
                        <button
                          className="btn-primary"
                          onClick={() =>
                            openEdit(record)
                          }
                        >
                          Editar
                        </button>
                      )}

                      {canChangeCompletion && canModifyRecord && (
                        <button
                          className="btn-secondary"
                          onClick={() =>
                            openCompletion(record)
                          }
                        >
                          Resultados
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
                    </div>
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td colSpan={9}>
                  No hay estudios para esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setShowForm(false)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <h2 className="modal-title">
              {editing ? 'Editar hoja de ruta' : 'Nueva hoja de ruta'}
            </h2>

            <form
              className="laboratory-route-form"
              onSubmit={handleSubmit}
            >
              <div className="laboratory-patient-grid">
                <label className="form-field">
                  <span>Apellido</span>
                  <input
                    className="form-input"
                    value={form.patient_last_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_last_name: e.target.value.toUpperCase()
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Nombre</span>
                  <input
                    className="form-input"
                    value={form.patient_first_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_first_name: e.target.value.toUpperCase()
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Protocolo</span>
                  <input
                    className="form-input"
                    value={form.protocol_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        protocol_number: e.target.value
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Fecha</span>
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
                </label>

                <label className="form-field">
                  <span>DNI</span>
                  <input
                    className="form-input"
                    value={form.patient_document}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_document: e.target.value
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Fecha nacimiento</span>
                  <input
                    className="form-input"
                    type="date"
                    value={form.patient_birth_date}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_birth_date: e.target.value
                      })
                    }
                  />
                </label>
              </div>

              <div className="laboratory-tests-grid">
                {Object.entries(testsByCategory).map(([category, tests]) => (
                  <section
                    className="laboratory-test-group"
                    key={category}
                  >
                    <div className="laboratory-test-group-header">
                      <h3>{category}</h3>
                      <button
                        className="laboratory-select-section-button"
                        type="button"
                        onClick={() =>
                          toggleRequestedCategory(tests)
                        }
                      >
                        {
                          areAllRequestedTestsSelected(tests)
                            ? 'Quitar todo'
                            : 'Seleccionar todo'
                        }
                      </button>
                    </div>
                    <div className="laboratory-test-options">
                      {tests.map((test) => (
                        <label
                          className="checkbox-row"
                          key={test.id}
                        >
                          <input
                            type="checkbox"
                            checked={form.requested_test_ids.includes(test.id)}
                            onChange={() =>
                              toggleRequestedTest(test.id)
                            }
                          />
                          {test.name}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

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
          <div className="modal-content modal-content-wide">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setCompletionRecord(null)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <h2 className="modal-title">
              Resultados recibidos
            </h2>

            <p className="page-subtitle">
              {completionRecord.patient_last_name} {completionRecord.patient_first_name}
            </p>

            <form
              className="laboratory-route-form"
              onSubmit={handleCompletionSubmit}
            >
              <div className="laboratory-tests-grid">
                {Object.entries(
                  (completionRecord.tests || []).reduce(
                    (
                      groups: Record<string, LaboratoryTest[]>,
                      test
                    ) => {
                      groups[test.category] ||= [];
                      groups[test.category].push(test);
                      return groups;
                    },
                    {}
                  )
                ).map(([category, tests]) => (
                  <section
                    className="laboratory-test-group"
                    key={category}
                  >
                    <div className="laboratory-test-group-header">
                      <h3>{category}</h3>
                      <button
                        className="laboratory-select-section-button"
                        type="button"
                        onClick={() =>
                          toggleReceivedCategory(tests)
                        }
                      >
                        {
                          areAllReceivedTestsSelected(tests)
                            ? 'Quitar todo'
                            : 'Seleccionar todo'
                        }
                      </button>
                    </div>
                    <div className="laboratory-test-options">
                      {tests.map((test) => (
                        <label
                          className="checkbox-row"
                          key={getLaboratoryTestIdentifier(test)}
                        >
                          <input
                            type="checkbox"
                            checked={receivedTestIds.includes(
                              getLaboratoryTestIdentifier(test)
                            )}
                            onChange={() =>
                              toggleReceivedTest(
                                getLaboratoryTestIdentifier(test)
                              )
                            }
                          />
                          {test.name}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <p className="form-note">
                Cuando todas las practicas pedidas esten tildadas, el estudio queda completo y pendiente para retirar.
              </p>

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
                  {loading ? 'Guardando...' : 'Guardar resultados'}
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
              Este estudio todavia tiene resultados pendientes.
            </p>

            <p className="auth-error">
              Recibidos {pickupRecord.received_tests_count || 0} de {pickupRecord.requested_tests_count || 0}
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
