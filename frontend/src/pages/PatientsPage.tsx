import {
  useEffect,
  useState
} from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import PageTitle from '../components/PageTitle';
import { formatDisplayDate } from '../utils/dateFormat';
import './PatientsPage.css';

type Patient = {
  id: number;
  document_type: string | null;
  document_number: string;
  last_name: string;
  first_name: string;
  phone: string | null;
  email: string | null;
  health_insurance: string | null;
  affiliate_number: string | null;
  birth_date: string | null;
  address: string | null;
  laboratory_count: number;
  sent_count: number;
  partial_count: number;
  complete_count: number;
  picked_up_count: number;
};

type Lab = {
  id: number;
  study_date: string;
  status: string;
  has_blood_extraction: number;
  has_urine_sample: number;
  missing_details: string | null;
  pickup_date: string | null;
};

type ImportSummary = {
  total_rows: number;
  valid_rows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
};

type ImportRow = {
  row: number;
  action: 'crear' | 'actualizar' | 'sin_cambios' | 'omitir';
  document_number: string;
  last_name: string;
  first_name: string;
  phone: string | null;
  email: string | null;
  health_insurance: string | null;
  completed_fields: string[];
  reason?: string;
};

const emptyForm = {
  document_type: 'DNI',
  document_number: '',
  last_name: '',
  first_name: '',
  phone: '',
  email: '',
  health_insurance: '',
  affiliate_number: '',
  birth_date: '',
  address: ''
};

const fieldLabels: Record<string, string> = {
  document_type: 'Tipo documento',
  phone: 'Telefono',
  email: 'Mail',
  health_insurance: 'Obra social',
  affiliate_number: 'Nro afiliado',
  birth_date: 'Nacimiento',
  address: 'Domicilio'
};

function showSystemAlert(
  message: string,
  title = 'Pacientes',
  type: 'info' | 'success' | 'error' = 'info'
) {
  window.dispatchEvent(
    new CustomEvent('system-alert', {
      detail: {
        title,
        message,
        type
      }
    })
  );
}

function badgeClass(status: string) {
  if (status === 'enviado') {
    return 'badge badge-danger';
  }

  if (status === 'parcial') {
    return 'badge badge-warning';
  }

  if (status === 'retirado') {
    return 'badge badge-info';
  }

  if (status === 'completo') {
    return 'badge badge-success';
  }

  return 'badge';
}

function actionLabel(action: ImportRow['action']) {
  if (action === 'crear') {
    return 'Nuevo';
  }

  if (action === 'actualizar') {
    return 'Completar';
  }

  if (action === 'sin_cambios') {
    return 'Sin cambios';
  }

  return 'Omitir';
}

function actionBadge(action: ImportRow['action']) {
  if (action === 'crear') {
    return 'badge badge-success';
  }

  if (action === 'actualizar') {
    return 'badge badge-warning';
  }

  if (action === 'sin_cambios') {
    return 'badge badge-info';
  }

  return 'badge badge-danger';
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      const result =
        String(reader.result || '');

      resolve(result.split(',').pop() || '');
    };

    reader.onerror = () =>
      reject(reader.error);

    reader.readAsDataURL(file);
  });
}

export default function PatientsPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'patients.manage',
      ['admin', 'dir', 'lab']
    );

  const canImport =
    user?.role === 'admin' ||
    user?.role === 'dir';

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [search, setSearch] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [pages, setPages] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [selected, setSelected] =
    useState<any>(null);

  const [editing, setEditing] =
    useState<Patient | null>(null);

  const [form, setForm] =
    useState<any>(emptyForm);

  const [open, setOpen] =
    useState(false);

  const [importOpen, setImportOpen] =
    useState(false);

  const [importFileName, setImportFileName] =
    useState('');

  const [importFileBase64, setImportFileBase64] =
    useState('');

  const [importSummary, setImportSummary] =
    useState<ImportSummary | null>(null);

  const [importRows, setImportRows] =
    useState<ImportRow[]>([]);

  const [loadingImport, setLoadingImport] =
    useState(false);

  async function load() {
    const response =
      await apiFetch(
        `/patients?search=${encodeURIComponent(search)}&page=${page}&per_page=25`
      );

    setPatients(response.data);
    setPages(response.pagination.total_pages);
    setTotal(response.pagination.total);
  }

  useEffect(() => {
    void load();
  }, [page, search]);

  async function detail(id: number) {
    const response =
      await apiFetch(`/patients/${id}`);

    setSelected(response.data);
  }

  function showForm(patient?: Patient) {
    setEditing(patient || null);
    setForm(
      patient
        ? {
          document_type: patient.document_type || 'DNI',
          document_number: patient.document_number || '',
          last_name: patient.last_name || '',
          first_name: patient.first_name || '',
          phone: patient.phone || '',
          email: patient.email || '',
          health_insurance: patient.health_insurance || '',
          affiliate_number: patient.affiliate_number || '',
          birth_date: patient.birth_date?.slice(0, 10) || '',
          address: patient.address || ''
        }
        : emptyForm
    );
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    await apiFetch(
      editing
        ? `/patients/${editing.id}`
        : '/patients',
      {
        method:
          editing
            ? 'PUT'
            : 'POST',
        body:
          JSON.stringify(form)
      }
    );

    setOpen(false);
    await load();

    if (editing) {
      await detail(editing.id);
    }
  }

  function resetImport() {
    setImportFileName('');
    setImportFileBase64('');
    setImportSummary(null);
    setImportRows([]);
  }

  async function handleImportFile(file?: File | null) {
    if (!file) {
      resetImport();
      return;
    }

    setLoadingImport(true);
    setImportFileName(file.name);
    setImportSummary(null);
    setImportRows([]);

    try {
      const fileBase64 =
        await readFileAsBase64(file);

      const response =
        await apiFetch(
          '/patients/import/preview',
          {
            method: 'POST',
            body: JSON.stringify({
              file_name: file.name,
              file_base64: fileBase64
            })
          }
        );

      setImportFileBase64(fileBase64);
      setImportSummary(response.data.summary);
      setImportRows(response.data.rows);
    } catch (error: any) {
      resetImport();
      showSystemAlert(error.message);
    } finally {
      setLoadingImport(false);
    }
  }

  async function applyImport() {
    if (!importFileBase64) {
      showSystemAlert('Debe seleccionar un archivo XLS');
      return;
    }

    setLoadingImport(true);

    try {
      const response =
        await apiFetch(
          '/patients/import/apply',
          {
            method: 'POST',
            body: JSON.stringify({
              file_name: importFileName,
              file_base64: importFileBase64
            })
          }
        );

      setImportSummary(response.data.summary);
      setImportRows(response.data.rows);
      showSystemAlert(
        response.message || 'Importacion finalizada correctamente',
        'Pacientes',
        'success'
      );
      setImportOpen(false);
      resetImport();
      await load();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoadingImport(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <PageTitle icon="pacientes">
            Pacientes
          </PageTitle>
          <p className="page-subtitle">
            Datos personales e historial de atenciones.
          </p>
        </div>

        <div className="table-actions">
          {canImport && (
            <button
              className="btn-secondary"
              onClick={() => {
                resetImport();
                setImportOpen(true);
              }}
              type="button"
            >
              Importar pacientes
            </button>
          )}

          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => showForm()}
              type="button"
            >
              + Nuevo paciente
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Total</h3>
          <p>{total}</p>
          <span>Pacientes registrados</span>
        </div>
      </div>

      <div className="filter-bar patients-filter-bar">
        <input
          className="form-input patients-search-filter"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por apellido, nombre, DNI, telefono o mail"
          value={search}
        />
      </div>

      <p className="results-summary">
        Mostrando {patients.length} de {total} pacientes
      </p>

      <div className="pagination-bar">
        <span>Pagina {page} de {pages}</span>
        <div className="table-actions">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            type="button"
          >
            Anterior
          </button>
          <button
            className="btn-secondary"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Documento</th>
              <th>Telefono</th>
              <th>Mail</th>
              <th>Obra social</th>
              <th>Domicilio</th>
              <th>Laboratorios</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.last_name} {patient.first_name}</td>
                <td>
                  {[patient.document_type, patient.document_number]
                    .filter(Boolean)
                    .join(' ')}
                </td>
                <td>{patient.phone || '-'}</td>
                <td>{patient.email || '-'}</td>
                <td>{patient.health_insurance || '-'}</td>
                <td>{patient.address || '-'}</td>
                <td>
                  <span className="badge badge-info">
                    {Number(patient.laboratory_count || 0)}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <IconButton
                      icon="eye"
                      label="Ver ficha"
                      onClick={() => detail(patient.id)}
                      variant="secondary"
                    />
                    {canEdit && (
                      <IconButton
                        icon="edit"
                        label="Editar paciente"
                        onClick={() => showForm(patient)}
                        variant="primary"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!patients.length && (
              <tr>
                <td colSpan={8}>
                  No hay pacientes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span>Pagina {page} de {pages}</span>
        <div className="table-actions">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            type="button"
          >
            Anterior
          </button>
          <button
            className="btn-secondary"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide patient-detail">
            <IconButton
              className="modal-close-button"
              icon="close"
              label="Cerrar ficha"
              onClick={() => setSelected(null)}
            />
            <h2 className="modal-title">
              {selected.patient.last_name} {selected.patient.first_name}
            </h2>
            <p className="modal-subtitle">
              {[selected.patient.document_type, selected.patient.document_number]
                .filter(Boolean)
                .join(' ')} · Tel. {selected.patient.phone || '-'} · Nacimiento {formatDisplayDate(selected.patient.birth_date)}
            </p>

            <div className="patient-profile-grid">
              <div>
                <span>Mail</span>
                <strong>{selected.patient.email || '-'}</strong>
              </div>
              <div>
                <span>Obra social</span>
                <strong>{selected.patient.health_insurance || '-'}</strong>
              </div>
              <div>
                <span>Nro afiliado</span>
                <strong>{selected.patient.affiliate_number || '-'}</strong>
              </div>
              <div>
                <span>Domicilio</span>
                <strong>{selected.patient.address || '-'}</strong>
              </div>
            </div>

            <div className="dashboard-grid patient-detail-grid">
              {[
                ['Total', selected.patient.laboratory_count, 'Laboratorios registrados'],
                ['Enviados', selected.patient.sent_count, 'Esperando resultados'],
                ['Parciales', selected.patient.partial_count, 'Resultados incompletos'],
                ['Completos', selected.patient.complete_count, 'Resultados completos'],
                ['Retirados', selected.patient.picked_up_count, 'Estudios entregados']
              ].map((item) => (
                <div
                  className="dashboard-card"
                  key={item[0]}
                >
                  <h3>{item[0]}</h3>
                  <p>{Number(item[1] || 0)}</p>
                  <span>{item[2]}</span>
                </div>
              ))}
            </div>

            <h3>Historial de laboratorios</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Muestras</th>
                    <th>Pendiente</th>
                    <th>Retiro</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.laboratories.map((lab: Lab) => (
                    <tr key={lab.id}>
                      <td>{formatDisplayDate(lab.study_date)}</td>
                      <td>
                        <span className={badgeClass(lab.status)}>
                          {lab.status}
                        </span>
                      </td>
                      <td>
                        {[
                          lab.has_blood_extraction ? 'Extraccion' : '',
                          lab.has_urine_sample ? 'Orina' : ''
                        ].filter(Boolean).join(' + ')}
                      </td>
                      <td>{lab.missing_details || '-'}</td>
                      <td>{formatDisplayDate(lab.pickup_date)}</td>
                    </tr>
                  ))}
                  {!selected.laboratories.length && (
                    <tr>
                      <td colSpan={5}>
                        Todavia no tiene laboratorios registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-overlay">
          <form
            className="modal-content modal-content-wide"
            onSubmit={save}
          >
            <IconButton
              className="modal-close-button"
              icon="close"
              label="Cerrar formulario"
              onClick={() => setOpen(false)}
            />
            <h2 className="modal-title">
              {editing ? 'Modificar paciente' : 'Nuevo paciente'}
            </h2>
            <p className="modal-subtitle">
              Completa los datos personales del paciente.
            </p>

            <div className="form-grid">
              <label>
                Tipo documento
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      document_type: event.target.value
                    })
                  }
                  value={form.document_type}
                />
              </label>
              <label>
                DNI
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      document_number: event.target.value
                    })
                  }
                  required
                  value={form.document_number}
                />
              </label>
              <label>
                Apellido
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      last_name: event.target.value.toLocaleUpperCase('es-AR')
                    })
                  }
                  required
                  value={form.last_name}
                />
              </label>
              <label>
                Nombre
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      first_name: event.target.value.toLocaleUpperCase('es-AR')
                    })
                  }
                  required
                  value={form.first_name}
                />
              </label>
              <label>
                Telefono
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value
                    })
                  }
                  value={form.phone}
                />
              </label>
              <label>
                Mail
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value
                    })
                  }
                  type="email"
                  value={form.email}
                />
              </label>
              <label>
                Fecha de nacimiento
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      birth_date: event.target.value
                    })
                  }
                  type="date"
                  value={form.birth_date}
                />
              </label>
              <label>
                Obra social/Prepaga
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      health_insurance: event.target.value.toLocaleUpperCase('es-AR')
                    })
                  }
                  value={form.health_insurance}
                />
              </label>
              <label>
                Nro de afiliado
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      affiliate_number: event.target.value.toLocaleUpperCase('es-AR')
                    })
                  }
                  value={form.affiliate_number}
                />
              </label>
              <label>
                Domicilio
                <input
                  className="form-input"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      address: event.target.value.toLocaleUpperCase('es-AR')
                    })
                  }
                  value={form.address}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                type="submit"
              >
                Guardar paciente
              </button>
            </div>
          </form>
        </div>
      )}

      {importOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <IconButton
              className="modal-close-button"
              icon="close"
              label="Cerrar importacion"
              onClick={() => {
                setImportOpen(false);
                resetImport();
              }}
            />
            <h2 className="modal-title">
              Importar pacientes
            </h2>
            <p className="modal-subtitle">
              Selecciona el XLS de Detalle Nominal de Turnos para revisar antes de guardar.
            </p>

            <label className="form-field">
              Archivo XLS
              <div className="patient-file-picker">
                <input
                  accept=".xls"
                  disabled={loadingImport}
                  id="patient-import-file"
                  onChange={(event) =>
                    handleImportFile(event.target.files?.[0])
                  }
                  type="file"
                />
                <label
                  className="btn-secondary patient-file-button"
                  htmlFor="patient-import-file"
                >
                  Seleccionar archivo
                </label>
                <span className="patient-file-name">
                  {importFileName || 'Ningun archivo seleccionado'}
                </span>
              </div>
            </label>

            {loadingImport && (
              <p className="results-summary">
                Analizando archivo...
              </p>
            )}

            {importSummary && (
              <>
                <div className="dashboard-grid patient-import-summary">
                  <div className="dashboard-card">
                    <h3>Validos</h3>
                    <p>{importSummary.valid_rows}</p>
                    <span>Filas listas para importar</span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Nuevos</h3>
                    <p>{importSummary.created}</p>
                    <span>Pacientes a crear</span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Completar</h3>
                    <p>{importSummary.updated}</p>
                    <span>Pacientes existentes</span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Omitidos</h3>
                    <p>{importSummary.skipped}</p>
                    <span>Filas con datos incompletos</span>
                  </div>
                </div>

                <div className="table-container patient-import-preview">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Accion</th>
                        <th>Paciente</th>
                        <th>DNI</th>
                        <th>Telefono</th>
                        <th>Mail</th>
                        <th>Datos a modificar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr key={`${row.row}-${row.document_number}`}>
                          <td>{row.row}</td>
                          <td>
                            <span className={actionBadge(row.action)}>
                              {actionLabel(row.action)}
                            </span>
                          </td>
                          <td>{row.last_name} {row.first_name}</td>
                          <td>{row.document_number || '-'}</td>
                          <td>{row.phone || '-'}</td>
                          <td>{row.email || '-'}</td>
                          <td>
                            {row.reason ||
                              row.completed_fields
                                .map((field) => fieldLabels[field] || field)
                                .join(', ') ||
                              '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setImportOpen(false);
                  resetImport();
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn-success"
                disabled={
                  loadingImport ||
                  !importSummary ||
                  (
                    importSummary.created === 0 &&
                    importSummary.updated === 0
                  )
                }
                onClick={applyImport}
                type="button"
              >
                Confirmar importacion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
