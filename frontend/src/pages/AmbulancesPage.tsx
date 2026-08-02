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

type AmbulanceType = {
  id: number;
  name: string;
  is_active: boolean;
};

type Ambulance = {
  id: number;
  internal_code: string;
  plate: string;
  brand: string | null;
  model: string | null;
  ambulance_type_id: number | null;
  type: string;
  type_name: string;
  status: string;
  is_active: boolean;
  maintenance_alert_count: number;
  next_maintenance_date: string | null;
  next_maintenance_type: string | null;
};

type MaintenanceRecord = {
  id: number;
  maintenance_type: string;
  start_date: string;
  end_date: string | null;
  odometer_km: number | null;
  workshop_name: string | null;
  description: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
  status: string;
  notes: string | null;
  created_by_name: string | null;
};

type MaintenanceFilters = {
  search: string;
  type: string;
  status: string;
  date_from: string;
  date_to: string;
};

const statusLabels: Record<string, string> = {
  disponible: 'Disponible',
  en_viaje: 'En viaje',
  mantenimiento: 'Mantenimiento'
};

const statusClasses: Record<string, string> = {
  disponible: 'badge badge-success',
  en_viaje: 'badge badge-warning',
  mantenimiento: 'badge badge-danger'
};

const maintenanceTypeLabels: Record<string, string> = {
  service: 'Service',
  mecanica: 'Mecanica',
  cubiertas: 'Cubiertas',
  aceite: 'Aceite',
  frenos: 'Frenos',
  electricidad: 'Electricidad',
  limpieza: 'Limpieza',
  verificacion: 'Verificacion',
  otro: 'Otro'
};

const maintenanceStatusLabels: Record<string, string> = {
  programado: 'Programado',
  en_reparacion: 'En reparacion',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado'
};

const pageSize =
  10;

const maintenancePageSize =
  5;

function emptyAmbulanceForm(
  typeId = ''
) {
  return {
    internal_code: '',
    plate: '',
    brand: '',
    model: '',
    ambulance_type_id: typeId,
    status: 'disponible'
  };
}

const emptyTypeForm = {
  name: ''
};

const emptyMaintenanceForm = {
  maintenance_type: 'service',
  start_date: '',
  end_date: '',
  odometer_km: '',
  workshop_name: '',
  description: '',
  next_service_date: '',
  next_service_km: '',
  status: 'programado',
  notes: ''
};

const emptyMaintenanceFilters: MaintenanceFilters = {
  search: '',
  type: '',
  status: '',
  date_from: '',
  date_to: ''
};

function parseDateOnly(
  value: string | null
) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

function isPastDate(
  value: string | null
) {
  const date =
    parseDateOnly(value);

  if (!date) {
    return false;
  }

  const today =
    new Date();

  today.setHours(0, 0, 0, 0);

  return date < today;
}

function maintenanceAlertClass(
  ambulance: Ambulance
) {
  if (!ambulance.maintenance_alert_count) {
    return 'badge badge-info';
  }

  return isPastDate(ambulance.next_maintenance_date)
    ? 'badge badge-danger'
    : 'badge badge-warning';
}

function maintenanceAlertText(
  ambulance: Ambulance
) {
  if (!ambulance.maintenance_alert_count) {
    return 'Sin alertas';
  }

  const typeLabel =
    ambulance.next_maintenance_type
      ? maintenanceTypeLabels[ambulance.next_maintenance_type] ||
        ambulance.next_maintenance_type
      : 'Control';

  const dateText =
    ambulance.next_maintenance_date
      ? formatDisplayDate(ambulance.next_maintenance_date)
      : 'sin fecha';

  const extraCount =
    ambulance.maintenance_alert_count > 1
      ? ` +${ambulance.maintenance_alert_count - 1}`
      : '';

  return `${typeLabel} ${dateText}${extraCount}`;
}

export default function AmbulancesPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'transfers.manage',
      ['admin', 'user']
    );

  const [ambulances, setAmbulances] =
    useState<Ambulance[]>([]);

  const [types, setTypes] =
    useState<AmbulanceType[]>([]);

  const [form, setForm] =
    useState(emptyAmbulanceForm());

  const [editing, setEditing] =
    useState<Ambulance | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [showTypesModal, setShowTypesModal] =
    useState(false);

  const [typeForm, setTypeForm] =
    useState(emptyTypeForm);

  const [editingType, setEditingType] =
    useState<AmbulanceType | null>(null);

  const [maintenanceAmbulance, setMaintenanceAmbulance] =
    useState<Ambulance | null>(null);

  const [maintenanceRecords, setMaintenanceRecords] =
    useState<MaintenanceRecord[]>([]);

  const [maintenanceForm, setMaintenanceForm] =
    useState(emptyMaintenanceForm);

  const [showMaintenanceForm, setShowMaintenanceForm] =
    useState(false);

  const [editingMaintenance, setEditingMaintenance] =
    useState<MaintenanceRecord | null>(null);

  const [maintenanceFilters, setMaintenanceFilters] =
    useState<MaintenanceFilters>(
      emptyMaintenanceFilters
    );

  const [maintenancePage, setMaintenancePage] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [page, setPage] =
    useState(1);

  const [error, setError] =
    useState('');

  function defaultTypeId(
    list = types
  ) {
    return String(
      list.find((type) => type.is_active)?.id ||
      list[0]?.id ||
      ''
    );
  }

  async function loadData() {
    try {
      const [
        ambulancesRes,
        typesRes
      ] = await Promise.all([
        apiFetch('/ambulances'),
        apiFetch('/ambulances/types')
      ]);

      setAmbulances(ambulancesRes.data);
      setTypes(typesRes.data);
      setPage(1);

      setForm((current) => ({
        ...current,
        ambulance_type_id:
          current.ambulance_type_id ||
          defaultTypeId(typesRes.data)
      }));
    } catch (error: any) {
      setError(error.message);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyAmbulanceForm(defaultTypeId()));
    setError('');
    setShowForm(true);
  }

  function openEdit(
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
      ambulance_type_id:
        String(ambulance.ambulance_type_id || ''),
      status:
        ambulance.status
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyAmbulanceForm(defaultTypeId()));
    setShowForm(false);
    setError('');
  }

  async function saveAmbulance(
    event: React.FormEvent
  ) {
    event.preventDefault();
    setError('');

    try {
      setLoading(true);

      await apiFetch(
        editing
          ? `/ambulances/${editing.id}`
          : '/ambulances',
        {
          method:
            editing ? 'PUT' : 'POST',
          body:
            JSON.stringify({
              ...form,
              ambulance_type_id:
                Number(form.ambulance_type_id)
            })
        }
      );

      closeForm();
      await loadData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAmbulance(
    id: number
  ) {
    try {
      await apiFetch(
        `/ambulances/${id}/status`,
        { method: 'PATCH' }
      );

      await loadData();
    } catch (error: any) {
      setError(error.message);
    }
  }

  function openCreateType() {
    setEditingType(null);
    setTypeForm(emptyTypeForm);
  }

  function openEditType(
    type: AmbulanceType
  ) {
    setEditingType(type);
    setTypeForm({
      name: type.name
    });
  }

  async function saveType(
    event: React.FormEvent
  ) {
    event.preventDefault();
    setError('');

    try {
      setLoading(true);

      await apiFetch(
        editingType
          ? `/ambulances/types/${editingType.id}`
          : '/ambulances/types',
        {
          method:
            editingType ? 'PUT' : 'POST',
          body:
            JSON.stringify(typeForm)
        }
      );

      openCreateType();
      await loadData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleType(
    id: number
  ) {
    try {
      await apiFetch(
        `/ambulances/types/${id}/status`,
        { method: 'PATCH' }
      );

      await loadData();
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function openMaintenance(
    ambulance: Ambulance
  ) {
    setMaintenanceAmbulance(ambulance);
    setMaintenanceForm(emptyMaintenanceForm);
    setEditingMaintenance(null);
    setShowMaintenanceForm(false);
    setMaintenanceFilters(emptyMaintenanceFilters);
    setMaintenancePage(1);
    setError('');

    try {
      const res =
        await apiFetch(
          `/ambulances/${ambulance.id}/maintenance`
        );

      setMaintenanceRecords(res.data);
    } catch (error: any) {
      setError(error.message);
    }
  }

  function openCreateMaintenance() {
    setEditingMaintenance(null);
    setMaintenanceForm(emptyMaintenanceForm);
    setError('');
    setShowMaintenanceForm(true);
  }

  function editMaintenance(
    record: MaintenanceRecord
  ) {
    setEditingMaintenance(record);
    setMaintenanceForm({
      maintenance_type:
        record.maintenance_type,
      start_date:
        record.start_date || '',
      end_date:
        record.end_date || '',
      odometer_km:
        record.odometer_km
          ? String(record.odometer_km)
          : '',
      workshop_name:
        record.workshop_name || '',
      description:
        record.description || '',
      next_service_date:
        record.next_service_date || '',
      next_service_km:
        record.next_service_km
          ? String(record.next_service_km)
          : '',
      status:
        record.status,
      notes:
        record.notes || ''
    });
    setError('');
    setShowMaintenanceForm(true);
  }

  function closeMaintenanceForm() {
    setEditingMaintenance(null);
    setMaintenanceForm(emptyMaintenanceForm);
    setShowMaintenanceForm(false);
    setError('');
  }

  async function saveMaintenance(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!maintenanceAmbulance) {
      return;
    }

    setError('');

    try {
      setLoading(true);

      const body = {
        ...maintenanceForm,
        odometer_km:
          maintenanceForm.odometer_km
            ? Number(maintenanceForm.odometer_km)
            : null,
        next_service_km:
          maintenanceForm.next_service_km
            ? Number(maintenanceForm.next_service_km)
            : null
      };

      await apiFetch(
        editingMaintenance
          ? `/ambulances/${maintenanceAmbulance.id}/maintenance/${editingMaintenance.id}`
          : `/ambulances/${maintenanceAmbulance.id}/maintenance`,
        {
          method:
            editingMaintenance ? 'PUT' : 'POST',
          body:
            JSON.stringify(body)
        }
      );

      closeMaintenanceForm();
      await openMaintenance(maintenanceAmbulance);
      await loadData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const sortedAmbulances =
    useMemo(
      () =>
        [...ambulances].sort((left, right) =>
          left.internal_code.localeCompare(
            right.internal_code,
            'es'
          )
        ),
      [ambulances]
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(sortedAmbulances.length / pageSize)
    );

  const safePage =
    Math.min(page, totalPages);

  const paginatedAmbulances =
    sortedAmbulances.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
    );

  const filteredMaintenanceRecords =
    useMemo(
      () =>
        maintenanceRecords.filter((record) => {
          const search =
            maintenanceFilters.search
              .trim()
              .toLowerCase();

          const recordDate =
            record.start_date || '';

          const matchesSearch =
            !search ||
            [
              maintenanceTypeLabels[record.maintenance_type],
              maintenanceStatusLabels[record.status],
              record.workshop_name,
              record.description,
              record.notes
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(search)
              );

          const matchesType =
            !maintenanceFilters.type ||
            record.maintenance_type === maintenanceFilters.type;

          const matchesStatus =
            !maintenanceFilters.status ||
            record.status === maintenanceFilters.status;

          const matchesFrom =
            !maintenanceFilters.date_from ||
            recordDate >= maintenanceFilters.date_from;

          const matchesTo =
            !maintenanceFilters.date_to ||
            recordDate <= maintenanceFilters.date_to;

          return (
            matchesSearch &&
            matchesType &&
            matchesStatus &&
            matchesFrom &&
            matchesTo
          );
        }),
      [maintenanceRecords, maintenanceFilters]
    );

  const maintenanceTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredMaintenanceRecords.length /
        maintenancePageSize
      )
    );

  const safeMaintenancePage =
    Math.min(
      maintenancePage,
      maintenanceTotalPages
    );

  const paginatedMaintenanceRecords =
    filteredMaintenanceRecords.slice(
      (safeMaintenancePage - 1) *
        maintenancePageSize,
      safeMaintenancePage *
        maintenancePageSize
    );

  function updateMaintenanceFilter(
    key: keyof MaintenanceFilters,
    value: string
  ) {
    setMaintenanceFilters((current) => ({
      ...current,
      [key]: value
    }));
    setMaintenancePage(1);
  }

  function printMaintenanceHistory() {
    if (!maintenanceAmbulance) {
      return;
    }

    const rows =
      filteredMaintenanceRecords.map((record) => `
        <tr>
          <td>${formatDisplayDate(record.start_date)}</td>
          <td>${record.end_date ? formatDisplayDate(record.end_date) : '-'}</td>
          <td>${maintenanceTypeLabels[record.maintenance_type] || record.maintenance_type}</td>
          <td>${maintenanceStatusLabels[record.status] || record.status}</td>
          <td>${record.workshop_name || '-'}</td>
          <td>${record.odometer_km ? `${record.odometer_km} km` : '-'}</td>
          <td>${record.description || '-'}</td>
          <td>${record.next_service_date ? formatDisplayDate(record.next_service_date) : '-'}</td>
          <td>${record.next_service_km ? `${record.next_service_km} km` : '-'}</td>
          <td>${record.notes || '-'}</td>
        </tr>
      `).join('');

    const printWindow =
      window.open('', '_blank');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Historial de mantenimiento</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            .print-header { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #0f766e; }
            .print-logo { display: block; width: 145px; max-height: 58px; object-fit: contain; object-position: left center; }
            .print-header-text { flex: 1; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            p { margin: 0; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img
              class="print-logo"
              src="${window.location.origin}/menu-icons/sigsa-logo.png"
              alt="SIGSA"
            />
            <div class="print-header-text">
              <h1>Historial de mantenimiento</h1>
              <p>
                ${maintenanceAmbulance.internal_code} - ${maintenanceAmbulance.plate}
                - ${maintenanceAmbulance.type_name || maintenanceAmbulance.type}
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Taller</th>
                <th>Km</th>
                <th>Detalle</th>
                <th>Proximo</th>
                <th>Prox. km</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="10">Sin registros para imprimir.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div>
      <TransfersHeader
        title="Ambulancias"
        description="Administra las unidades disponibles, sus patentes, tipos y estado operativo."
        actions={
          canEdit ? (
            <div className="table-actions">
              <button
                className="btn-primary"
                onClick={openCreate}
                type="button"
              >
                + Nueva ambulancia
              </button>
            </div>
          ) : null
        }
      />

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver las ambulancias sin modificar datos.
        </p>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <p className="results-summary">
        Mostrando {paginatedAmbulances.length} de {sortedAmbulances.length} ambulancias
      </p>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Patente</th>
              <th>Unidad</th>
              <th>
                <div className="table-heading-action">
                  <span>Tipo</span>
                  {canEdit && (
                    <button
                      aria-label="Administrar tipos de ambulancia"
                      className="table-heading-add-button"
                      onClick={() => {
                        openCreateType();
                        setShowTypesModal(true);
                      }}
                      title="Administrar tipos"
                      type="button"
                    >
                      +
                    </button>
                  )}
                </div>
              </th>
              <th>Estado</th>
              <th>Mantenimiento</th>
              <th>Activo</th>
              {canEdit && (
                <th>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedAmbulances.map((ambulance) => (
              <tr key={ambulance.id}>
                <td>{ambulance.internal_code}</td>
                <td>{ambulance.plate}</td>
                <td>
                  {[ambulance.brand, ambulance.model]
                    .filter(Boolean)
                    .join(' ') || '-'}
                </td>
                <td>{ambulance.type_name || ambulance.type}</td>
                <td>
                  <span className={statusClasses[ambulance.status] || 'badge badge-info'}>
                    {statusLabels[ambulance.status] || ambulance.status}
                  </span>
                </td>
                <td>
                  <span className={maintenanceAlertClass(ambulance)}>
                    {maintenanceAlertText(ambulance)}
                  </span>
                </td>
                <td>
                  {ambulance.is_active ? 'Si' : 'No'}
                </td>
                {canEdit && (
                  <td>
                    <div className="table-actions">
                      <IconButton
                        icon="eye"
                        label="Ver mantenimiento"
                        onClick={() =>
                          openMaintenance(ambulance)
                        }
                        variant="secondary"
                      />
                      <IconButton
                        icon="edit"
                        label="Editar ambulancia"
                        onClick={() =>
                          openEdit(ambulance)
                        }
                        variant="primary"
                      />
                      <IconButton
                        icon={ambulance.is_active ? 'lock' : 'unlock'}
                        label={ambulance.is_active ? 'Desactivar ambulancia' : 'Activar ambulancia'}
                        onClick={() =>
                          toggleAmbulance(ambulance.id)
                        }
                        variant={
                          ambulance.is_active
                            ? 'danger'
                            : 'success'
                        }
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {paginatedAmbulances.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7}>
                  No hay ambulancias cargadas.
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
              {editing ? 'Editar ambulancia' : 'Nueva ambulancia'}
            </h2>

            <form
              className="auth-form"
              onSubmit={saveAmbulance}
            >
              <input
                className="form-input"
                name="internal_code"
                placeholder="Codigo interno"
                value={form.internal_code}
                onChange={(event) =>
                  setForm({
                    ...form,
                    internal_code:
                      event.target.value
                  })
                }
                required
              />

              <input
                className="form-input"
                name="plate"
                placeholder="Patente"
                value={form.plate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    plate:
                      event.target.value
                  })
                }
                required
              />

              <input
                className="form-input"
                name="brand"
                placeholder="Marca"
                value={form.brand}
                onChange={(event) =>
                  setForm({
                    ...form,
                    brand:
                      event.target.value
                  })
                }
              />

              <input
                className="form-input"
                name="model"
                placeholder="Modelo"
                value={form.model}
                onChange={(event) =>
                  setForm({
                    ...form,
                    model:
                      event.target.value
                  })
                }
              />

              <select
                className="form-input"
                value={form.ambulance_type_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    ambulance_type_id:
                      event.target.value
                  })
                }
                required
              >
                <option value="">Seleccionar tipo</option>
                {types
                  .filter((type) =>
                    type.is_active ||
                    String(type.id) === form.ambulance_type_id
                  )
                  .map((type) => (
                    <option
                      key={type.id}
                      value={type.id}
                    >
                      {type.name}
                    </option>
                  ))}
              </select>

              <select
                className="form-input"
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status:
                      event.target.value
                  })
                }
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

      {showTypesModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              aria-label="Cerrar"
              className="modal-close-button"
              onClick={() =>
                setShowTypesModal(false)
              }
              type="button"
            >
              x
            </button>
            <h2 className="modal-title">
              Tipos de ambulancia
            </h2>

            <form
              className="management-form"
              onSubmit={saveType}
            >
              <input
                className="form-input"
                placeholder="Nombre del tipo"
                value={typeForm.name}
                onChange={(event) =>
                  setTypeForm({
                    name:
                      event.target.value
                  })
                }
                required
              />

              <div className="management-actions">
                <button
                  className="btn-success"
                  disabled={loading}
                  type="submit"
                >
                  {editingType ? 'Guardar' : 'Agregar'}
                </button>
                {editingType && (
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={openCreateType}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Activo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id}>
                      <td>{type.name}</td>
                      <td>{type.is_active ? 'Si' : 'No'}</td>
                      <td>
                        <div className="table-actions">
                          <IconButton
                            icon="edit"
                            label="Editar tipo"
                            onClick={() =>
                              openEditType(type)
                            }
                            variant="primary"
                          />
                          <IconButton
                            icon={type.is_active ? 'lock' : 'unlock'}
                            label={type.is_active ? 'Desactivar tipo' : 'Activar tipo'}
                            onClick={() =>
                              toggleType(type.id)
                            }
                            variant={
                              type.is_active
                                ? 'danger'
                                : 'success'
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {maintenanceAmbulance && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              aria-label="Cerrar"
              className="modal-close-button"
              onClick={() => {
                setMaintenanceAmbulance(null);
                closeMaintenanceForm();
              }}
              type="button"
            >
              x
            </button>
            <h2 className="modal-title">
              Historial de mantenimiento
            </h2>
            <p className="modal-subtitle">
              {maintenanceAmbulance.plate} · {maintenanceAmbulance.type_name || maintenanceAmbulance.type}
            </p>

            <div className="modal-toolbar">
              <div className="table-actions">
                <button
                  className="btn-secondary"
                  onClick={printMaintenanceHistory}
                  type="button"
                >
                  Imprimir
                </button>
                {canEdit && (
                  <button
                    className="btn-primary"
                    onClick={openCreateMaintenance}
                    type="button"
                  >
                    + Nuevo
                  </button>
                )}
              </div>
            </div>

            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Buscar por taller, detalle u observacion"
                value={maintenanceFilters.search}
                onChange={(event) =>
                  updateMaintenanceFilter(
                    'search',
                    event.target.value
                  )
                }
              />

              <select
                className="form-input"
                value={maintenanceFilters.type}
                onChange={(event) =>
                  updateMaintenanceFilter(
                    'type',
                    event.target.value
                  )
                }
              >
                <option value="">Todos los tipos</option>
                {Object.entries(maintenanceTypeLabels)
                  .map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ))}
              </select>

              <select
                className="form-input"
                value={maintenanceFilters.status}
                onChange={(event) =>
                  updateMaintenanceFilter(
                    'status',
                    event.target.value
                  )
                }
              >
                <option value="">Todos los estados</option>
                {Object.entries(maintenanceStatusLabels)
                  .map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ))}
              </select>

              <input
                className="form-input"
                type="date"
                value={maintenanceFilters.date_from}
                onChange={(event) =>
                  updateMaintenanceFilter(
                    'date_from',
                    event.target.value
                  )
                }
              />

              <input
                className="form-input"
                type="date"
                value={maintenanceFilters.date_to}
                onChange={(event) =>
                  updateMaintenanceFilter(
                    'date_to',
                    event.target.value
                  )
                }
              />
            </div>

            <p className="results-summary">
              Mostrando {paginatedMaintenanceRecords.length} de {filteredMaintenanceRecords.length} registros
            </p>

            {showMaintenanceForm && canEdit && (
              <div className="modal-overlay">
                <div className="modal-content modal-content-wide">
                  <button
                    aria-label="Cerrar"
                    className="modal-close-button"
                    onClick={closeMaintenanceForm}
                    type="button"
                  >
                    x
                  </button>
                  <h2 className="modal-title">
                    {editingMaintenance ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}
                  </h2>
                  <p className="modal-subtitle">
                    {maintenanceAmbulance.internal_code} - {maintenanceAmbulance.plate}
                  </p>

                  <form
                className="management-form"
                onSubmit={saveMaintenance}
              >
                <select
                  className="form-input"
                  value={maintenanceForm.maintenance_type}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      maintenance_type:
                        event.target.value
                    })
                  }
                >
                  {Object.entries(maintenanceTypeLabels)
                    .map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                </select>

                <input
                  className="form-input"
                  type="date"
                  value={maintenanceForm.start_date}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      start_date:
                        event.target.value
                    })
                  }
                  required
                />

                <input
                  className="form-input"
                  type="date"
                  value={maintenanceForm.end_date}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      end_date:
                        event.target.value
                    })
                  }
                />

                <input
                  className="form-input"
                  type="number"
                  min="0"
                  placeholder="Kilometraje"
                  value={maintenanceForm.odometer_km}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      odometer_km:
                        event.target.value
                    })
                  }
                />

                <input
                  className="form-input"
                  placeholder="Taller / mecanico"
                  value={maintenanceForm.workshop_name}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      workshop_name:
                        event.target.value
                    })
                  }
                />

                <select
                  className="form-input"
                  value={maintenanceForm.status}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      status:
                        event.target.value
                    })
                  }
                >
                  {Object.entries(maintenanceStatusLabels)
                    .map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                </select>

                <textarea
                  className="form-input"
                  placeholder="Detalle del trabajo"
                  rows={2}
                  value={maintenanceForm.description}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      description:
                        event.target.value
                    })
                  }
                />

                <div className="maintenance-schedule-section">
                  <span className="maintenance-schedule-title">
                    Proximo service/control
                  </span>

                  <div className="maintenance-schedule-grid">
                    <input
                      className="form-input"
                      type="date"
                      value={maintenanceForm.next_service_date}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          next_service_date:
                            event.target.value
                        })
                      }
                    />

                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      placeholder="Proximo service km"
                      value={maintenanceForm.next_service_km}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          next_service_km:
                            event.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <textarea
                  className="form-input"
                  placeholder="Observaciones"
                  rows={2}
                  value={maintenanceForm.notes}
                  onChange={(event) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      notes:
                        event.target.value
                    })
                  }
                />

                <div className="management-actions maintenance-form-actions">
                  <button
                    className="btn-success"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={closeMaintenanceForm}
                  >
                    Cancelar
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
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Taller</th>
                    <th>Detalle</th>
                    <th>Proximo control</th>
                    {canEdit && (
                      <th>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedMaintenanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {formatDisplayDate(record.start_date)}
                        {record.end_date
                          ? ` a ${formatDisplayDate(record.end_date)}`
                          : ''}
                      </td>
                      <td>
                        {maintenanceTypeLabels[record.maintenance_type] || record.maintenance_type}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {maintenanceStatusLabels[record.status] || record.status}
                        </span>
                      </td>
                      <td>{record.workshop_name || '-'}</td>
                      <td>{record.description || '-'}</td>
                      <td>
                        <div className="maintenance-next-cell">
                          <strong>
                            {record.next_service_date
                              ? formatDisplayDate(record.next_service_date)
                              : 'Sin fecha'}
                          </strong>
                          <span>
                            {record.next_service_km
                              ? `${record.next_service_km} km`
                              : 'Sin kilometraje'}
                          </span>
                        </div>
                      </td>
                      {canEdit && (
                        <td>
                          <IconButton
                            icon="edit"
                            label="Editar mantenimiento"
                            onClick={() =>
                              editMaintenance(record)
                            }
                            variant="primary"
                          />
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredMaintenanceRecords.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6}>
                        No hay registros de mantenimiento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span>
                Pagina {safeMaintenancePage} de {maintenanceTotalPages}
              </span>
              <div className="table-actions">
                <button
                  className="btn-secondary"
                  disabled={safeMaintenancePage <= 1}
                  onClick={() =>
                    setMaintenancePage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  type="button"
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={safeMaintenancePage >= maintenanceTotalPages}
                  onClick={() =>
                    setMaintenancePage((value) =>
                      Math.min(
                        maintenanceTotalPages,
                        value + 1
                      )
                    )
                  }
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
