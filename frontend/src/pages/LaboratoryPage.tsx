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
import { IconButton } from '../components/IconButton';
import PageTitle from '../components/PageTitle';
import { showSystemConfirm } from '../components/SystemConfirmModal';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  todayInputValue
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
  study_date: string;
  patient_last_name: string;
  patient_first_name: string;
  patient_document: string | null;
  patient_birth_date: string | null;
  patient_phone: string | null;
  has_blood_extraction: boolean | number;
  has_urine_sample: boolean | number;
  is_complete: boolean | number;
  status: string;
  expired_previous_status: string | null;
  missing_details: string | null;
  completed_at: string | null;
  pickup_date: string | null;
  picked_up_by: string | null;
  pickup_document: string | null;
  pickup_registered_by: number | null;
  pickup_registered_by_name?: string | null;
  pickup_registered_at?: string | null;
  whatsapp_notified_at?: string | null;
  whatsapp_notified_by?: number | null;
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
  expired_records: number;
};

type LaboratoryPatient = {
  id: number;
  document_number: string;
  last_name: string;
  first_name: string;
  phone: string | null;
  birth_date: string | null;
};

type WhatsappWebStatus = {
  status: string;
  isReady: boolean;
};

const emptyForm = {
  study_date: todayInputValue(),
  patient_last_name: '',
  patient_first_name: '',
  patient_document: '',
  patient_birth_date: '',
  patient_phone: '',
  has_blood_extraction: false,
  has_urine_sample: false,
  requested_test_ids: [] as number[],
  notes: ''
};

const genericMissingDetails = [
  'Resultados pendientes',
  'Sin practicas cargadas'
];

const initialStats = {
  total_records: 0,
  blood_extractions: 0,
  urine_samples: 0,
  pending_pickups: 0,
  delivered_results: 0,
  incomplete_records: 0,
  complete_records: 0,
  sent_records: 0,
  partial_records: 0,
  expired_records: 0
};

function toDateInput(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function normalizeDocument(
  value?: string | null
) {
  return String(value || '')
    .trim()
    .replace(/[.\s-]/g, '');
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

function getMissingItems(
  details?: string | null
) {
  if (
    !details ||
    genericMissingDetails.includes(details)
  ) {
    return [];
  }

  return details
    .split(/\r?\n|;/)
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function getSampleSummary(
  record: LaboratoryRecord
) {
  const samples = [];

  if (yesNo(record.has_blood_extraction)) {
    samples.push('Extraccion');
  }

  if (yesNo(record.has_urine_sample)) {
    samples.push('Orina');
  }

  return samples.join(' / ') || '-';
}

function getStatusLabel(
  status: string,
  isComplete: boolean | number,
  pickupDate?: string | null,
  expiredPreviousStatus?: string | null
) {
  if (status === 'expirado') {
    const previousLabels: Record<string, string> = {
      enviado: 'enviado',
      parcial: 'parcial',
      completo: 'completo'
    };

    const previousStatus =
      expiredPreviousStatus ||
      (yesNo(isComplete) ? 'completo' : 'enviado');

    return {
      text: `Expirado (${previousLabels[previousStatus] || previousStatus})`,
      className: 'badge badge-warning'
    };
  }

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
    className: 'badge badge-danger'
  };
}

function escapePrintHtml(
  value: unknown
) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const laboratoryStatusLabels: Record<string, string> = {
  todos: 'Todos los estados',
  enviado: 'Enviados',
  parcial: 'Parciales',
  completo: 'Completos',
  retirado: 'Retirados',
  expirado: 'Expirados'
};
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
      record_status: 'todos',
      pickup_status: 'todos',
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

  const [loadedPatientDocument, setLoadedPatientDocument] =
    useState('');

  const [editing, setEditing] =
    useState<LaboratoryRecord | null>(null);

  const [pickupRecord, setPickupRecord] =
    useState<LaboratoryRecord | null>(null);

  const [showIncompletePickupWarning, setShowIncompletePickupWarning] =
    useState(false);

  const [completionRecord, setCompletionRecord] =
    useState<LaboratoryRecord | null>(null);

  const [whatsappRecord, setWhatsappRecord] =
    useState<LaboratoryRecord | null>(null);

  const [completionIncomplete, setCompletionIncomplete] =
    useState(false);

  const [missingItems, setMissingItems] =
    useState<string[]>([]);

  const [missingItemInput, setMissingItemInput] =
    useState('');

  const [pickupForm, setPickupForm] =
    useState({
      pickup_date: todayInputValue(),
      picked_up_by: '',
      pickup_document: '',
      notes: ''
    });

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [whatsappStatus, setWhatsappStatus] =
    useState<WhatsappWebStatus | null>(null);

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

  const canRevertPickup =
    ['admin', 'dir', 'lab'].includes(user?.role || '');

  const canView =
    canEdit ||
    canPickup ||
    hasPermission(
      user,
      'laboratory.view',
      ['admin', 'lab', 'user', 'dir']
    );

  const canSeePickupAudit =
    user?.role === 'admin';

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

  async function loadWhatsappStatus() {
    try {
      const response =
        await apiFetch('/whatsapp/web/status');

      setWhatsappStatus(response.data);
    } catch (error) {
      setWhatsappStatus(null);
    }
  }

  useEffect(() => {
    loadLaboratory();
  }, [queryString]);

  useEffect(() => {
    if (!canChangeCompletion) {
      return;
    }

    loadWhatsappStatus();

    const interval =
      window.setInterval(
        loadWhatsappStatus,
        5000
      );

    return () =>
      window.clearInterval(interval);
  }, [canChangeCompletion]);

  useEffect(() => {
    if (!showForm) {
      return;
    }

    const documentNumber =
      normalizeDocument(form.patient_document);

    if (
      loadedPatientDocument &&
      documentNumber !== loadedPatientDocument
    ) {
      setLoadedPatientDocument('');
      setForm((current) => ({
        ...current,
        patient_last_name: '',
        patient_first_name: '',
        patient_birth_date: '',
        patient_phone: ''
      }));
      return;
    }

    if (documentNumber.length < 6) {
      return;
    }

    if (documentNumber === loadedPatientDocument) {
      return;
    }

    let cancelled = false;

    const timeoutId =
      window.setTimeout(async () => {
        try {
          const response =
            await apiFetch(
              `/laboratory/patients/${encodeURIComponent(documentNumber)}`
            );

          if (cancelled) {
            return;
          }

          const patient =
            response.data as LaboratoryPatient | null;

          if (!patient) {
            return;
          }

          setForm((current) => {
            if (
              normalizeDocument(current.patient_document) !==
              documentNumber
            ) {
              return current;
            }

            return {
              ...current,
              patient_document:
                patient.document_number || current.patient_document,
              patient_last_name:
                patient.last_name || current.patient_last_name,
              patient_first_name:
                patient.first_name || current.patient_first_name,
              patient_phone:
                patient.phone || current.patient_phone,
              patient_birth_date:
                toDateInput(patient.birth_date) ||
                current.patient_birth_date
            };
          });

          setLoadedPatientDocument(documentNumber);
        } catch (error) {
          if (cancelled) {
            return;
          }
        }
      }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    form.patient_document,
    loadedPatientDocument,
    showForm
  ]);

  async function printFilteredRecords() {
    const printWindow =
      window.open('', '_blank', 'width=1200,height=800');

    if (!printWindow) {
      showSystemAlert(
        'No se pudo abrir la ventana de impresion. Revisa si el navegador bloqueo las ventanas emergentes.'
      );
      return;
    }

    printWindow.document.write(
      '<p style="font-family: Arial, sans-serif; padding: 24px;">Preparando listado...</p>'
    );

    try {
      const params =
        new URLSearchParams(
          queryString.replace(/^\?/, '')
        );

      params.set('page', '1');
      params.set('per_page', '100');

      const firstResponse =
        await apiFetch(`/laboratory?${params.toString()}`);

      const allRecords: LaboratoryRecord[] = [
        ...firstResponse.data
      ];

      const totalPages =
        Number(firstResponse.pagination?.total_pages || 1);

      for (let page = 2; page <= totalPages; page += 1) {
        params.set('page', String(page));

        const response =
          await apiFetch(`/laboratory?${params.toString()}`);

        allRecords.push(...response.data);
      }

      if (allRecords.length === 0) {
        printWindow.close();
        showSystemAlert(
          'No hay estudios que coincidan con los filtros seleccionados.',
          'Listado vacio',
          'warning'
        );
        return;
      }

      const statusLabel =
        laboratoryStatusLabels[filters.record_status] ||
        laboratoryStatusLabels.todos;

      const title =
        filters.record_status === 'enviado'
          ? 'Reclamo al laboratorio - estudios enviados pendientes'
          : `Listado de laboratorio - ${statusLabel}`;

      const rows =
        allRecords.map((record, index) => {
          const status =
            getStatusLabel(
              record.status,
              record.is_complete,
              record.pickup_date,
              record.expired_previous_status
            ).text;

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapePrintHtml(formatDate(record.study_date))}</td>
              <td>${escapePrintHtml(`${record.patient_last_name} ${record.patient_first_name}`)}</td>
              <td>${escapePrintHtml(record.patient_document || '-')}</td>
              <td>${escapePrintHtml(record.patient_phone || '-')}</td>
              <td>${escapePrintHtml(getSampleSummary(record))}</td>
              <td>${escapePrintHtml(status)}</td>
            </tr>
          `;
        }).join('');

      const printedAt =
        new Date().toLocaleString(
          'es-AR',
          {
            timeZone: 'America/Argentina/Buenos_Aires'
          }
        );

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>${escapePrintHtml(title)}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              * { box-sizing: border-box; }
              body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 10px; }
              h1 { margin: 0 0 6px; font-size: 18px; text-transform: uppercase; }
              .summary { margin: 0 0 12px; color: #374151; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #9ca3af; padding: 5px; text-align: left; vertical-align: top; }
              th { background: #e5e7eb; font-size: 9px; text-transform: uppercase; }
              tr { break-inside: avoid; }
              footer { margin-top: 10px; display: flex; justify-content: space-between; color: #4b5563; }
            </style>
          </head>
          <body>
            <h1>${escapePrintHtml(title)}</h1>
            <p class="summary">
              Estado: ${escapePrintHtml(statusLabel)} · Total: ${allRecords.length}
            </p>
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>Telefono</th>
                  <th>Muestra</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <footer>
              <span>Impreso por: ${escapePrintHtml(user?.username || '-')}</span>
              <span>${escapePrintHtml(printedAt)}</span>
            </footer>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
    } catch (error) {
      printWindow.close();
      showSystemAlert(
        error instanceof Error
          ? error.message
          : 'No se pudo preparar el listado para imprimir.'
      );
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setLoadedPatientDocument('');
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
      patient_birth_date: toDateInput(record.patient_birth_date),
      patient_phone: record.patient_phone || '',
      has_blood_extraction: yesNo(record.has_blood_extraction),
      has_urine_sample: yesNo(record.has_urine_sample),
      requested_test_ids:
        (record.tests || [])
          .filter((test) => test.requested)
          .map((test) => Number(test.test_id || test.id)),
      notes: record.notes || ''
    });
    setLoadedPatientDocument(
      normalizeDocument(record.patient_document)
    );
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
        todayInputValue(),
      picked_up_by: record.picked_up_by || '',
      pickup_document: record.pickup_document || '',
      notes: record.notes || ''
    });
  }

  function openCompletion(
    record: LaboratoryRecord
  ) {
    setCompletionRecord(record);
    setCompletionIncomplete(!yesNo(record.is_complete));
    setMissingItems(getMissingItems(record.missing_details));
    setMissingItemInput('');
  }

  function addMissingItem() {
    const item =
      missingItemInput.trim();

    if (!item) {
      return;
    }

    setMissingItems((current) => [
      ...current,
      item
    ]);
    setMissingItemInput('');
  }

  function removeMissingItem(
    index: number
  ) {
    setMissingItems((current) =>
      current.filter((_, itemIndex) =>
        itemIndex !== index
      )
    );
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!form.patient_document) {
      showSystemAlert('Debe cargar el DNI del paciente');
      return;
    }

    if (!form.patient_last_name || !form.patient_first_name) {
      showSystemAlert('Debe cargar apellido y nombre del paciente');
      return;
    }

    if (
      !form.has_blood_extraction &&
      !form.has_urine_sample
    ) {
      showSystemAlert('Debe seleccionar Extraccion, Orina o ambas');
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

  async function deleteRecord(
    record: LaboratoryRecord
  ) {
    const confirmed = await showSystemConfirm(
      `Eliminar laboratorio de ${record.patient_last_name} ${record.patient_first_name}?`,
      { title: 'Eliminar laboratorio', confirmLabel: 'Eliminar' }
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        `/laboratory/${record.id}`,
        {
          method: 'DELETE'
        }
      );

      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function notifyLaboratoryResult(
    record = whatsappRecord
  ) {
    if (!record) {
      return;
    }

    try {
      setLoading(true);

      const response =
        await apiFetch(
          `/laboratory/${record.id}/notify-whatsapp`,
          {
            method: 'POST'
          }
        );

      showSystemAlert(
        response.message || 'Aviso enviado por WhatsApp',
        'WhatsApp',
        'success'
      );

      setWhatsappRecord(null);
      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function notifyAllPendingLaboratoryResults() {
    const confirmed = await showSystemConfirm(
      'Se enviara un aviso a todos los estudios completos, sin retiro, con telefono y que todavia no fueron avisados.',
      { title: 'Avisar pendientes por WhatsApp', confirmLabel: 'Preparar avisos' }
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch(
        '/laboratory/notify-whatsapp/pending',
        { method: 'POST' }
      );
      const failed = Number(response.data?.failed || 0);
      showSystemAlert(
        failed
          ? `${response.message}. ${failed} no pudieron prepararse.`
          : response.message,
        'Avisos de WhatsApp',
        failed ? 'warning' : 'success'
      );
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

  async function revertPickup(
    record: LaboratoryRecord
  ) {
    const confirmed = await showSystemConfirm(
      `Deshacer el retiro del laboratorio de ${record.patient_last_name} ${record.patient_first_name}? Volvera a su estado anterior.`,
      { title: 'Deshacer retiro', confirmLabel: 'Deshacer retiro' }
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const response = await apiFetch(
        `/laboratory/${record.id}/pickup/revert`,
        { method: 'PATCH' }
      );

      showSystemAlert(
        response.message || 'El retiro fue deshecho correctamente',
        'Laboratorio',
        'success'
      );

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
            is_complete: !completionIncomplete,
            missing_details:
              completionIncomplete
                ? missingItems.join('\n')
                : null
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

  async function expireOldRecords() {
    const confirmed = await showSystemConfirm(
      'Marcar como expirados los laboratorios completos con mas de 6 meses sin retirar?',
      { title: 'Marcar estudios expirados', confirmLabel: 'Marcar expirados' }
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const response =
        await apiFetch(
          '/laboratory/expire-old',
          {
            method: 'POST'
          }
        );

      showSystemAlert(
        response.message ||
          'Estudios expirados actualizados',
        'Laboratorio',
        'success'
      );

      await loadLaboratory();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
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

  const expiredRecords =
    Number(stats.expired_records || 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <PageTitle icon="laboratorio">
            Laboratorio
          </PageTitle>
          <p className="page-subtitle">
            Laboratorios, resultados recibidos y retiro de estudios.
          </p>
        </div>

        <div className="table-actions">
          {canChangeCompletion && (
            <button
              className="btn-secondary"
              disabled={loading || !whatsappStatus?.isReady}
              onClick={notifyAllPendingLaboratoryResults}
              title={
                whatsappStatus?.isReady
                  ? 'Avisar todos los resultados pendientes'
                  : 'WhatsApp no esta conectado'
              }
            >
              Avisar pendientes por WhatsApp
            </button>
          )}

          {canChangeCompletion && (
            <button
              className="btn-secondary"
              disabled={loading}
              onClick={expireOldRecords}
            >
              Marcar expirados
            </button>
          )}

          {canEdit && (
            <button
              className="btn-primary"
              onClick={openCreate}
            >
              + Nuevo laboratorio
            </button>
          )}
        </div>
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

        <div className="dashboard-card">
          <h3>Expirados</h3>
          <p>{expiredRecords}</p>
          <span>{percentOf(expiredRecords, totalRecords)} sin retiro mayor a 6 meses</span>
        </div>
      </div>

      <div className="filter-bar laboratory-filter-bar">
        <input
          className="form-input laboratory-search-filter"
          placeholder="Buscar paciente, DNI, telefono o quien retiro"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value,
              page: 1
            })
          }
        />

        <div className="laboratory-compact-filter">
          <input
            className="form-input"
            aria-label="Desde"
            placeholder="Desde"
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
        </div>

        <div className="laboratory-compact-filter">
          <input
            className="form-input"
            aria-label="Hasta"
            placeholder="Hasta"
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
        </div>

        <select
          className="form-input laboratory-compact-filter"
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
          className="form-input laboratory-compact-filter"
          value={filters.record_status}
          onChange={(e) =>
            setFilters({
              ...filters,
              record_status: e.target.value,
              page: 1
            })
          }
        >
          <option value="todos">Todos los estados</option>
          <option value="enviado">Enviados</option>
          <option value="parcial">Parciales</option>
          <option value="completo">Completos</option>
          <option value="retirado">Retirados</option>
          <option value="expirado">Expirados</option>
        </select>
        <select
          className="form-input laboratory-compact-filter"
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

        <button
          className="btn-primary"
          type="button"
          onClick={printFilteredRecords}
        >
          Imprimir listado
        </button>
        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              date_from: '',
              date_to: '',
              sample_type: 'todas',
              record_status: 'todos',
              pickup_status: 'todos',
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
              <th>Paciente</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th>Prácticas</th>
              <th>Estado</th>
              <th>Retiro</th>
              <th>Retiro por</th>
              {canSeePickupAudit && (
                <th>Entregado por</th>
              )}
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => {
              const status =
                getStatusLabel(
                  record.status,
                  record.is_complete,
                  record.pickup_date,
                  record.expired_previous_status
                );

              const canModifyRecord =
                !record.pickup_date ||
                user?.role === 'admin';

              return (
                <tr key={record.id}>
                  <td>{formatDate(record.study_date)}</td>
                  <td>
                    {record.patient_last_name} {record.patient_first_name}
                  </td>
                  <td>{record.patient_document || '-'}</td>
                  <td>{record.patient_phone || '-'}</td>
                  <td>
                    <div className="laboratory-practice-preview">
                      <strong>
                        {getSampleSummary(record)}
                      </strong>
                      <span>
                        {yesNo(record.is_complete)
                          ? 'Resultados completos'
                          : 'Resultados pendientes'}
                      </span>
                      {getMissingItems(record.missing_details).length > 0 && (
                        <div className="laboratory-practice-tooltip">
                          <strong>Falta recibir</strong>
                          <ul>
                            {getMissingItems(record.missing_details).map((item) => (
                              <li key={item}>
                                <span>
                                  {item}
                                </span>
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
                            ? 'badge badge-info'
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
                  {canSeePickupAudit && (
                    <td>
                      {record.pickup_registered_by_name || '-'}
                      {record.pickup_registered_at && (
                        <>
                          <br />
                          <span className="muted">
                            {formatDisplayDateTime(
                              record.pickup_registered_at
                            )}
                          </span>
                        </>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="table-actions">
                      {canEdit && canModifyRecord && (
                        <IconButton
                          icon="edit"
                          label="Editar laboratorio"
                          onClick={() =>
                            openEdit(record)
                          }
                          variant="primary"
                        />
                      )}

                      {canEdit && canModifyRecord && (
                        <IconButton
                          disabled={loading}
                          icon="trash"
                          label="Eliminar laboratorio"
                          onClick={() =>
                            deleteRecord(record)
                          }
                          variant="danger"
                        />
                      )}

                      {canChangeCompletion && canModifyRecord && (
                        <IconButton
                          icon="check"
                          label="Cargar resultados"
                          onClick={() =>
                            openCompletion(record)
                          }
                          variant="secondary"
                        />
                      )}

                      {canChangeCompletion &&
                        yesNo(record.is_complete) &&
                        !record.pickup_date &&
                        record.patient_phone && (
                          <IconButton
                            disabled={
                              loading ||
                              !whatsappStatus?.isReady
                            }
                            icon={
                              record.whatsapp_notified_at
                                ? 'message-check'
                                : 'whatsapp'
                            }
                            label={
                              whatsappStatus?.isReady
                                ? record.whatsapp_notified_at
                                  ? 'Aviso de WhatsApp enviado'
                                  : 'Avisar por WhatsApp'
                                : 'WhatsApp no esta conectado'
                            }
                            onClick={() =>
                              setWhatsappRecord(record)
                            }
                            className={
                              record.whatsapp_notified_at
                                ? 'laboratory-whatsapp-sent'
                                : ''
                            }
                            variant={
                              record.whatsapp_notified_at
                                ? 'secondary'
                                : 'success'
                            }
                          />
                        )}

                      {canRevertPickup &&
                        (record.status === 'retirado' || record.pickup_date) && (
                          <IconButton
                            disabled={loading}
                            icon="unlock"
                            label="Deshacer retiro"
                            onClick={() =>
                              revertPickup(record)
                            }
                            variant="danger"
                          />
                        )}

                      {canPickup && !record.pickup_date && record.status !== 'retirado' && (
                        <IconButton
                          disabled={
                            record.status === 'enviado' &&
                            !yesNo(record.is_complete)
                          }
                          icon="download"
                          label={
                            record.status === 'enviado' &&
                            !yesNo(record.is_complete)
                              ? 'No se puede retirar: resultados enviados sin completar'
                              : 'Registrar retiro'
                          }
                          onClick={() =>
                            openPickup(record)
                          }
                          variant="secondary"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td colSpan={canSeePickupAudit ? 10 : 9}>
                  No hay estudios para esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
              {editing ? 'Editar laboratorio' : 'Nuevo laboratorio'}
            </h2>

            <form
              className="laboratory-route-form"
              onSubmit={handleSubmit}
            >
              <div className="laboratory-patient-grid">
                <label className="form-field laboratory-field-compact">
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
                    autoFocus={!editing}
                  />
                </label>

                <label className="form-field laboratory-field-name">
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

                <label className="form-field laboratory-field-name">
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

                <label className="form-field laboratory-field-date">
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

                <label className="form-field laboratory-field-date">
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

                <label className="form-field laboratory-field-phone">
                  <span>Teléfono (ejemplo: 2219876543)</span>
                  <input
                    className="form-input"
                    value={form.patient_phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_phone: e.target.value
                      })
                    }
                  />
                </label>
              </div>

              <div className="laboratory-simple-samples">
                <label className="checkbox-row">
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
                  Extraccion
                </label>

                <label className="checkbox-row">
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

      {whatsappRecord && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setWhatsappRecord(null)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <h2 className="modal-title">
              Enviar WhatsApp
            </h2>

            <p className="page-subtitle">
              {whatsappRecord.patient_last_name} {whatsappRecord.patient_first_name}
            </p>

            <p>
              Se enviara un aviso al telefono {whatsappRecord.patient_phone}.
            </p>

            {whatsappRecord.whatsapp_notified_at && (
              <p className="form-note">
                Ya se envio un aviso el {formatDisplayDateTime(whatsappRecord.whatsapp_notified_at)}.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setWhatsappRecord(null)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-success"
                disabled={loading}
                onClick={() =>
                  notifyLaboratoryResult()
                }
              >
                {loading ? 'Enviando...' : 'Enviar aviso'}
              </button>
            </div>
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
              <label className="checkbox-row laboratory-incomplete-check">
                <input
                  type="checkbox"
                  checked={completionIncomplete}
                  onChange={(e) =>
                    setCompletionIncomplete(e.target.checked)
                  }
                />
                Incompleto
              </label>

              {completionIncomplete && (
                <div className="laboratory-missing-items">
                  <label className="form-field">
                    <span>Que falta</span>
                    <div className="laboratory-missing-input-row">
                      <input
                        className="form-input"
                        value={missingItemInput}
                        placeholder="Ejemplo: HIV, TSH, urocultivo"
                        onChange={(e) =>
                          setMissingItemInput(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addMissingItem();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={addMissingItem}
                      >
                        Agregar
                      </button>
                    </div>
                  </label>

                  <div className="laboratory-missing-list">
                    {missingItems.map((item, index) => (
                      <span
                        className="laboratory-missing-chip"
                        key={`${item}-${index}`}
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() =>
                            removeMissingItem(index)
                          }
                          aria-label={`Quitar ${item}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="form-note">
                Si no marcas incompleto, el estudio queda completo y pendiente para retirar.
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

            {getMissingItems(pickupRecord.missing_details).length > 0 && (
              <p className="auth-error">
                Falta: {getMissingItems(pickupRecord.missing_details).join(', ')}
              </p>
            )}

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
