import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { getApiUrl }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';

type WebStatus = {
  status: string;
  qrDataUrl: string | null;
  phone: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
  isReady: boolean;
  hasClient: boolean;
  initializing: boolean;
};

type ChatConversation = {
  phone: string;
  last_message_at: string;
  last_message: string;
  incoming_count: number;
};

type ChatMessage = {
  id: number;
  phone: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  source: string;
  created_at: string;
};

type DoctorSchedule = {
  id?: number;
  weekday: number;
  weekday_name?: string;
  start_time: string;
  end_time: string;
  is_active?: boolean;
};

type AppointmentDoctor = {
  id: number;
  doctor_name: string;
  specialty: string;
  is_active: boolean;
  is_booking_open: boolean;
  next_open_at: string | null;
  closed_message: string | null;
  schedules: DoctorSchedule[];
};

type AppointmentRequest = {
  id: number;
  phone: string;
  doctor_id: number;
  patient_name: string;
  patient_document: string;
  requested_day_label: string | null;
  status: string;
  assigned_date: string | null;
  assigned_time: string | null;
  admin_notes: string | null;
  created_at: string;
  doctor_name: string;
  specialty: string;
};

const weekdayOptions = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
  { value: 7, label: 'Domingo' }
];

const emptyDoctorForm = {
  doctor_name: '',
  specialty: '',
  is_active: true,
  is_booking_open: false,
  next_open_at: '',
  closed_message: ''
};

function formatNextOpeningText(
  value: string
) {
  if (!value) {
    return '';
  }

  const [datePart, timePart = ''] =
    value.split('T');

  const [year, month, day] =
    datePart.split('-').map(Number);

  if (!year || !month || !day) {
    return '';
  }

  const date =
    new Date(year, month - 1, day);

  const weekday =
    weekdayOptions.find((option) =>
      option.value === (date.getDay() === 0 ? 7 : date.getDay())
    )?.label || '';

  const time =
    timePart.slice(0, 5);

  return `${weekday} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')} a las ${time} hs.`;
}

function buildClosedBookingMessage(
  nextOpenAt: string
) {
  const formattedDate =
    formatNextOpeningText(nextOpenAt);

  return formattedDate
    ? `Por el momento no quedan turnos disponibles. La turnera vuelve a abrir el ${formattedDate}`
    : '';
}

export default function WhatsappPage() {

  const { user } =
    useAuth();

  const isAdmin =
    user?.role === 'admin';

  const [error, setError] =
    useState('');

  const [webStatus, setWebStatus] =
    useState<WebStatus | null>(null);

  const [conversations, setConversations] =
    useState<ChatConversation[]>([]);

  const [conversationSearch, setConversationSearch] =
    useState('');

  const [profilePictures, setProfilePictures] =
    useState<Record<string, string | null>>({});

  const [selectedPhone, setSelectedPhone] =
    useState('');

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([]);

  const [manualMessage, setManualMessage] =
    useState('');

  const [testMessage, setTestMessage] =
    useState('');

  const [testResponse, setTestResponse] =
    useState('');

  const [connectionLoading, setConnectionLoading] =
    useState(false);

  const [cleanupDate, setCleanupDate] =
    useState('');

  const [cleanupLoading, setCleanupLoading] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState('');

  const [doctors, setDoctors] =
    useState<AppointmentDoctor[]>([]);

  const [doctorForm, setDoctorForm] =
    useState(emptyDoctorForm);

  const [editingDoctor, setEditingDoctor] =
    useState<AppointmentDoctor | null>(null);

  const [showDoctorModal, setShowDoctorModal] =
    useState(false);

  const [doctorSearch, setDoctorSearch] =
    useState('');

  const [closingDoctor, setClosingDoctor] =
    useState<AppointmentDoctor | null>(null);

  const [closeBookingForm, setCloseBookingForm] =
    useState({
      next_open_at: '',
      closed_message: ''
    });

  const [scheduleForm, setScheduleForm] =
    useState<DoctorSchedule[]>([]);

  const [requests, setRequests] =
    useState<AppointmentRequest[]>([]);

  const [requestFilters, setRequestFilters] =
    useState({
      doctor_id: 'todos',
      status: 'pendiente',
      search: ''
    });

  const [confirmingRequest, setConfirmingRequest] =
    useState<AppointmentRequest | null>(null);

  const [confirmForm, setConfirmForm] =
    useState({
      assigned_date: '',
      assigned_time: '',
      admin_notes: ''
    });

  const [activeTab, setActiveTab] =
    useState<'chat' | 'turnera' | 'solicitudes' | 'conexion'>('chat');

  async function loadWebStatus() {

    try {

      const res =
        await apiFetch('/whatsapp/web/status');

      setWebStatus(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadConversations() {

    try {

      const res =
        await apiFetch('/whatsapp/chat/conversations');

      setConversations(res.data);

      if (!selectedPhone && res.data.length > 0) {
        setSelectedPhone(res.data[0].phone);
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadChatMessages(
    phone: string
  ) {

    if (!phone) {
      setChatMessages([]);
      return;
    }

    try {

      const res =
        await apiFetch(
          `/whatsapp/chat/${encodeURIComponent(phone)}/messages`
        );

      setChatMessages(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadProfilePicture(
    phone: string
  ) {
    if (
      !phone ||
      Object.prototype.hasOwnProperty.call(
        profilePictures,
        phone
      )
    ) {
      return;
    }

    try {
      const res =
        await apiFetch(
          `/whatsapp/chat/${encodeURIComponent(phone)}/profile-picture`
        );

      setProfilePictures((current) => ({
        ...current,
        [phone]: res.data.profile_picture_url || null
      }));
    } catch (error) {
      setProfilePictures((current) => ({
        ...current,
        [phone]: null
      }));
    }
  }

  function getConversationInitials(
    phone: string
  ) {
    const cleanPhone =
      phone.replace(/\D/g, '');

    return cleanPhone.slice(-2) || 'WA';
  }

  function formatWhatsappPhone(
    phone: string
  ) {
    return phone
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '');
  }

  async function sendManualMessage() {
    if (!selectedPhone || !manualMessage.trim()) {
      return;
    }

    try {
      setError('');

      await apiFetch(
        `/whatsapp/chat/${encodeURIComponent(selectedPhone)}/send`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: manualMessage.trim()
          })
        }
      );

      setManualMessage('');
      await loadConversations();
      await loadChatMessages(selectedPhone);

    } catch (error: any) {
      setError(error.message);
    }
  }

  async function loadDoctors() {

    try {

      const res =
        await apiFetch('/whatsapp/appointments/doctors');

      setDoctors(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadAppointmentRequests() {

    try {

      const params =
        new URLSearchParams();

      if (requestFilters.doctor_id !== 'todos') {
        params.set(
          'doctor_id',
          requestFilters.doctor_id
        );
      }

      if (requestFilters.status !== 'todos') {
        params.set(
          'status',
          requestFilters.status
        );
      }

      if (requestFilters.search.trim()) {
        params.set(
          'search',
          requestFilters.search.trim()
        );
      }

      const res =
        await apiFetch(
          `/whatsapp/appointments/requests?${params.toString()}`
        );

      setRequests(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function simulate() {

    setError('');
    setTestResponse('');

    try {

      const res =
        await apiFetch(
          '/whatsapp/simulate',
          {
            method: 'POST',
            body: JSON.stringify({
              message: testMessage
            })
          }
        );

      setTestResponse(
        res.data.response
      );

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleConnectionAction(
    action: 'start' | 'stop' | 'logout'
  ) {

    try {

      setConnectionLoading(true);
      setError('');

      const res =
        await apiFetch(
          `/whatsapp/web/${action}`,
          {
            method: 'POST'
          }
      );

      setWebStatus(res.data);
      await loadConversations();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setConnectionLoading(false);
    }
  }

  async function exportLogs() {
    const token =
      localStorage.getItem('accessToken');

    const response =
      await fetch(
        `${getApiUrl()}/whatsapp/logs/export`,
        {
          headers: {
            Authorization:
              token ? `Bearer ${token}` : ''
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        'No se pudo exportar el historial'
      );
    }

    const blob =
      await response.blob();

    const url =
      window.URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;
    link.download =
      `whatsapp-historial-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  async function handleExportLogs() {
    try {
      setError('');
      await exportLogs();
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function cleanupLogs(
    deleteAll = false
  ) {
    const confirmation =
      deleteAll
        ? 'Esto va a borrar todo el historial de mensajes de WhatsApp. Antes conviene exportarlo. ¿Continuar?'
        : `Esto va a borrar los mensajes anteriores al ${cleanupDate}. Antes conviene exportarlos. ¿Continuar?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    try {
      setCleanupLoading(true);
      setError('');
      setSuccessMessage('');

      const res =
        await apiFetch(
          '/whatsapp/logs/cleanup',
          {
            method: 'DELETE',
            body: JSON.stringify({
              delete_all: deleteAll,
              before_date: cleanupDate
            })
          }
        );

      setSuccessMessage(
        `Se eliminaron ${res.data.deleted} mensajes del historial.`
      );

      if (deleteAll) {
        setCleanupDate('');
      }

      await loadConversations();
      if (selectedPhone) {
        await loadChatMessages(selectedPhone);
      }

    } catch (error: any) {
      setError(error.message);
    } finally {
      setCleanupLoading(false);
    }
  }

  function startEditDoctor(
    doctor: AppointmentDoctor
  ) {
    setEditingDoctor(doctor);
    setDoctorForm({
      doctor_name: doctor.doctor_name,
      specialty: doctor.specialty,
      is_active: Boolean(doctor.is_active),
      is_booking_open: Boolean(doctor.is_booking_open),
      next_open_at:
        doctor.next_open_at
          ? doctor.next_open_at.slice(0, 16)
          : '',
      closed_message:
        doctor.closed_message || ''
    });
    setScheduleForm(
      doctor.schedules?.length
        ? doctor.schedules.map((schedule) => ({
          weekday: Number(schedule.weekday),
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: schedule.is_active ?? true
        }))
        : []
    );
    setShowDoctorModal(true);
  }

  function startNewDoctor() {
    setEditingDoctor(null);
    setDoctorForm(emptyDoctorForm);
    setScheduleForm([]);
    setShowDoctorModal(true);
  }

  function resetDoctorForm() {
    setEditingDoctor(null);
    setDoctorForm(emptyDoctorForm);
    setScheduleForm([]);
    setShowDoctorModal(false);
  }

  function addScheduleRow() {
    setScheduleForm((current) => [
      ...current,
      {
        weekday: 1,
        start_time: '08:00',
        end_time: '12:00',
        is_active: true
      }
    ]);
  }

  function updateScheduleRow(
    index: number,
    field: keyof DoctorSchedule,
    value: string | number | boolean
  ) {
    setScheduleForm((current) =>
      current.map((schedule, scheduleIndex) =>
        scheduleIndex === index
          ? {
            ...schedule,
            [field]: value
          }
          : schedule
      )
    );
  }

  function removeScheduleRow(
    index: number
  ) {
    setScheduleForm((current) =>
      current.filter((_, scheduleIndex) =>
        scheduleIndex !== index
      )
    );
  }

  async function saveDoctor(
    e: React.FormEvent
  ) {
    e.preventDefault();

    try {
      setError('');
      setSuccessMessage('');

      const payload = {
        ...doctorForm,
        next_open_at:
          doctorForm.next_open_at || null,
        closed_message:
          doctorForm.closed_message ||
          (
            !doctorForm.is_booking_open && doctorForm.next_open_at
              ? buildClosedBookingMessage(doctorForm.next_open_at)
              : ''
          )
      };

      const response =
        await apiFetch(
          editingDoctor
            ? `/whatsapp/appointments/doctors/${editingDoctor.id}`
            : '/whatsapp/appointments/doctors',
          {
            method: editingDoctor ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
          }
        );

      const doctorId =
        editingDoctor?.id || response.data.id;

      await apiFetch(
        `/whatsapp/appointments/doctors/${doctorId}/schedules`,
        {
          method: 'PUT',
          body: JSON.stringify({
            schedules: scheduleForm
          })
        }
      );

      setSuccessMessage('Medico y horarios guardados.');
      resetDoctorForm();
      await loadDoctors();

    } catch (error: any) {
      setError(error.message);
    }
  }

  async function toggleDoctorBooking(
    doctor: AppointmentDoctor
  ) {
    if (doctor.is_booking_open) {
      const nextOpenAt =
        doctor.next_open_at
          ? doctor.next_open_at.slice(0, 16)
          : '';

      setClosingDoctor(doctor);
      setCloseBookingForm({
        next_open_at: nextOpenAt,
        closed_message:
          doctor.closed_message ||
          buildClosedBookingMessage(nextOpenAt)
      });
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      await apiFetch(
        `/whatsapp/appointments/doctors/${doctor.id}/booking`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_booking_open: true,
            next_open_at: null,
            closed_message: null
          })
        }
      );

      setSuccessMessage('Turnera abierta.');
      await loadDoctors();

    } catch (error: any) {
      setError(error.message);
    }
  }

  async function closeDoctorBooking() {
    if (!closingDoctor) {
      return;
    }

    if (!closeBookingForm.next_open_at) {
      setError('Indica la fecha y hora en que vuelve a abrir la turnera.');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const closedMessage =
        closeBookingForm.closed_message ||
        buildClosedBookingMessage(closeBookingForm.next_open_at);

      await apiFetch(
        `/whatsapp/appointments/doctors/${closingDoctor.id}/booking`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_booking_open: false,
            next_open_at: closeBookingForm.next_open_at,
            closed_message: closedMessage
          })
        }
      );

      setSuccessMessage('Turnera cerrada.');
      setClosingDoctor(null);
      setCloseBookingForm({
        next_open_at: '',
        closed_message: ''
      });
      await loadDoctors();

    } catch (error: any) {
      setError(error.message);
    }
  }

  function startConfirmRequest(
    request: AppointmentRequest
  ) {
    setConfirmingRequest(request);
    setConfirmForm({
      assigned_date: request.assigned_date || '',
      assigned_time: request.assigned_time || '',
      admin_notes: request.admin_notes || ''
    });
  }

  async function confirmRequest() {
    if (!confirmingRequest) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const res =
        await apiFetch(
          `/whatsapp/appointments/requests/${confirmingRequest.id}/confirm`,
          {
            method: 'PATCH',
            body: JSON.stringify(confirmForm)
          }
        );

      setSuccessMessage(
        res.data.sent
          ? 'Turno confirmado y mensaje enviado.'
          : 'Turno confirmado. No se pudo enviar WhatsApp porque no esta conectado.'
      );
      setConfirmingRequest(null);
      await loadAppointmentRequests();

    } catch (error: any) {
      setError(error.message);
    }
  }

  async function markNoAvailability(
    request: AppointmentRequest
  ) {
    const message =
      window.prompt(
        'Mensaje para enviar al paciente',
        `Hola ${request.patient_name}. Por el momento no quedan turnos disponibles para ${request.specialty}. Te avisaremos cuando vuelva a abrir la turnera.`
      );

    if (!message) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const res =
        await apiFetch(
          `/whatsapp/appointments/requests/${request.id}/no-availability`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              message
            })
          }
        );

      setSuccessMessage(
        res.data.sent
          ? 'Solicitud marcada sin lugar y mensaje enviado.'
          : 'Solicitud marcada sin lugar. No se pudo enviar WhatsApp porque no esta conectado.'
      );
      await loadAppointmentRequests();

    } catch (error: any) {
      setError(error.message);
    }
  }

  useEffect(() => {

    loadWebStatus();
    loadConversations();
    loadDoctors();
    loadAppointmentRequests();

    const interval =
      window.setInterval(() => {
        loadWebStatus();
        loadConversations();
      }, 5000);

    return () =>
      window.clearInterval(interval);

  }, []);

  useEffect(() => {

    loadChatMessages(selectedPhone);

    loadProfilePicture(selectedPhone);

    if (!selectedPhone) {
      return;
    }

    const interval =
      window.setInterval(() => {
        loadChatMessages(selectedPhone);
      }, 5000);

    return () =>
      window.clearInterval(interval);

  }, [selectedPhone]);

  useEffect(() => {

    conversations
      .slice(0, 30)
      .forEach((conversation) => {
        loadProfilePicture(conversation.phone);
      });

  }, [conversations, profilePictures]);

  useEffect(() => {

    loadAppointmentRequests();

  }, [
    requestFilters.doctor_id,
    requestFilters.status,
    requestFilters.search
  ]);

  const connectionLabel =
    webStatus?.status === 'connected'
      ? 'Conectado'
      : webStatus?.status === 'qr'
        ? 'Esperando QR'
        : webStatus?.status === 'initializing'
          ? 'Iniciando'
          : webStatus?.status === 'authenticated'
            ? 'Autenticado'
            : webStatus?.status === 'not_configured'
              ? 'No configurado'
              : webStatus?.status === 'failed'
                ? 'Error'
                : 'Desconectado';

  const connectionBadgeClass =
    webStatus?.status === 'connected'
      ? 'badge badge-success'
      : webStatus?.status === 'qr' ||
          webStatus?.status === 'initializing' ||
          webStatus?.status === 'authenticated'
        ? 'badge badge-warning'
          : 'badge badge-danger';

  const filteredConversations =
    conversations.filter((conversation) => {
      const search =
        conversationSearch
          .replace(/\D/g, '')
          .toLowerCase();

      const phone =
        formatWhatsappPhone(conversation.phone)
          .replace(/\D/g, '')
          .toLowerCase();

      const text =
        `${conversation.phone} ${conversation.last_message || ''}`
          .toLowerCase();

      return (
        !conversationSearch.trim() ||
        phone.includes(search) ||
        text.includes(conversationSearch.trim().toLowerCase())
      );
    });

  const filteredDoctors =
    doctors.filter((doctor) => {
      const search =
        doctorSearch.trim().toLowerCase();

      if (!search) {
        return true;
      }

      return `${doctor.specialty} ${doctor.doctor_name}`
        .toLowerCase()
        .includes(search);
    });

  return (

    <div>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            WhatsApp
          </h1>
          <p className="page-subtitle">
            Menu automatico, palabras clave y respuestas para consultas frecuentes.
          </p>
        </div>
      </div>

      <div className="module-tabs">
        <button
          type="button"
          className={
            activeTab === 'chat'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('chat')
          }
        >
          Chat
        </button>

        <button
          type="button"
          className={
            activeTab === 'turnera'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('turnera')
          }
        >
          Turnera
        </button>

        <button
          type="button"
          className={
            activeTab === 'solicitudes'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('solicitudes')
          }
        >
          Solicitudes
        </button>

        <button
          type="button"
          className={
            activeTab === 'conexion'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('conexion')
          }
        >
          Conexion
        </button>
      </div>

      {activeTab === 'conexion' && (
      <section className="dashboard-panel whatsapp-preview">
        <div className="whatsapp-connection-header">
          <div>
            <h2>Conexion WhatsApp Web</h2>
            <p className="page-subtitle">
              Vincula el telefono escaneando el QR desde WhatsApp.
            </p>
          </div>

          <span className={connectionBadgeClass}>
            {connectionLabel}
          </span>
        </div>

        <div className="whatsapp-connection-grid">
          <div className="whatsapp-qr-box">
            {
              webStatus?.qrDataUrl ? (
                <img
                  src={webStatus.qrDataUrl}
                  alt="Codigo QR de WhatsApp"
                />
              ) : (
                <div className="whatsapp-qr-placeholder">
                  {
                    webStatus?.isReady
                      ? 'Telefono vinculado'
                      : 'Presiona iniciar para generar el QR'
                  }
                </div>
              )
            }
          </div>

          <div className="whatsapp-connection-info">
            <p>
              <strong>Telefono:</strong>{' '}
              {webStatus?.phone || '-'}
            </p>
            <p>
              <strong>Ultimo evento:</strong>{' '}
              {webStatus?.lastEvent || '-'}
            </p>
            <p>
              <strong>Actualizado:</strong>{' '}
              {
                webStatus?.lastEventAt
                  ? new Date(webStatus.lastEventAt)
                    .toLocaleString('es-AR')
                  : '-'
              }
            </p>

            <div className="management-actions">
              <button
                className="btn-primary"
                type="button"
                disabled={
                  connectionLoading ||
                  webStatus?.status === 'connected' ||
                  webStatus?.status === 'initializing'
                }
                onClick={() =>
                  handleConnectionAction('start')
                }
              >
                Iniciar conexion
              </button>

              <button
                className="btn-secondary"
                type="button"
                disabled={
                  connectionLoading ||
                  !webStatus?.hasClient
                }
                onClick={() =>
                  handleConnectionAction('stop')
                }
              >
                Detener
              </button>

              <button
                className="btn-danger"
                type="button"
                disabled={
                  connectionLoading ||
                  !webStatus?.hasClient
                }
                onClick={() =>
                  handleConnectionAction('logout')
                }
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeTab === 'turnera' && (
      <section className="dashboard-panel whatsapp-preview">
        <div className="whatsapp-section-title-row">
          <div>
            <h2>Turnera medica por WhatsApp</h2>
            <p className="page-subtitle">
              Configura medicos, dias de atencion y apertura de turnera.
            </p>
          </div>

          <button
            className="btn-primary"
            type="button"
            onClick={startNewDoctor}
          >
            + Nuevo medico
          </button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input"
            placeholder="Buscar medico o especialidad"
            value={doctorSearch}
            onChange={(e) =>
              setDoctorSearch(e.target.value)
            }
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Especialidad</th>
                <th>Medico</th>
                <th>Atencion</th>
                <th>Turnera</th>
                <th>Proxima apertura</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredDoctors.map((doctor) => (
                <tr key={doctor.id}>
                  <td>{doctor.specialty}</td>
                  <td>{doctor.doctor_name}</td>
                  <td>
                    {doctor.schedules?.length
                      ? doctor.schedules
                        .map((schedule) =>
                          `${schedule.weekday_name} ${schedule.start_time}-${schedule.end_time}`
                        )
                        .join(', ')
                      : 'Sin horarios'}
                  </td>
                  <td>
                    <span
                      className={
                        doctor.is_booking_open
                          ? 'badge badge-success'
                          : 'badge badge-danger'
                      }
                    >
                      {
                        doctor.is_booking_open
                          ? 'Abierta'
                          : 'Cerrada'
                      }
                    </span>
                  </td>
                  <td>
                    {doctor.next_open_at
                      ? new Date(doctor.next_open_at)
                        .toLocaleString('es-AR')
                      : '-'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() =>
                          startEditDoctor(doctor)
                        }
                      >
                        Editar
                      </button>

                      <button
                        className={
                          doctor.is_booking_open
                            ? 'btn-danger'
                            : 'btn-success'
                        }
                        type="button"
                        onClick={() =>
                          toggleDoctorBooking(doctor)
                        }
                      >
                        {
                          doctor.is_booking_open
                            ? 'Cerrar'
                            : 'Abrir'
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDoctors.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    No hay medicos para ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'solicitudes' && (
      <section className="dashboard-panel whatsapp-preview">
        <h2>Agenda de solicitudes</h2>

        <div className="filter-bar">
          <select
            className="form-input"
            value={requestFilters.doctor_id}
            onChange={(e) =>
              setRequestFilters({
                ...requestFilters,
                doctor_id: e.target.value
              })
            }
          >
            <option value="todos">
              Todos los medicos
            </option>
            {doctors.map((doctor) => (
              <option
                key={doctor.id}
                value={doctor.id}
              >
                {doctor.specialty} - {doctor.doctor_name}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={requestFilters.status}
            onChange={(e) =>
              setRequestFilters({
                ...requestFilters,
                status: e.target.value
              })
            }
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="confirmado">Confirmados</option>
            <option value="sin_lugar">Sin lugar</option>
          </select>

          <input
            className="form-input"
            placeholder="Buscar paciente, DNI o telefono"
            value={requestFilters.search}
            onChange={(e) =>
              setRequestFilters({
                ...requestFilters,
                search: e.target.value
              })
            }
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>DNI</th>
                <th>Especialidad</th>
                <th>Dia pedido</th>
                <th>Estado</th>
                <th>Turno</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    {new Date(request.created_at)
                      .toLocaleString('es-AR')}
                  </td>
                  <td>{request.patient_name}</td>
                  <td>{request.patient_document}</td>
                  <td>
                    {request.specialty}
                    <br />
                    {request.doctor_name}
                  </td>
                  <td>{request.requested_day_label || '-'}</td>
                  <td>{request.status}</td>
                  <td>
                    {request.assigned_date
                      ? `${new Date(request.assigned_date)
                        .toLocaleDateString('es-AR')} ${request.assigned_time || ''}`
                      : '-'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-success"
                        type="button"
                        onClick={() =>
                          startConfirmRequest(request)
                        }
                      >
                        Confirmar
                      </button>

                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() =>
                          markNoAvailability(request)
                        }
                      >
                        Sin lugar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {requests.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    No hay solicitudes para esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {showDoctorModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <h2 className="modal-title">
              {editingDoctor ? 'Editar medico' : 'Nuevo medico'}
            </h2>

            <form
              className="whatsapp-appointment-form"
              onSubmit={saveDoctor}
            >
              <input
                className="form-input"
                placeholder="Especialidad"
                value={doctorForm.specialty}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    specialty: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Medico"
                value={doctorForm.doctor_name}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    doctor_name: e.target.value
                  })
                }
              />

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={doctorForm.is_active}
                  onChange={(e) =>
                    setDoctorForm({
                      ...doctorForm,
                      is_active: e.target.checked
                    })
                  }
                />
                Activo
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={doctorForm.is_booking_open}
                  onChange={(e) =>
                    setDoctorForm({
                      ...doctorForm,
                      is_booking_open: e.target.checked
                    })
                  }
                />
                Turnera abierta
              </label>

              {!doctorForm.is_booking_open && (
                <input
                  className="form-input"
                  type="datetime-local"
                  value={doctorForm.next_open_at}
                  onChange={(e) =>
                    setDoctorForm({
                      ...doctorForm,
                      next_open_at: e.target.value,
                      closed_message:
                        buildClosedBookingMessage(e.target.value)
                    })
                  }
                />
              )}

              <textarea
                className="form-input"
                rows={3}
                placeholder="Mensaje opcional cuando no hay turnos"
                value={doctorForm.closed_message}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    closed_message: e.target.value
                  })
                }
              />

              <div className="whatsapp-schedule-editor">
                <div className="whatsapp-section-title-row">
                  <h3>Dias y horarios de atencion</h3>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={addScheduleRow}
                  >
                    + Agregar dia
                  </button>
                </div>

                {scheduleForm.map((schedule, index) => (
                  <div
                    className="whatsapp-schedule-row"
                    key={`${schedule.weekday}-${index}`}
                  >
                    <select
                      className="form-input"
                      value={schedule.weekday}
                      onChange={(e) =>
                        updateScheduleRow(
                          index,
                          'weekday',
                          Number(e.target.value)
                        )
                      }
                    >
                      {weekdayOptions.map((day) => (
                        <option
                          key={day.value}
                          value={day.value}
                        >
                          {day.label}
                        </option>
                      ))}
                    </select>

                    <input
                      className="form-input"
                      type="time"
                      value={schedule.start_time}
                      onChange={(e) =>
                        updateScheduleRow(
                          index,
                          'start_time',
                          e.target.value
                        )
                      }
                    />

                    <input
                      className="form-input"
                      type="time"
                      value={schedule.end_time}
                      onChange={(e) =>
                        updateScheduleRow(
                          index,
                          'end_time',
                          e.target.value
                        )
                      }
                    />

                    <button
                      className="btn-danger"
                      type="button"
                      onClick={() =>
                        removeScheduleRow(index)
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={resetDoctorForm}
                >
                  Cancelar
                </button>

                <button
                  className="btn-success"
                  type="submit"
                >
                  Guardar medico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {closingDoctor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Cerrar turnera
            </h2>

            <p>
              {closingDoctor.specialty} - {closingDoctor.doctor_name}
            </p>

            <label className="form-label">
              Proxima apertura
            </label>
            <input
              className="form-input"
              type="datetime-local"
              value={closeBookingForm.next_open_at}
              onChange={(e) => {
                const nextOpenAt =
                  e.target.value;

                setCloseBookingForm({
                  next_open_at: nextOpenAt,
                  closed_message:
                    buildClosedBookingMessage(nextOpenAt)
                });
              }}
            />

            <label className="form-label">
              Mensaje cuando no hay turnos
            </label>
            <textarea
              className="form-input"
              rows={4}
              value={closeBookingForm.closed_message}
              onChange={(e) =>
                setCloseBookingForm({
                  ...closeBookingForm,
                  closed_message: e.target.value
                })
              }
            />

            <div className="modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setClosingDoctor(null);
                  setCloseBookingForm({
                    next_open_at: '',
                    closed_message: ''
                  });
                }}
              >
                Cancelar
              </button>

              <button
                className="btn-danger"
                type="button"
                onClick={closeDoctorBooking}
              >
                Cerrar turnera
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Confirmar turno
            </h2>

            <p>
              {confirmingRequest.patient_name} - {confirmingRequest.specialty}
            </p>

            <input
              className="form-input"
              type="date"
              value={confirmForm.assigned_date}
              onChange={(e) =>
                setConfirmForm({
                  ...confirmForm,
                  assigned_date: e.target.value
                })
              }
            />

            <input
              className="form-input"
              type="time"
              value={confirmForm.assigned_time}
              onChange={(e) =>
                setConfirmForm({
                  ...confirmForm,
                  assigned_time: e.target.value
                })
              }
            />

            <textarea
              className="form-input"
              rows={3}
              placeholder="Observaciones internas"
              value={confirmForm.admin_notes}
              onChange={(e) =>
                setConfirmForm({
                  ...confirmForm,
                  admin_notes: e.target.value
                })
              }
            />

            <div className="modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  setConfirmingRequest(null)
                }
              >
                Cancelar
              </button>

              <button
                className="btn-success"
                type="button"
                onClick={confirmRequest}
              >
                Confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
      <section className="dashboard-panel whatsapp-preview">
        <h2>Conversaciones</h2>

        {isAdmin && (
          <div className="whatsapp-admin-test">
            <h3>Probar respuesta automatica</h3>

            <div className="whatsapp-test">
              <input
                className="form-input"
                placeholder="Ejemplo: 1, turno, resultado laboratorio 12345678"
                value={testMessage}
                onChange={(e) =>
                  setTestMessage(e.target.value)
                }
              />

              <button
                className="btn-primary"
                type="button"
                onClick={simulate}
              >
                Probar
              </button>
            </div>

            {testResponse && (
              <pre className="whatsapp-message">
                {testResponse}
              </pre>
            )}
          </div>
        )}

        <div className="whatsapp-history-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={handleExportLogs}
          >
            Exportar historial
          </button>

          <input
            className="form-input"
            type="date"
            value={cleanupDate}
            onChange={(e) =>
              setCleanupDate(e.target.value)
            }
          />

          <button
            className="btn-danger"
            type="button"
            disabled={
              cleanupLoading ||
              !cleanupDate
            }
            onClick={() =>
              cleanupLogs(false)
            }
          >
            Limpiar anteriores
          </button>

          <button
            className="btn-danger"
            type="button"
            disabled={cleanupLoading}
            onClick={() =>
              cleanupLogs(true)
            }
          >
            Limpiar todo
          </button>
        </div>

        {
          successMessage && (
            <p className="form-success">
              {successMessage}
            </p>
          )
        }

        <div className="whatsapp-chat-layout">
          <aside className="whatsapp-conversation-list">
            <input
              className="form-input whatsapp-conversation-search"
              placeholder="Buscar por telefono o mensaje"
              value={conversationSearch}
              onChange={(e) =>
                setConversationSearch(e.target.value)
              }
            />

            {filteredConversations.map((conversation) => (
              <button
                key={conversation.phone}
                className={
                  selectedPhone === conversation.phone
                    ? 'whatsapp-conversation active'
                    : 'whatsapp-conversation'
                }
                type="button"
                onClick={() =>
                  setSelectedPhone(conversation.phone)
                }
              >
                <div className="whatsapp-conversation-avatar">
                  {profilePictures[conversation.phone] ? (
                    <img
                      src={profilePictures[conversation.phone] || ''}
                      alt=""
                    />
                  ) : (
                    <span>
                      {getConversationInitials(conversation.phone)}
                    </span>
                  )}
                </div>

                <div className="whatsapp-conversation-body">
                  <strong>
                    {formatWhatsappPhone(conversation.phone)}
                  </strong>
                  <span>
                    {conversation.last_message || 'Sin mensajes'}
                  </span>
                  <small>
                    {conversation.last_message_at
                      ? new Date(conversation.last_message_at)
                        .toLocaleString('es-AR')
                      : '-'}
                  </small>
                </div>
              </button>
            ))}

            {filteredConversations.length === 0 && (
              <p className="page-subtitle">
                {conversations.length === 0
                  ? 'Todavia no hay conversaciones.'
                  : 'No hay conversaciones con ese filtro.'}
              </p>
            )}
          </aside>

          <section className="whatsapp-chat-panel">
            <div className="whatsapp-chat-header">
              <div className="whatsapp-chat-avatar">
                {selectedPhone && profilePictures[selectedPhone] ? (
                  <img
                    src={profilePictures[selectedPhone] || ''}
                    alt=""
                  />
                ) : (
                  <span>
                    {selectedPhone
                      ? getConversationInitials(selectedPhone)
                      : 'WA'}
                  </span>
                )}
              </div>

              <div>
                <strong>
                  {selectedPhone
                    ? formatWhatsappPhone(selectedPhone)
                    : 'Selecciona una conversacion'}
                </strong>
                {selectedPhone && (
                  <small>
                    WhatsApp
                  </small>
                )}
              </div>
            </div>

            <div className="whatsapp-chat-messages">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.direction === 'outgoing'
                      ? 'whatsapp-bubble outgoing'
                      : 'whatsapp-bubble incoming'
                  }
                >
                  <p>{message.message}</p>
                  <small>
                    {new Date(message.created_at)
                      .toLocaleString('es-AR')}
                    {message.source === 'manual'
                      ? ' · manual'
                      : ''}
                  </small>
                </div>
              ))}

              {selectedPhone && chatMessages.length === 0 && (
                <p className="page-subtitle">
                  No hay mensajes para esta conversacion.
                </p>
              )}
            </div>

            <div className="whatsapp-chat-compose">
              <textarea
                className="form-input"
                rows={3}
                placeholder="Escribir respuesta manual"
                value={manualMessage}
                disabled={!selectedPhone}
                onChange={(e) =>
                  setManualMessage(e.target.value)
                }
              />

              <button
                className="btn-primary"
                type="button"
                disabled={
                  !selectedPhone ||
                  !manualMessage.trim()
                }
                onClick={sendManualMessage}
              >
                Enviar
              </button>
            </div>
          </section>
        </div>
      </section>
      )}

      {
        error && (
          <p className="auth-error">
            {error}
          </p>
        )
      }

    </div>
  );
}
