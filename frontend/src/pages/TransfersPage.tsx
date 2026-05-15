import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';

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

type Trip = {
  id: number;
  trip_type: string;
  ambulance_id: number | null;
  driver_id: number | null;
  scheduled_datetime: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  status: string;
  notes: string | null;
  ambulance_code: string | null;
  ambulance_plate: string | null;
  driver_name: string | null;
};

type Transfer = {
  id: number;
  patient_name: string;
  origin_address: string;
  destination_address: string;
  destination_type: string;
  transfer_date: string;
  requires_return: boolean;
  status: string;
  notes: string | null;
  trips: Trip[];
};

const emptyForm = {
  patient_name: '',
  origin_address: '',
  destination_address: '',
  destination_type: 'hospital',
  transfer_date: '',
  notes: '',
  requires_return: false,
  outbound_scheduled_datetime: '',
  outbound_ambulance_id: '',
  outbound_driver_id: '',
  return_scheduled_datetime: '',
  return_ambulance_id: '',
  return_driver_id: ''
};

function toDate(
  value: string
) {

  return String(value)
    .slice(0, 10);
}

function toInputDateTime(
  value: string | null
) {

  if (!value) {
    return '';
  }

  return String(value)
    .replace(' ', 'T')
    .slice(0, 16);
}

function formatDateTime(
  value: string | null
) {

  if (!value) {
    return 'Sin horario';
  }

  return new Date(value)
    .toLocaleString('es-AR');
}

function EditTripModal({
  trip,
  ambulances,
  drivers,
  onClose,
  onUpdated
}: {
  trip: Trip;
  ambulances: Ambulance[];
  drivers: Driver[];
  onClose: () => void;
  onUpdated: () => void;
}) {

  const [form, setForm] =
    useState({
      ambulance_id:
        trip.ambulance_id
          ? String(trip.ambulance_id)
          : '',
      driver_id:
        trip.driver_id
          ? String(trip.driver_id)
          : '',
      scheduled_datetime:
        toInputDateTime(
          trip.scheduled_datetime
        ),
      departure_datetime:
        toInputDateTime(
          trip.departure_datetime
        ),
      arrival_datetime:
        toInputDateTime(
          trip.arrival_datetime
        ),
      status:
        trip.status,
      notes:
        trip.notes || ''
    });

  const [error, setError] =
    useState('');

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        `/transfer-trips/${trip.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...form,
            ambulance_id:
              form.ambulance_id
                ? Number(form.ambulance_id)
                : null,
            driver_id:
              form.driver_id
                ? Number(form.driver_id)
                : null
          })
        }
      );

      onUpdated();
      onClose();

    } catch (error: any) {

      setError(error.message);
    }
  }

  return (

    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">
          Editar viaje {trip.trip_type}
        </h2>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
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

          <input
            className="form-input"
            type="datetime-local"
            name="scheduled_datetime"
            value={form.scheduled_datetime}
            onChange={handleChange}
          />

          <input
            className="form-input"
            type="datetime-local"
            name="departure_datetime"
            value={form.departure_datetime}
            onChange={handleChange}
          />

          <input
            className="form-input"
            type="datetime-local"
            name="arrival_datetime"
            value={form.arrival_datetime}
            onChange={handleChange}
          />

          <select
            className="form-input"
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="pendiente">
              Pendiente
            </option>
            <option value="asignado">
              Asignado
            </option>
            <option value="en_camino">
              En camino
            </option>
            <option value="completado">
              Completado
            </option>
            <option value="cancelado">
              Cancelado
            </option>
          </select>

          <textarea
            className="form-input"
            name="notes"
            placeholder="Notas"
            value={form.notes}
            onChange={handleChange}
            rows={3}
          />

          {
            error && (
              <p className="auth-error">
                {error}
              </p>
            )
          }

          <div className="modal-actions">
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
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPage() {

  const [transfers, setTransfers] =
    useState<Transfer[]>([]);

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

  const [ambulances, setAmbulances] =
    useState<Ambulance[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [selectedTrip, setSelectedTrip] =
    useState<Trip | null>(null);

  const [error, setError] =
    useState('');

  async function loadData() {

    try {

      const [
        transferRes,
        driverRes,
        ambulanceRes
      ] = await Promise.all([
        apiFetch('/transfers'),
        apiFetch('/drivers'),
        apiFetch('/ambulances')
      ]);

      setTransfers(transferRes.data);
      setDrivers(driverRes.data);
      setAmbulances(ambulanceRes.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    const target =
      e.target as HTMLInputElement;

    setForm({
      ...form,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        '/transfers',
        {
          method: 'POST',
          body: JSON.stringify({
            patient_name:
              form.patient_name,
            origin_address:
              form.origin_address,
            destination_address:
              form.destination_address,
            destination_type:
              form.destination_type,
            transfer_date:
              form.transfer_date,
            notes:
              form.notes,
            requires_return:
              form.requires_return,
            outbound_trip: {
              scheduled_datetime:
                form.outbound_scheduled_datetime,
              ambulance_id:
                form.outbound_ambulance_id
                  ? Number(form.outbound_ambulance_id)
                  : null,
              driver_id:
                form.outbound_driver_id
                  ? Number(form.outbound_driver_id)
                  : null
            },
            return_trip: {
              scheduled_datetime:
                form.return_scheduled_datetime,
              ambulance_id:
                form.return_ambulance_id
                  ? Number(form.return_ambulance_id)
                  : null,
              driver_id:
                form.return_driver_id
                  ? Number(form.return_driver_id)
                  : null
            }
          })
        }
      );

      setForm(emptyForm);
      loadData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function updateRequestStatus(
    id: number,
    status: string
  ) {

    await apiFetch(
      `/transfers/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );

    loadData();
  }

  useEffect(() => {

    loadData();

  }, []);

  return (

    <div>

      <TransfersNav />

      <div className="page-header">
        <div>
          <h1 className="page-title">
            Traslados
          </h1>
          <p className="page-subtitle">
            Solicitudes con viajes separados de ida y vuelta.
          </p>
        </div>
      </div>

      <form
        className="transfer-form"
        onSubmit={handleSubmit}
      >
        <input
          className="form-input"
          name="patient_name"
          placeholder="Paciente"
          value={form.patient_name}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="transfer_date"
          type="date"
          value={form.transfer_date}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="origin_address"
          placeholder="Origen"
          value={form.origin_address}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="destination_address"
          placeholder="Destino"
          value={form.destination_address}
          onChange={handleChange}
        />

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

        <input
          className="form-input"
          name="outbound_scheduled_datetime"
          type="datetime-local"
          value={form.outbound_scheduled_datetime}
          onChange={handleChange}
        />

        <select
          className="form-input"
          name="outbound_ambulance_id"
          value={form.outbound_ambulance_id}
          onChange={handleChange}
        >
          <option value="">
            Ambulancia ida
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

        <select
          className="form-input"
          name="outbound_driver_id"
          value={form.outbound_driver_id}
          onChange={handleChange}
        >
          <option value="">
            Chofer ida
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

        <label className="checkbox-row">
          <input
            type="checkbox"
            name="requires_return"
            checked={form.requires_return}
            onChange={handleChange}
          />
          Requiere vuelta
        </label>

        {
          form.requires_return && (
            <>
              <input
                className="form-input"
                name="return_scheduled_datetime"
                type="datetime-local"
                value={form.return_scheduled_datetime}
                onChange={handleChange}
              />

              <select
                className="form-input"
                name="return_ambulance_id"
                value={form.return_ambulance_id}
                onChange={handleChange}
              >
                <option value="">
                  Ambulancia vuelta
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

              <select
                className="form-input"
                name="return_driver_id"
                value={form.return_driver_id}
                onChange={handleChange}
              >
                <option value="">
                  Chofer vuelta
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
            </>
          )
        }

        <textarea
          className="form-input transfer-notes"
          name="notes"
          placeholder="Notas"
          value={form.notes}
          onChange={handleChange}
          rows={3}
        />

        <button
          className="btn-success"
          type="submit"
        >
          Crear traslado
        </button>
      </form>

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
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Destino</th>
              <th>Estado</th>
              <th>Viajes</th>
              <th>Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td>
                  {toDate(transfer.transfer_date)}
                </td>
                <td>
                  {transfer.patient_name}
                </td>
                <td>
                  {transfer.destination_type}
                  <br />
                  {transfer.destination_address}
                </td>
                <td>{transfer.status}</td>
                <td>
                  <div className="trip-list">
                    {transfer.trips.map((trip) => (
                      <div
                        className="trip-item"
                        key={trip.id}
                      >
                        <strong>
                          {trip.trip_type}
                        </strong>
                        <span>
                          {formatDateTime(
                            trip.scheduled_datetime
                          )}
                        </span>
                        <span>
                          {trip.ambulance_code || 'Sin ambulancia'}
                          {' / '}
                          {trip.driver_name || 'Sin chofer'}
                        </span>
                        <span>
                          Estado: {trip.status}
                        </span>
                        <button
                          className="btn-secondary"
                          onClick={() =>
                            setSelectedTrip(trip)
                          }
                        >
                          Editar viaje
                        </button>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <select
                    className="form-input"
                    value={transfer.status}
                    onChange={(e) =>
                      updateRequestStatus(
                        transfer.id,
                        e.target.value
                      )
                    }
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="programado">Programado</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {
        selectedTrip && (
          <EditTripModal
            trip={selectedTrip}
            ambulances={ambulances}
            drivers={drivers}
            onClose={() =>
              setSelectedTrip(null)
            }
            onUpdated={loadData}
          />
        )
      }

    </div>
  );
}
