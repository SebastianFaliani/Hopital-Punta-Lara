import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';
import { hasPermission }
  from '../auth/permissions';
import {
  formatDisplayDate,
  formatDisplayDateTime,
  toDateInputValue
} from '../utils/dateFormat';

import TransfersNav
  from '../components/transfers/TransfersNav';

type Driver = {
  id: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type AvailableDriver = Driver & {
  ambulance_id: number;
  ambulance_code: string;
  ambulance_plate: string;
};

type Facility = {
  id: number;
  name: string;
  is_active: boolean;
};

type Trip = {
  id: number;
  transfer_request_id: number;
  trip_type: 'ida' | 'vuelta';
  ambulance_id: number | null;
  driver_id: number | null;
  scheduled_datetime: string | null;
  scheduled_end_datetime: string | null;
  estimated_duration_minutes: number;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  status: string;
  notes: string | null;
  ambulance_code: string | null;
  ambulance_plate: string | null;
  driver_name: string | null;
  capacity_exception?: boolean;
  request?: Transfer;
};

type Transfer = {
  id: number;
  request_type: string;
  facility_id: number | null;
  facility_name: string | null;
  patient_name: string;
  patient_document: string | null;
  patient_phone: string | null;
  origin_address: string;
  destination_address: string;
  destination_type: string;
  transfer_date: string;
  appointment_datetime: string | null;
  service_name: string | null;
  mobility_type: string;
  mobility_notes: string | null;
  justification: string | null;
  requester_name: string | null;
  requester_role: string | null;
  requester_phone: string | null;
  requires_return: boolean;
  is_advance_exception: boolean;
  exception_reason: string | null;
  status: string;
  notes: string | null;
  created_by_name: string | null;
  confirmed_by_name: string | null;
  recurring_template_id?: number | null;
  trips: Trip[];
};

type RecurringTransfer = {
  id: number;
  facility_id: number | null;
  patient_document: string | null;
  patient_phone: string | null;
  origin_address: string;
  patient_name: string;
  destination_type: string;
  destination_address: string;
  service_name: string | null;
  mobility_type: string;
  mobility_notes: string | null;
  justification: string | null;
  requester_name: string | null;
  requester_role: string | null;
  requester_phone: string | null;
  weekdays: string;
  start_date: string;
  end_date: string | null;
  outbound_time: string;
  outbound_duration_minutes: number;
  requires_return: boolean;
  return_time: string | null;
  return_duration_minutes: number;
  notes: string | null;
  is_active: boolean;
};

type CapacityRule = {
  id: number;
  start_time: string;
  end_time: string;
  max_simultaneous: number;
};

type View =
  'agenda' |
  'solicitudes' |
  'recurrentes';

function localDateInputValue(
  date = new Date()
) {
  const pad = (value: number) =>
    String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

const today =
  localDateInputValue();

const emptyForm = {
  request_type: 'programado',
  facility_id: '',
  patient_name: '',
  patient_document: '',
  patient_phone: '',
  origin_address: '',
  destination_address: '',
  destination_type: 'hospital',
  transfer_date: '',
  appointment_time: '',
  service_name: '',
  mobility_type: 'propios_medios',
  mobility_notes: '',
  justification: '',
  requester_name: '',
  requester_role: '',
  requester_phone: '',
  notes: '',
  requires_return: false,
  is_advance_exception: false,
  exception_reason: '',
  outbound_scheduled_datetime: '',
  outbound_duration_minutes: '60',
  return_scheduled_datetime: '',
  return_duration_minutes: '60',
  weekdays: [] as number[],
  start_date: '',
  end_date: '',
  outbound_time: '',
  return_time: ''
};

const weekdayLabels = [
  'Dom',
  'Lun',
  'Mar',
  'Mie',
  'Jue',
  'Vie',
  'Sab'
];

function toDate(value: string) {
  return toDateInputValue(value);
}

function formatDate(value: string | null) {
  return formatDisplayDate(value);
}

function toLocalDateTimeText(
  value: string | null
) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace('T', ' ')
    .slice(0, 19);
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return 'Sin horario';
  }

  const normalized =
    String(value).replace(' ', 'T');

  const [
    ,
    ,
    month,
    day,
    hour,
    minute
  ] =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    ) || [];

  return month
    ? `${day}-${month}-${normalized.slice(0, 4)} ${hour}:${minute}`
    : formatDisplayDateTime(value, 'Sin horario');
}

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) =>
      letter.toUpperCase()
    );
}

function statusClass(status: string) {
  return `transfer-status transfer-status-${status}`;
}

function RequestFormModal({
  recurring,
  transfer,
  recurringTransfer,
  onClose,
  onCreated
}: {
  recurring: boolean;
  transfer?: Transfer | null;
  recurringTransfer?: RecurringTransfer | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const outboundTrip =
    transfer?.trips.find((item) =>
      item.trip_type === 'ida'
    );

  const returnTrip =
    transfer?.trips.find((item) =>
      item.trip_type === 'vuelta'
    );

  const timePart = (
    value: string | null | undefined
  ) =>
    value
      ? toLocalDateTimeText(value)
        .slice(11, 16)
      : '';

  const [form, setForm] =
    useState({
      ...emptyForm,
      request_type:
        transfer?.request_type ||
        (
          recurring
          ? 'recurrente'
          : 'programado'
        ),
      facility_id:
        transfer?.facility_id ||
        recurringTransfer?.facility_id
          ? String(
            transfer?.facility_id ||
            recurringTransfer?.facility_id
          )
          : '',
      patient_name:
        transfer?.patient_name ||
        recurringTransfer?.patient_name ||
        '',
      patient_document:
        transfer?.patient_document ||
        recurringTransfer?.patient_document ||
        '',
      patient_phone:
        transfer?.patient_phone ||
        recurringTransfer?.patient_phone ||
        '',
      origin_address:
        transfer?.origin_address ||
        recurringTransfer?.origin_address ||
        '',
      destination_address:
        transfer?.destination_address ||
        recurringTransfer?.destination_address ||
        '',
      destination_type:
        transfer?.destination_type ||
        recurringTransfer?.destination_type ||
        'hospital',
      transfer_date:
        transfer
          ? toDate(transfer.transfer_date)
          : '',
      appointment_time:
        timePart(
          transfer?.appointment_datetime
        ),
      service_name:
        transfer?.service_name ||
        recurringTransfer?.service_name ||
        '',
      mobility_type:
        transfer?.mobility_type ||
        recurringTransfer?.mobility_type ||
        'propios_medios',
      mobility_notes:
        transfer?.mobility_notes ||
        recurringTransfer?.mobility_notes ||
        '',
      justification:
        transfer?.justification ||
        recurringTransfer?.justification ||
        '',
      requester_name:
        transfer?.requester_name ||
        recurringTransfer?.requester_name ||
        '',
      requester_role:
        transfer?.requester_role ||
        recurringTransfer?.requester_role ||
        '',
      requester_phone:
        transfer?.requester_phone ||
        recurringTransfer?.requester_phone ||
        '',
      notes:
        transfer?.notes ||
        recurringTransfer?.notes ||
        '',
      requires_return:
        Boolean(
          transfer?.requires_return ||
          recurringTransfer?.requires_return
        ),
      is_advance_exception:
        Boolean(
          transfer?.is_advance_exception
        ),
      exception_reason:
        transfer?.exception_reason || '',
      outbound_time:
        recurringTransfer?.outbound_time ||
        timePart(outboundTrip?.scheduled_datetime),
      outbound_duration_minutes:
        String(
          recurringTransfer
            ?.outbound_duration_minutes ||
          outboundTrip
            ?.estimated_duration_minutes || 60
        ),
      return_time:
        recurringTransfer?.return_time ||
        timePart(returnTrip?.scheduled_datetime),
      return_duration_minutes:
        String(
          recurringTransfer
            ?.return_duration_minutes ||
          returnTrip
            ?.estimated_duration_minutes || 60
        ),
      weekdays:
        recurringTransfer
          ? recurringTransfer.weekdays
            .split(',')
            .map(Number)
          : [],
      start_date:
        recurringTransfer
          ? toDate(recurringTransfer.start_date)
          : '',
      end_date:
        recurringTransfer?.end_date
          ? toDate(recurringTransfer.end_date)
          : ''
    });

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  useEffect(() => {
    apiFetch('/health-facilities')
      .then((response) =>
        setFacilities(response.data)
      );
  }, []);

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {
    const target =
      event.target as HTMLInputElement;

    setForm((current) => ({
      ...current,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    }));
  }

  function toggleWeekday(day: number) {
    setForm((current) => ({
      ...current,
      weekdays:
        current.weekdays.includes(day)
          ? current.weekdays.filter(
            (item) => item !== day
          )
          : [...current.weekdays, day]
    }));
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const body = recurring
      ? {
        ...form,
        transfer_date: form.start_date,
        outbound_duration_minutes:
          Number(
            form.outbound_duration_minutes
          ),
        return_duration_minutes:
          Number(
            form.return_duration_minutes
          )
      }
      : {
        ...form,
        appointment_datetime:
          form.appointment_time
            ? `${form.transfer_date} ${form.appointment_time}:00`
            : null,
        outbound_trip: {
          scheduled_datetime:
            `${form.transfer_date} ${form.outbound_time}:00`,
          estimated_duration_minutes:
            Number(
              form.outbound_duration_minutes
            )
        },
        return_trip: {
          scheduled_datetime:
            form.requires_return
              ? `${form.transfer_date} ${form.return_time}:00`
              : null,
          estimated_duration_minutes:
            Number(
              form.return_duration_minutes
            )
        }
      };

    await apiFetch(
      recurring
        ? (
          recurringTransfer
            ? `/transfers/recurring/${recurringTransfer.id}`
            : '/transfers/recurring'
        )
        : (
          transfer
            ? `/transfers/${transfer.id}`
            : '/transfers'
        ),
      {
        method:
          transfer ||
          recurringTransfer
            ? 'PUT'
            : 'POST',
        body: JSON.stringify(body)
      }
    );

    onCreated();
    onClose();
  }

  const needsExceptionReason =
    form.request_type ===
      'oficio_urgente' ||
    form.is_advance_exception;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide transfer-request-modal">
        <button
          className="modal-close-button"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 className="modal-title">
          {recurring
            ? (
              recurringTransfer
                ? 'Editar traslado recurrente'
                : 'Nuevo traslado recurrente'
            )
            : (
              transfer
                ? 'Editar solicitud de traslado'
                : 'Nueva solicitud de traslado'
            )}
        </h2>

        <form
          className="transfer-request-form"
          onSubmit={handleSubmit}
        >
          {!recurring && (
            <label className="form-field">
              <span>Tipo de solicitud</span>
              <select
                className="form-input"
                name="request_type"
                value={form.request_type}
                onChange={handleChange}
              >
                <option value="programado">
                  Programado
                </option>
                <option value="oficio_urgente">
                  Urgente de oficio
                </option>
              </select>
            </label>
          )}

          <label className="form-field">
            <span>Dependencia solicitante</span>
            <select
              className="form-input"
              name="facility_id"
              value={form.facility_id}
              onChange={handleChange}
              required
            >
              <option value="">
                Seleccionar dependencia
              </option>
              {facilities
                .filter((item) => item.is_active)
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="form-field">
            <span>Paciente</span>
            <input
              className="form-input"
              name="patient_name"
              value={form.patient_name}
              onChange={handleChange}
              required
            />
          </label>

          <label className="form-field">
            <span>DNI</span>
            <input
              className="form-input"
              name="patient_document"
              value={form.patient_document}
              onChange={handleChange}
            />
          </label>

          <label className="form-field">
            <span>Telefono del paciente</span>
            <input
              className="form-input"
              name="patient_phone"
              value={form.patient_phone}
              onChange={handleChange}
            />
          </label>

          <label className="form-field transfer-field-wide">
            <span>Origen</span>
            <input
              className="form-input"
              name="origin_address"
              value={form.origin_address}
              onChange={handleChange}
              required
            />
          </label>

          <label className="form-field transfer-field-wide">
            <span>Destino</span>
            <input
              className="form-input"
              name="destination_address"
              value={form.destination_address}
              onChange={handleChange}
              required
            />
          </label>

          <label className="form-field">
            <span>Tipo de destino</span>
            <select
              className="form-input"
              name="destination_type"
              value={form.destination_type}
              onChange={handleChange}
            >
              <option value="hospital">Hospital</option>
              <option value="clinica">Clinica</option>
              <option value="domicilio">Domicilio</option>
              <option value="kinesiologia">Kinesiologia</option>
              <option value="dialisis">Dialisis</option>
              <option value="consultorio">Consultorio</option>
              <option value="otro">Otro</option>
            </select>
          </label>

          <label className="form-field">
            <span>Servicio o especialidad</span>
            <input
              className="form-input"
              name="service_name"
              value={form.service_name}
              onChange={handleChange}
            />
          </label>

          <label className="form-field">
            <span>Movilidad</span>
            <select
              className="form-input"
              name="mobility_type"
              value={form.mobility_type}
              onChange={handleChange}
            >
              <option value="propios_medios">
                Por sus propios medios
              </option>
              <option value="asistencia">
                Requiere asistencia
              </option>
              <option value="silla_ruedas">
                Silla de ruedas
              </option>
              <option value="camilla">
                Camilla
              </option>
              <option value="otro">Otro</option>
            </select>
          </label>

          <label className="form-field transfer-field-wide">
            <span>Detalle de movilidad</span>
            <input
              className="form-input"
              name="mobility_notes"
              value={form.mobility_notes}
              onChange={handleChange}
            />
          </label>

          {recurring ? (
            <>
              <label className="form-field">
                <span>Desde</span>
                <input
                  className="form-input"
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="form-field">
                <span>Hasta, opcional</span>
                <input
                  className="form-input"
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                />
              </label>

              <fieldset className="transfer-weekdays transfer-field-full">
                <legend>Dias semanales</legend>
                {weekdayLabels.map(
                  (label, day) => (
                    <label key={label}>
                      <input
                        type="checkbox"
                        checked={
                          form.weekdays.includes(day)
                        }
                        onChange={() =>
                          toggleWeekday(day)
                        }
                      />
                      {label}
                    </label>
                  )
                )}
              </fieldset>

              <label className="form-field">
                <span>Hora de ida</span>
                <input
                  className="form-input"
                  type="time"
                  name="outbound_time"
                  value={form.outbound_time}
                  onChange={handleChange}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label className="form-field">
                <span>Fecha del traslado</span>
                <input
                  className="form-input"
                  type="date"
                  name="transfer_date"
                  value={form.transfer_date}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="form-field">
                <span>Hora del turno medico</span>
                <input
                  className="form-input"
                  type="time"
                  name="appointment_time"
                  value={form.appointment_time}
                  onChange={handleChange}
                />
              </label>

              <label className="form-field">
                <span>Busqueda para la ida</span>
                <input
                  className="form-input"
                  type="time"
                  name="outbound_time"
                  value={form.outbound_time}
                  onChange={handleChange}
                  required
                />
              </label>
            </>
          )}

          <label className="form-field">
            <span>Duracion estimada de ida, minutos</span>
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              name="outbound_duration_minutes"
              value={form.outbound_duration_minutes}
              onChange={handleChange}
              required
            />
          </label>

          <label className="checkbox-row transfer-field-full transfer-checkbox-wide">
            <input
              type="checkbox"
              name="requires_return"
              checked={form.requires_return}
              onChange={handleChange}
            />
            Requiere viaje de vuelta
          </label>

          {form.requires_return && (
            <>
              <label className="form-field">
                <span>
                  {recurring
                    ? 'Hora de vuelta'
                    : 'Busqueda para la vuelta'}
                </span>
                <input
                  className="form-input"
                  type="time"
                  name={
                    'return_time'
                  }
                  value={form.return_time}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="form-field">
                <span>Duracion estimada de vuelta, minutos</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="1"
                  name="return_duration_minutes"
                  value={form.return_duration_minutes}
                  onChange={handleChange}
                />
              </label>
            </>
          )}

          <label className="form-field">
            <span>Solicitado por</span>
            <input
              className="form-input"
              name="requester_name"
              value={form.requester_name}
              onChange={handleChange}
            />
          </label>

          <label className="form-field">
            <span>Cargo o funcion</span>
            <input
              className="form-input"
              name="requester_role"
              value={form.requester_role}
              onChange={handleChange}
            />
          </label>

          <label className="form-field">
            <span>Telefono del solicitante</span>
            <input
              className="form-input"
              name="requester_phone"
              value={form.requester_phone}
              onChange={handleChange}
            />
          </label>

          <label className="form-field transfer-field-full">
            <span>Justificacion del traslado</span>
            <textarea
              className="form-input"
              name="justification"
              value={form.justification}
              onChange={handleChange}
              rows={3}
            />
          </label>

          {!recurring &&
            form.request_type !==
              'oficio_urgente' && (
              <label className="checkbox-row transfer-field-full">
                <input
                  type="checkbox"
                  name="is_advance_exception"
                  checked={
                    form.is_advance_exception
                  }
                  onChange={handleChange}
                />
                Autorizar excepcion al dia minimo de anticipacion
              </label>
            )}

          {needsExceptionReason && (
            <label className="form-field transfer-field-full">
              <span>
                Motivo obligatorio de la excepcion
              </span>
              <textarea
                className="form-input"
                name="exception_reason"
                value={form.exception_reason}
                onChange={handleChange}
                rows={2}
                required
              />
            </label>
          )}

          <label className="form-field transfer-field-full">
            <span>Observaciones internas</span>
            <textarea
              className="form-input"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
            />
          </label>

          <div className="modal-actions transfer-field-full">
            <button
              className="btn-secondary"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="btn-success"
              type="submit"
            >
              Guardar solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTripModal({
  trip,
  onClose,
  onUpdated
}: {
  trip: Trip;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] =
    useState({
      driver_id:
        trip.driver_id
          ? String(trip.driver_id)
          : '',
      capacity_exception_reason: ''
    });

  const [
    availableDrivers,
    setAvailableDrivers
  ] = useState<AvailableDriver[]>([]);

  const [loadingDrivers, setLoadingDrivers] =
    useState(true);

  useEffect(() => {
    setLoadingDrivers(true);

    apiFetch(
      `/transfer-trips/${trip.id}/available-drivers`
    )
      .then((response) =>
        setAvailableDrivers(response.data)
      )
      .finally(() =>
        setLoadingDrivers(false)
      );
  }, [trip.id]);

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {
    const target =
      event.target as HTMLInputElement;

    setForm((current) => ({
      ...current,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    }));
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    await apiFetch(
      `/transfer-trips/${trip.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          driver_id:
            form.driver_id
              ? Number(form.driver_id)
              : null
        })
      }
    );

    onUpdated();
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <button
          className="modal-close-button"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 className="modal-title">
          Chofer del viaje de {trip.trip_type}
        </h2>

        <p className="modal-subtitle">
          Horario: {formatDateTime(trip.scheduled_datetime)}
          {' · '}
          Ambulancia segun guardia del chofer.
        </p>

        <form
          className="transfer-request-form"
          onSubmit={handleSubmit}
        >
          <label className="form-field">
            <span>Chofer</span>
            <select
              className="form-input"
              name="driver_id"
              value={form.driver_id}
              onChange={handleChange}
              disabled={loadingDrivers}
            >
              <option value="">
                {loadingDrivers
                  ? 'Buscando choferes disponibles'
                  : 'Sin chofer asignado'}
              </option>
              {availableDrivers
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.first_name} {item.last_name}
                    {' - '}
                    {item.ambulance_code} / {item.ambulance_plate}
                  </option>
                ))}
            </select>
          </label>

          {!loadingDrivers &&
            availableDrivers.length === 0 && (
              <p className="auth-error transfer-field-full">
                No hay choferes disponibles para este horario. Revisa las guardias o los traslados superpuestos.
              </p>
            )}

          <div className="modal-actions transfer-field-full">
            <button
              className="btn-secondary"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              type="submit"
              disabled={loadingDrivers}
            >
              Guardar chofer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'transfers.manage',
      ['admin', 'user']
    );

  const [view, setView] =
    useState<View>('agenda');

  const [agendaDate, setAgendaDate] =
    useState(today);

  const [transfers, setTransfers] =
    useState<Transfer[]>([]);

  const [agendaTrips, setAgendaTrips] =
    useState<Trip[]>([]);

  const [capacityRules, setCapacityRules] =
    useState<CapacityRule[]>([]);

  const [recurring, setRecurring] =
    useState<RecurringTransfer[]>([]);

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [selectedTrip, setSelectedTrip] =
    useState<Trip | null>(null);

  const [
    selectedTransfer,
    setSelectedTransfer
  ] = useState<Transfer | null>(null);

  const [
    selectedRecurring,
    setSelectedRecurring
  ] = useState<RecurringTransfer | null>(null);

  const [showRequestForm, setShowRequestForm] =
    useState(false);

  const [showRecurringForm, setShowRecurringForm] =
    useState(false);

  const [filters, setFilters] =
    useState({
      search: '',
      status: '',
      request_type: '',
      facility_id: '',
      date_from: '',
      date_to: ''
    });

  async function loadCatalogs() {
    const [facilityRes] =
      await Promise.all([
        apiFetch('/health-facilities')
      ]);

    setFacilities(facilityRes.data);
  }

  async function loadTransfers() {
    const params =
      new URLSearchParams();

    Object.entries(filters)
      .forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

    const response =
      await apiFetch(
        `/transfers?${params.toString()}`
      );

    setTransfers(response.data);
  }

  async function loadAgenda() {
    const response =
      await apiFetch(
        `/transfers/overview?date=${agendaDate}`
      );

    setAgendaTrips(response.data.trips);
    setCapacityRules(response.data.rules);
  }

  async function loadRecurring() {
    const response =
      await apiFetch('/transfers/recurring');

    setRecurring(response.data);
  }

  async function refreshAll() {
    await Promise.all([
      loadTransfers(),
      loadAgenda(),
      loadRecurring()
    ]);
  }

  async function updateRequestStatus(
    id: number,
    status: string
  ) {
    let reason = '';

    if (status === 'rechazado') {
      reason =
        window.prompt(
          'Indica el motivo del rechazo'
        ) || '';

      if (!reason) {
        return;
      }
    }

    await apiFetch(
      `/transfers/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reason
        })
      }
    );

    refreshAll();
  }

  async function toggleRecurring(
    item: RecurringTransfer
  ) {
    await apiFetch(
      `/transfers/recurring/${item.id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: !item.is_active
        })
      }
    );

    loadRecurring();
  }

  const pendingCount =
    useMemo(
      () =>
        transfers.filter((item) =>
          item.status ===
          'pendiente_confirmacion'
        ).length,
      [transfers]
    );

  const urgentCount =
    useMemo(
      () =>
        agendaTrips.filter((item) =>
          item.request?.request_type ===
          'oficio_urgente'
        ).length,
      [agendaTrips]
    );

  function maximumConcurrent(
    rule: CapacityRule
  ) {
    const events:
      Array<{
        time: string;
        change: number;
      }> = [];

    agendaTrips.forEach((trip) => {
      if (
        trip.request?.request_type ===
        'oficio_urgente' ||
        !trip.scheduled_datetime
      ) {
        return;
      }

      const start =
        String(trip.scheduled_datetime)
          .slice(11, 16);

      const end =
        trip.scheduled_end_datetime
          ? String(
            trip.scheduled_end_datetime
          ).slice(11, 16)
          : start;

      if (
        start < rule.end_time &&
        end > rule.start_time
      ) {
        events.push(
          { time: start, change: 1 },
          { time: end, change: -1 }
        );
      }
    });

    events.sort((a, b) =>
      a.time === b.time
        ? a.change - b.change
        : a.time.localeCompare(b.time)
    );

    let current = 0;
    let maximum = 0;

    events.forEach((event) => {
      current += event.change;
      maximum = Math.max(
        maximum,
        current
      );
    });

    return maximum;
  }

  function printAgenda() {
    const printWindow =
      window.open('', '_blank');

    if (!printWindow) {
      return;
    }

    apiFetch(
      '/transfers/route-prints',
      {
        method: 'POST',
        body: JSON.stringify({
          route_date: agendaDate
        })
      }
    ).catch(() => undefined);

    const rows =
      agendaTrips.map((trip) => {
        const request =
          trip.request as Transfer;

        return `
          <tr>
            <td>${formatDateTime(trip.scheduled_datetime)}</td>
            <td>
              <strong>${request.patient_name}</strong><br>
              DNI: ${request.patient_document || '-'}<br>
              Tel: ${request.patient_phone || '-'}
            </td>
            <td>${request.origin_address}</td>
            <td>
              ${request.destination_address}<br>
              ${request.service_name || ''}
            </td>
            <td>${trip.trip_type}</td>
            <td>${trip.ambulance_code || 'Sin asignar'}</td>
            <td>${trip.driver_name || 'Sin asignar'}</td>
            <td class="signature"></td>
          </tr>
        `;
      }).join('');

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <title>Hoja de ruta ${agendaDate}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p { margin: 4px 0 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #111; padding: 6px; vertical-align: top; }
            th { background: #eee; }
            .signature { min-width: 105px; height: 64px; }
            .notes { margin-top: 18px; border: 1px solid #111; min-height: 100px; padding: 8px; }
            @page { size: landscape; margin: 12mm; }
          </style>
        </head>
        <body>
          <h1>Hospital Municipal de Punta Lara - Hoja diaria de traslados</h1>
          <p>Fecha: ${agendaDate}</p>
          <table>
            <thead>
              <tr>
                <th>Horario</th>
                <th>Paciente</th>
                <th>Origen</th>
                <th>Destino / Servicio</th>
                <th>Viaje</th>
                <th>Ambulancia</th>
                <th>Chofer</th>
                <th>Conformidad y firma</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8">Sin traslados</td></tr>'}</tbody>
          </table>
          <div class="notes">
            <strong>Disconformidades u observaciones:</strong>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  useEffect(() => {
    loadCatalogs();
    loadTransfers();
    loadRecurring();
  }, []);

  useEffect(() => {
    loadAgenda();
  }, [agendaDate]);

  useEffect(() => {
    loadTransfers();
  }, [
    filters.search,
    filters.status,
    filters.request_type,
    filters.facility_id,
    filters.date_from,
    filters.date_to
  ]);

  return (
    <div>
      <TransfersNav />

      <div className="page-header">
        <div>
          <h1 className="page-title">
            Gestion de traslados
          </h1>
          <p className="page-subtitle">
            Solicitudes, confirmacion de cupos y agenda operativa.
          </p>
        </div>

        {canEdit && (
          <button
            className="btn-primary"
            type="button"
            onClick={() =>
              setShowRequestForm(true)
            }
          >
            + Nueva solicitud
          </button>
        )}
      </div>

      <div className="transfer-summary-grid">
        <div className="transfer-summary">
          <strong>{agendaTrips.length}</strong>
          <span>Viajes del dia</span>
        </div>
        <div className="transfer-summary">
          <strong>{pendingCount}</strong>
          <span>Pendientes de confirmar</span>
        </div>
        <div className="transfer-summary">
          <strong>{urgentCount}</strong>
          <span>Urgentes de oficio hoy</span>
        </div>
      </div>

      <div className="module-tabs transfer-view-tabs">
        {([
          ['agenda', 'Agenda diaria'],
          ['solicitudes', 'Solicitudes'],
          ['recurrentes', 'Recurrentes']
        ] as Array<[View, string]>)
          .map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                view === key
                  ? 'module-tab module-tab-active'
                  : 'module-tab'
              }
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
      </div>

      {view === 'agenda' && (
        <>
          <div className="transfer-toolbar">
            <label className="form-field">
              <span>Fecha de agenda</span>
              <input
                className="form-input"
                type="date"
                value={agendaDate}
                onChange={(event) =>
                  setAgendaDate(
                    event.target.value
                  )
                }
              />
            </label>

            <button
              className="btn-secondary"
              type="button"
              onClick={printAgenda}
            >
              Imprimir hoja diaria
            </button>
          </div>

          <div className="transfer-capacity-grid">
            {capacityRules.map((rule) => {
              const occupied =
                maximumConcurrent(rule);

              return (
                <div
                  className="transfer-capacity"
                  key={rule.id}
                >
                  <span>
                    {rule.start_time} a {rule.end_time}
                  </span>
                  <strong>
                    {occupied} / {rule.max_simultaneous}
                  </strong>
                  <small>
                    maxima superposicion del turno
                  </small>
                </div>
              );
            })}
          </div>

          <div className="transfer-agenda-list">
            {agendaTrips.map((trip) => {
              const request =
                trip.request as Transfer;

              return (
                <article
                  className="transfer-agenda-row"
                  key={trip.id}
                >
                  <div className="transfer-agenda-time">
                    {formatDateTime(
                      trip.scheduled_datetime
                    ).slice(-5)}
                  </div>

                  <div>
                    <strong>
                      {request.patient_name}
                    </strong>
                    <span>
                      {trip.trip_type} · {request.service_name || request.destination_type}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {request.origin_address}
                    </strong>
                    <span>
                      hacia {request.destination_address}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {trip.ambulance_code || 'Sin ambulancia'}
                    </strong>
                    <span>
                      {trip.driver_name || 'Sin chofer'}
                    </span>
                  </div>

                  <span className={statusClass(request.status)}>
                    {humanize(request.status)}
                  </span>

                  {canEdit && (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        setSelectedTrip(trip)
                      }
                    >
                      {trip.driver_id
                        ? 'Cambiar'
                        : 'Asignar'}
                    </button>
                  )}
                </article>
              );
            })}

            {agendaTrips.length === 0 && (
              <div className="empty-state">
                No hay viajes para esta fecha.
              </div>
            )}
          </div>
        </>
      )}

      {view === 'solicitudes' && (
        <>
          <div className="transfer-filter-grid">
            <input
              className="form-input"
              placeholder="Buscar paciente, DNI, destino o solicitante"
              value={filters.search}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  search: event.target.value
                })
              }
            />

            <select
              className="form-input"
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value
                })
              }
            >
              <option value="">Todos los estados</option>
              <option value="pendiente_confirmacion">
                Pendientes de confirmacion
              </option>
              <option value="confirmado">Confirmados</option>
              <option value="rechazado">Rechazados</option>
              <option value="cancelado">Cancelados</option>
              <option value="finalizado">Finalizados</option>
            </select>

            <select
              className="form-input"
              value={filters.request_type}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  request_type:
                    event.target.value
                })
              }
            >
              <option value="">Todos los tipos</option>
              <option value="programado">Programados</option>
              <option value="recurrente">Recurrentes</option>
              <option value="oficio_urgente">
                Urgentes de oficio
              </option>
            </select>

            <select
              className="form-input"
              value={filters.facility_id}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  facility_id:
                    event.target.value
                })
              }
            >
              <option value="">
                Todas las dependencias
              </option>
              {facilities
                .filter((item) => item.is_active)
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
            </select>

            <label className="form-field">
              <span>Desde</span>
              <input
                className="form-input"
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    date_from:
                      event.target.value
                  })
                }
              />
            </label>

            <label className="form-field">
              <span>Hasta</span>
              <input
                className="form-input"
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    date_to:
                      event.target.value
                  })
                }
              />
            </label>

            <button
              className="btn-secondary"
              type="button"
              onClick={() =>
                setFilters({
                  search: '',
                  status: '',
                  request_type: '',
                  facility_id: '',
                  date_from: '',
                  date_to: ''
                })
              }
            >
              Limpiar filtros
            </button>
          </div>

          <div className="transfer-request-list">
            {transfers.map((transfer) => (
              <article
                className="transfer-request-row"
                key={transfer.id}
              >
                <div className="transfer-request-heading">
                  <div>
                    <strong>
                      {transfer.patient_name}
                    </strong>
                    <span>
                      {formatDate(transfer.transfer_date)} · {humanize(transfer.request_type)}
                    </span>
                  </div>
                  <span className={statusClass(transfer.status)}>
                    {humanize(transfer.status)}
                  </span>
                </div>

                <div className="transfer-request-details">
                  <span>
                    <strong>Destino:</strong> {transfer.destination_address}
                  </span>
                  <span>
                    <strong>Servicio:</strong> {transfer.service_name || '-'}
                  </span>
                  <span>
                    <strong>Solicita:</strong> {transfer.requester_name || transfer.created_by_name || '-'}
                  </span>
                  <span>
                    <strong>Dependencia:</strong> {transfer.facility_name || '-'}
                  </span>
                  <span>
                    <strong>Movilidad:</strong> {humanize(transfer.mobility_type)}
                  </span>
                </div>

                <div className="transfer-request-trips">
                  {transfer.trips.map((trip) => (
                    <button
                      type="button"
                      className="transfer-trip-chip"
                      key={trip.id}
                      onClick={() =>
                        canEdit &&
                        setSelectedTrip(trip)
                      }
                    >
                      <strong>{trip.trip_type}</strong>
                      <span>
                        {formatDateTime(trip.scheduled_datetime)}
                      </span>
                      <span>
                        {trip.ambulance_code || 'Sin asignar'}
                      </span>
                    </button>
                  ))}
                </div>

                {canEdit && (
                  <div className="transfer-request-actions">
                    {transfer.status ===
                      'pendiente_confirmacion' &&
                      !transfer.recurring_template_id && (
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() =>
                          setSelectedTransfer(
                            transfer
                          )
                        }
                      >
                        Editar solicitud
                      </button>
                    )}

                    {transfer.status ===
                      'pendiente_confirmacion' &&
                      transfer.recurring_template_id && (
                      <span className="transfer-action-note">
                        Recurrente: editar desde la pestana Recurrentes
                      </span>
                    )}

                    {transfer.status ===
                      'pendiente_confirmacion' && (
                      <>
                        <button
                          className="btn-success"
                          type="button"
                          onClick={() =>
                            updateRequestStatus(
                              transfer.id,
                              'confirmado'
                            )
                          }
                        >
                          Confirmar
                        </button>
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() =>
                            updateRequestStatus(
                              transfer.id,
                              'rechazado'
                            )
                          }
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    {user?.role === 'admin' &&
                      transfer.status ===
                      'confirmado' && (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Esta solicitud volvera a pendiente y se liberaran los choferes asignados. Continuar?'
                            )
                          ) {
                            updateRequestStatus(
                              transfer.id,
                              'pendiente_confirmacion'
                            );
                          }
                        }}
                      >
                        Volver a pendiente
                      </button>
                    )}

                    {![
                      'cancelado',
                      'finalizado'
                    ].includes(transfer.status) && (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() =>
                          updateRequestStatus(
                            transfer.id,
                            'cancelado'
                          )
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {view === 'recurrentes' && (
        <>
          {canEdit && (
            <div className="transfer-toolbar">
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  setShowRecurringForm(true)
                }
              >
                + Nuevo traslado recurrente
              </button>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Destino</th>
                  <th>Dias</th>
                  <th>Horario</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  {canEdit && <th>Accion</th>}
                </tr>
              </thead>
              <tbody>
                {recurring.map((item) => (
                  <tr key={item.id}>
                    <td>{item.patient_name}</td>
                    <td>
                      {item.destination_address}
                      <br />
                      {item.service_name || ''}
                    </td>
                    <td>
                      {item.weekdays
                        .split(',')
                        .map((day) =>
                          weekdayLabels[
                            Number(day)
                          ]
                        )
                        .join(', ')}
                    </td>
                    <td>
                      Ida {item.outbound_time}
                      {item.return_time &&
                        ` / Vuelta ${item.return_time}`}
                    </td>
                    <td>
                      {formatDate(item.start_date)}
                      {' a '}
                      {item.end_date
                        ? formatDate(item.end_date)
                        : 'sin fin'}
                    </td>
                    <td>
                      {item.is_active
                        ? 'Activo'
                        : 'Pausado'}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() =>
                            setSelectedRecurring(item)
                          }
                        >
                          Editar
                        </button>
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() =>
                            toggleRecurring(item)
                          }
                        >
                          {item.is_active
                            ? 'Pausar'
                            : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedTrip && canEdit && (
        <EditTripModal
          trip={selectedTrip}
          onClose={() =>
            setSelectedTrip(null)
          }
          onUpdated={refreshAll}
        />
      )}

      {showRequestForm && canEdit && (
        <RequestFormModal
          recurring={false}
          transfer={null}
          onClose={() =>
            setShowRequestForm(false)
          }
          onCreated={refreshAll}
        />
      )}

      {showRecurringForm && canEdit && (
        <RequestFormModal
          recurring
          transfer={null}
          recurringTransfer={null}
          onClose={() =>
            setShowRecurringForm(false)
          }
          onCreated={refreshAll}
        />
      )}

      {selectedRecurring && canEdit && (
        <RequestFormModal
          recurring
          recurringTransfer={selectedRecurring}
          transfer={null}
          onClose={() =>
            setSelectedRecurring(null)
          }
          onCreated={refreshAll}
        />
      )}

      {selectedTransfer && canEdit && (
        <RequestFormModal
          recurring={false}
          transfer={selectedTransfer}
          onClose={() =>
            setSelectedTransfer(null)
          }
          onCreated={refreshAll}
        />
      )}
    </div>
  );
}
