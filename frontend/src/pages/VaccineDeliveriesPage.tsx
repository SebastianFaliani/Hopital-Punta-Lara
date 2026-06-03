import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  apiFetch
} from '../api/api';

import {
  useAuth
} from '../auth/useAuth';
import VaccineModuleTabs from '../components/vaccines/VaccineModuleTabs';

type Facility = {
  id: number;
  name: string;
  facility_type: string;
};

type FacilityStock = {
  vaccine_batch_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  vaccine_name: string;
  target_disease: string | null;
  presentation: string | null;
  dose_unit: string | null;
};

type Delivery = {
  id: number;
  facility_name: string;
  delivery_date: string;
  patient_name: string;
  patient_document: string | null;
  patient_phone: string | null;
  delivery_reason: string;
  status: string;
  notes: string | null;
  created_by_name: string | null;
  cancelled_at: string | null;
  item_count: number;
  total_quantity: number;
};

type DeliveryDetail = Delivery & {
  items: Array<{
    id: number;
    vaccine_batch_id: number;
    vaccine_name: string;
    target_disease: string | null;
    presentation: string | null;
    dose_unit: string | null;
    batch_number: string;
    expiration_date: string;
    quantity: number;
  }>;
};

type DeliveryItemForm = {
  vaccine_batch_id: string;
  quantity: number;
};

const reasonLabels: Record<string, string> = {
  aplicacion: 'Aplicacion',
  campania: 'Campania',
  refuerzo: 'Refuerzo',
  otro: 'Otro'
};

const statusLabels: Record<string, string> = {
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

function todayInputValue() {

  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value: string
) {

  return new Date(value)
    .toLocaleDateString('es-AR');
}

function stockLabel(
  stock: FacilityStock
) {

  return [
    stock.vaccine_name,
    stock.target_disease,
    stock.presentation,
    stock.dose_unit,
    `lote ${stock.batch_number}`,
    `stock ${Number(stock.current_stock)}`
  ]
    .filter(Boolean)
    .join(' - ');
}

export default function VaccineDeliveriesPage() {

  const { user } =
    useAuth();

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'vacu';

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [facilityStocks, setFacilityStocks] =
    useState<FacilityStock[]>([]);

  const [deliveries, setDeliveries] =
    useState<Delivery[]>([]);

  const [selectedDelivery, setSelectedDelivery] =
    useState<DeliveryDetail | null>(null);

  const [filters, setFilters] =
    useState({
      status: 'todos',
      reason: 'todos',
      facility_id: '',
      search: '',
      date_from: '',
      date_to: ''
    });

  const [form, setForm] =
    useState({
      facility_id: '',
      delivery_date: todayInputValue(),
      patient_name: '',
      patient_document: '',
      patient_phone: '',
      delivery_reason: 'aplicacion',
      notes: ''
    });

  const [items, setItems] =
    useState<DeliveryItemForm[]>([
      {
        vaccine_batch_id: '',
        quantity: 1
      }
    ]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const canSelectFacility =
    Boolean(
      user?.role === 'admin' ||
      user?.facility_type === 'secretaria' ||
      !user?.facility_id
    );

  const scopedFacilityId =
    !canSelectFacility && user?.facility_id
      ? String(user.facility_id)
      : '';

  const totalDelivered =
    deliveries.filter((delivery) =>
      delivery.status === 'entregado'
    ).length;

  const totalPatients =
    new Set(
      deliveries
        .filter((delivery) =>
          delivery.status === 'entregado'
        )
        .map((delivery) =>
          `${delivery.patient_name}-${delivery.patient_document || ''}`
        )
    ).size;

  const totalQuantity =
    deliveries
      .filter((delivery) =>
        delivery.status === 'entregado'
      )
      .reduce(
        (total, delivery) =>
          total + Number(delivery.total_quantity || 0),
        0
      );

  const stocksById =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      facilityStocks.forEach((stock) =>
        map.set(
          Number(stock.vaccine_batch_id),
          stock
        )
      );

      return map;
    }, [facilityStocks]);

  async function loadFacilities() {

    const res =
      await apiFetch('/health-facilities');

    setFacilities(res.data);

    if (scopedFacilityId) {
      setForm((current) => ({
        ...current,
        facility_id: scopedFacilityId
      }));

      setFilters((current) => ({
        ...current,
        facility_id: scopedFacilityId
      }));

      return;
    }

    if (!form.facility_id && res.data.length > 0) {
      setForm((current) => ({
        ...current,
        facility_id: String(res.data[0].id)
      }));
    }
  }

  async function loadFacilityStocks(
    facilityId: string
  ) {

    if (!facilityId) {
      setFacilityStocks([]);
      return;
    }

    const res =
      await apiFetch(
        `/vaccine-transfers/facility-stocks?facility_id=${facilityId}`
      );

    setFacilityStocks(res.data);
  }

  async function loadDeliveries() {

    try {

      setError('');

      const params =
        new URLSearchParams();

      params.set('status', filters.status);
      params.set('reason', filters.reason);

      if (filters.facility_id) {
        params.set(
          'facility_id',
          filters.facility_id
        );
      }

      if (filters.search.trim()) {
        params.set(
          'search',
          filters.search.trim()
        );
      }

      if (filters.date_from) {
        params.set(
          'date_from',
          filters.date_from
        );
      }

      if (filters.date_to) {
        params.set(
          'date_to',
          filters.date_to
        );
      }

      const res =
        await apiFetch(
          `/vaccine-deliveries?${params.toString()}`
        );

      setDeliveries(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function updateItem(
    index: number,
    key: keyof DeliveryItemForm,
    value: string | number
  ) {

    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value
            }
          : item
      )
    );
  }

  function addItem() {

    setItems((current) => [
      ...current,
      {
        vaccine_batch_id: '',
        quantity: 1
      }
    ]);
  }

  function removeItem(
    index: number
  ) {

    setItems((current) =>
      current.filter((_, itemIndex) =>
        itemIndex !== index
      )
    );
  }

  async function handleCreateDelivery(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        '/vaccine-deliveries',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            facility_id:
              Number(form.facility_id),
            items:
              items.map((item) => ({
                vaccine_batch_id:
                  Number(item.vaccine_batch_id),
                quantity:
                  Number(item.quantity)
              }))
          })
        }
      );

      setForm((current) => ({
        ...current,
        patient_name: '',
        patient_document: '',
        patient_phone: '',
        notes: ''
      }));

      setItems([
        {
          vaccine_batch_id: '',
          quantity: 1
        }
      ]);

      await loadFacilityStocks(form.facility_id);
      await loadDeliveries();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function loadDeliveryDetail(
    id: number
  ) {

    try {

      const res =
        await apiFetch(
          `/vaccine-deliveries/${id}`
        );

      setSelectedDelivery(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function cancelDelivery(
    id: number
  ) {

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/vaccine-deliveries/${id}/cancel`,
        {
          method: 'PATCH'
        }
      );

      setSelectedDelivery(null);
      await loadFacilityStocks(form.facility_id);
      await loadDeliveries();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {

    loadFacilities();

  }, []);

  useEffect(() => {

    loadFacilityStocks(
      form.facility_id
    );

  }, [form.facility_id]);

  useEffect(() => {

    loadDeliveries();

  }, [
    filters.status,
    filters.reason,
    filters.facility_id,
    filters.search,
    filters.date_from,
    filters.date_to
  ]);

  return (

    <div>

      <div className="page-header">

        <div>

          <h1 className="page-title">
            Entregas a pacientes
          </h1>

          <p className="page-subtitle">
            Entrega de medicacion desde hospital o unidades sanitarias.
          </p>

        </div>

      </div>

      <VaccineModuleTabs />

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      {scopedFacilityId && (
        <p className="page-subtitle">
          Vista limitada a entregas de: {user?.facility_name || 'tu dependencia'}
        </p>
      )}

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Entregas</h3>
          <p>{totalDelivered}</p>
          <span>Registros activos</span>
        </div>

        <div className="dashboard-card">
          <h3>Pacientes</h3>
          <p>{totalPatients}</p>
          <span>Pacientes atendidos</span>
        </div>

        <div className="dashboard-card">
          <h3>Unidades</h3>
          <p>{totalQuantity}</p>
          <span>Medicacion entregada</span>
        </div>

      </div>

      {canEdit && (

        <form
          className="dashboard-panel auth-form"
          onSubmit={handleCreateDelivery}
        >

          <h2>Nueva entrega</h2>

          <div className="filter-bar">

            <select
              className="form-input"
              value={form.facility_id}
              disabled={!canSelectFacility}
              onChange={(e) =>
                setForm({
                  ...form,
                  facility_id: e.target.value
                })
              }
            >
              <option value="">
                Punto de entrega
              </option>

              {facilities.map((facility) => (
                <option
                  key={facility.id}
                  value={facility.id}
                >
                  {facility.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              type="date"
              value={form.delivery_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery_date: e.target.value
                })
              }
            />

            <select
              className="form-input"
              value={form.delivery_reason}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery_reason: e.target.value
                })
              }
            >
              <option value="aplicacion">
                Aplicacion
              </option>
              <option value="campania">
                Campania
              </option>
              <option value="refuerzo">
                Refuerzo
              </option>
              <option value="otro">
                Otro
              </option>
            </select>

          </div>

          <div className="filter-bar">

            <input
              className="form-input"
              placeholder="Paciente"
              value={form.patient_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  patient_name: e.target.value
                })
              }
            />

            <input
              className="form-input"
              placeholder="DNI"
              value={form.patient_document}
              onChange={(e) =>
                setForm({
                  ...form,
                  patient_document: e.target.value
                })
              }
            />

            <input
              className="form-input"
              placeholder="Telefono"
              value={form.patient_phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  patient_phone: e.target.value
                })
              }
            />

          </div>

          {items.map((item, index) => {
            const selectedStock =
              stocksById.get(
                Number(item.vaccine_batch_id)
              );

            return (
              <div
                className="filter-bar"
                key={index}
              >

                <select
                  className="form-input"
                  value={item.vaccine_batch_id}
                  onChange={(e) =>
                    updateItem(
                      index,
                      'vaccine_batch_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Vacuna / lote
                  </option>

                  {facilityStocks.map((stock) => (
                    <option
                      key={stock.vaccine_batch_id}
                      value={stock.vaccine_batch_id}
                    >
                      {stockLabel(stock)}
                    </option>
                  ))}
                </select>

                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="1"
                  max={
                    selectedStock
                      ? Number(selectedStock.current_stock)
                      : undefined
                  }
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(
                      index,
                      'quantity',
                      Number(e.target.value)
                    )
                  }
                />

                <button
                  type="button"
                  className="btn-danger"
                  disabled={items.length === 1}
                  onClick={() =>
                    removeItem(index)
                  }
                >
                  Quitar
                </button>

              </div>
            );
          })}

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
              onClick={addItem}
            >
              + Agregar Vacuna
            </button>

            <button
              type="submit"
              className="btn-success"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Registrar entrega'
              }
            </button>

          </div>

        </form>
      )}

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar paciente, DNI, Vacuna o lote"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value
            })
          }
        />

        <select
          className="form-input"
          value={filters.status}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: e.target.value
            })
          }
        >
          <option value="todos">
            Todos los estados
          </option>
          <option value="entregado">
            Entregadas
          </option>
          <option value="cancelado">
            Canceladas
          </option>
        </select>

        <select
          className="form-input"
          value={filters.reason}
          onChange={(e) =>
            setFilters({
              ...filters,
              reason: e.target.value
            })
          }
        >
          <option value="todos">
            Todos los motivos
          </option>
          <option value="aplicacion">
            Aplicacion
          </option>
          <option value="campania">
            Campania
          </option>
          <option value="refuerzo">
            Refuerzo
          </option>
          <option value="otro">
            Otro
          </option>
        </select>

        <select
          className="form-input"
          value={filters.facility_id}
          disabled={!canSelectFacility}
          onChange={(e) =>
            setFilters({
              ...filters,
              facility_id: e.target.value
            })
          }
        >
          <option value="">
            Todos los puntos
          </option>

          {facilities.map((facility) => (
            <option
              key={facility.id}
              value={facility.id}
            >
              {facility.name}
            </option>
          ))}
        </select>

        <input
          className="form-input"
          type="date"
          value={filters.date_from}
          onChange={(e) =>
            setFilters({
              ...filters,
              date_from: e.target.value
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
              date_to: e.target.value
            })
          }
        />

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              status: 'todos',
              reason: 'todos',
              facility_id:
                scopedFacilityId || '',
              search: '',
              date_from: '',
              date_to: ''
            })
          }
        >
          Limpiar
        </button>

      </div>

      <div className="table-container">

        <table className="data-table">

          <thead>
            <tr>
              <th>Nro</th>
              <th>Fecha</th>
              <th>Punto</th>
              <th>Paciente</th>
              <th>DNI</th>
              <th>Motivo</th>
              <th>Items</th>
              <th>Unidades</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>

            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>#{delivery.id}</td>
                <td>{formatDate(delivery.delivery_date)}</td>
                <td>{delivery.facility_name}</td>
                <td>{delivery.patient_name}</td>
                <td>{delivery.patient_document || '-'}</td>
                <td>{reasonLabels[delivery.delivery_reason]}</td>
                <td>{Number(delivery.item_count)}</td>
                <td>{Number(delivery.total_quantity)}</td>
                <td>
                  <span
                    className={
                      delivery.status === 'entregado'
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {statusLabels[delivery.status]}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        loadDeliveryDetail(delivery.id)
                      }
                    >
                      Ver
                    </button>
                    {canEdit && delivery.status === 'entregado' && (
                      <button
                        className="btn-danger"
                        onClick={() =>
                          cancelDelivery(delivery.id)
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {deliveries.length === 0 && (
              <tr>
                <td colSpan={10}>
                  No hay entregas para esos filtros.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

      {selectedDelivery && (

        <div className="modal-overlay">

          <div className="modal-content modal-content-wide">

            <h2 className="modal-title">
              Entrega #{selectedDelivery.id}
            </h2>

            <p className="page-subtitle">
              {selectedDelivery.patient_name} - {selectedDelivery.facility_name}
            </p>

            <div className="table-container">

              <table className="data-table">

                <thead>
                  <tr>
                    <th>Vacuna</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedDelivery.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {[
                          item.vaccine_name,
                          item.target_disease,
                          item.presentation,
                          item.dose_unit
                        ]
                          .filter(Boolean)
                          .join(' - ')}
                      </td>
                      <td>{item.batch_number}</td>
                      <td>{formatDate(item.expiration_date)}</td>
                      <td>{Number(item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>

              </table>

            </div>

            <div className="modal-actions">

              <button
                className="btn-secondary"
                onClick={() =>
                  setSelectedDelivery(null)
                }
              >
                Cerrar
              </button>

              {canEdit && selectedDelivery.status === 'entregado' && (
                <button
                  className="btn-danger"
                  onClick={() =>
                    cancelDelivery(selectedDelivery.id)
                  }
                >
                  Cancelar entrega
                </button>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


