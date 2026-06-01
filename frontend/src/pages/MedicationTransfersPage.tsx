import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link
} from 'react-router-dom';

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
};

type FacilityStock = {
  medication_batch_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  medication_name: string;
  generic_name: string | null;
  presentation: string | null;
  concentration: string | null;
  unit: string | null;
};

type Transfer = {
  id: number;
  source_facility_name: string;
  destination_facility_name: string;
  transfer_date: string;
  status: string;
  notes: string | null;
  created_by_name: string | null;
  received_by_name: string | null;
  received_at: string | null;
  item_count: number;
  total_quantity: number;
};

type TransferDetail = Transfer & {
  items: Array<{
    id: number;
    medication_batch_id: number;
    medication_name: string;
    generic_name: string | null;
    presentation: string | null;
    concentration: string | null;
    batch_number: string;
    expiration_date: string;
    quantity: number;
  }>;
};

type TransferItemForm = {
  medication_batch_id: string;
  quantity: number;
};

const statusLabels: Record<string, string> = {
  enviado: 'Enviado',
  recibido: 'Recibido',
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

function formatDateTime(
  value: string | null
) {

  if (!value) {
    return '-';
  }

  return new Date(value)
    .toLocaleString('es-AR');
}

function stockLabel(
  stock: FacilityStock
) {

  return [
    stock.medication_name,
    stock.concentration,
    stock.presentation,
    `lote ${stock.batch_number}`,
    `stock ${Number(stock.current_stock)}`
  ]
    .filter(Boolean)
    .join(' - ');
}

export default function MedicationTransfersPage() {

  const { user } =
    useAuth();

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'farmacia';

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [facilityStocks, setFacilityStocks] =
    useState<FacilityStock[]>([]);

  const [transfers, setTransfers] =
    useState<Transfer[]>([]);

  const [selectedTransfer, setSelectedTransfer] =
    useState<TransferDetail | null>(null);

  const [filters, setFilters] =
    useState({
      status: 'todos',
      facility_id: 'todos',
      search: ''
    });

  const [form, setForm] =
    useState({
      source_facility_id: '',
      destination_facility_id: '',
      transfer_date: todayInputValue(),
      notes: ''
    });

  const [items, setItems] =
    useState<TransferItemForm[]>([
      {
        medication_batch_id: '',
        quantity: 1
      }
    ]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const selectedSource =
    form.source_facility_id;

  const totalPending =
    transfers.filter((transfer) =>
      transfer.status === 'enviado'
    ).length;

  const totalReceived =
    transfers.filter((transfer) =>
      transfer.status === 'recibido'
    ).length;

  const totalQuantity =
    transfers.reduce(
      (total, transfer) =>
        total + Number(transfer.total_quantity || 0),
      0
    );

  const stocksById =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      facilityStocks.forEach((stock) =>
        map.set(
          Number(stock.medication_batch_id),
          stock
        )
      );

      return map;
    }, [facilityStocks]);

  async function loadFacilities() {

    const res =
      await apiFetch('/health-facilities');

    setFacilities(res.data);

    if (!form.source_facility_id && res.data.length > 0) {
      setForm((current) => ({
        ...current,
        source_facility_id:
          String(res.data[0].id),
        destination_facility_id:
          String(res.data[1]?.id || '')
      }));
    }
  }

  async function loadTransfers() {

    try {

      setError('');

      const params =
        new URLSearchParams();

      params.set('status', filters.status);

      if (filters.facility_id !== 'todos') {
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

      const res =
        await apiFetch(
          `/medication-transfers?${params.toString()}`
        );

      setTransfers(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadFacilityStocks(
    facilityId: string
  ) {

    if (!facilityId) {
      setFacilityStocks([]);
      return;
    }

    try {

      const res =
        await apiFetch(
          `/medication-transfers/facility-stocks?facility_id=${facilityId}`
        );

      setFacilityStocks(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function updateItem(
    index: number,
    key: keyof TransferItemForm,
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
        medication_batch_id: '',
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

  async function handleCreateTransfer(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        '/medication-transfers',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            source_facility_id:
              Number(form.source_facility_id),
            destination_facility_id:
              Number(form.destination_facility_id),
            items:
              items.map((item) => ({
                medication_batch_id:
                  Number(item.medication_batch_id),
                quantity:
                  Number(item.quantity)
              }))
          })
        }
      );

      setItems([
        {
          medication_batch_id: '',
          quantity: 1
        }
      ]);

      setForm((current) => ({
        ...current,
        notes: ''
      }));

      await loadFacilityStocks(
        form.source_facility_id
      );

      await loadTransfers();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function loadTransferDetail(
    id: number
  ) {

    try {

      const res =
        await apiFetch(
          `/medication-transfers/${id}`
        );

      setSelectedTransfer(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function updateTransferStatus(
    id: number,
    action: 'receive' | 'cancel'
  ) {

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/medication-transfers/${id}/${action}`,
        {
          method: 'PATCH'
        }
      );

      setSelectedTransfer(null);
      await loadFacilityStocks(
        form.source_facility_id
      );
      await loadTransfers();

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

    loadTransfers();

  }, [
    filters.status,
    filters.facility_id,
    filters.search
  ]);

  useEffect(() => {

    loadFacilityStocks(
      selectedSource
    );

  }, [selectedSource]);

  return (

    <div>

      <div className="page-header">

        <div>

          <Link
            to="/medications"
            className="page-back-link"
          >
            Volver a medicamentos
          </Link>

          <h1 className="page-title">
            Traslados de medicamentos
          </h1>

          <p className="page-subtitle">
            Remitos entre Secretaria, hospital y unidades sanitarias.
          </p>

        </div>

      </div>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Pendientes</h3>
          <p>{totalPending}</p>
          <span>Traslados enviados sin recibir</span>
        </div>

        <div className="dashboard-card">
          <h3>Recibidos</h3>
          <p>{totalReceived}</p>
          <span>Traslados completados</span>
        </div>

        <div className="dashboard-card">
          <h3>Unidades</h3>
          <p>{totalQuantity}</p>
          <span>Total en los filtros actuales</span>
        </div>

      </div>

      {canEdit && (

        <form
          className="dashboard-panel auth-form"
          onSubmit={handleCreateTransfer}
        >

          <h2>Nuevo traslado</h2>

          <div className="filter-bar">

            <select
              className="form-input"
              value={form.source_facility_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  source_facility_id: e.target.value
                })
              }
            >
              <option value="">
                Origen
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

            <select
              className="form-input"
              value={form.destination_facility_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  destination_facility_id: e.target.value
                })
              }
            >
              <option value="">
                Destino
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
              value={form.transfer_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  transfer_date: e.target.value
                })
              }
            />

          </div>

          {items.map((item, index) => {
            const selectedStock =
              stocksById.get(
                Number(item.medication_batch_id)
              );

            return (
              <div
                className="filter-bar"
                key={index}
              >

                <select
                  className="form-input"
                  value={item.medication_batch_id}
                  onChange={(e) =>
                    updateItem(
                      index,
                      'medication_batch_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Medicamento / lote
                  </option>

                  {facilityStocks.map((stock) => (
                    <option
                      key={stock.medication_batch_id}
                      value={stock.medication_batch_id}
                    >
                      {stockLabel(stock)}
                    </option>
                  ))}
                </select>

                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
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
                  onClick={() =>
                    removeItem(index)
                  }
                  disabled={items.length === 1}
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
              + Agregar medicamento
            </button>

            <button
              type="submit"
              className="btn-success"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Crear traslado'
              }
            </button>

          </div>

        </form>
      )}

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar medicamento, lote o punto"
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
          <option value="enviado">
            Enviados
          </option>
          <option value="recibido">
            Recibidos
          </option>
          <option value="cancelado">
            Cancelados
          </option>
        </select>

        <select
          className="form-input"
          value={filters.facility_id}
          onChange={(e) =>
            setFilters({
              ...filters,
              facility_id: e.target.value
            })
          }
        >
          <option value="todos">
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

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              status: 'todos',
              facility_id: 'todos',
              search: ''
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
              <th>Origen</th>
              <th>Destino</th>
              <th>Items</th>
              <th>Unidades</th>
              <th>Estado</th>
              <th>Recibido</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>

            {transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td>#{transfer.id}</td>
                <td>{formatDate(transfer.transfer_date)}</td>
                <td>{transfer.source_facility_name}</td>
                <td>{transfer.destination_facility_name}</td>
                <td>{Number(transfer.item_count)}</td>
                <td>{Number(transfer.total_quantity)}</td>
                <td>
                  <span
                    className={
                      transfer.status === 'recibido'
                        ? 'badge badge-success'
                        : transfer.status === 'cancelado'
                          ? 'badge badge-danger'
                          : 'badge badge-warning'
                    }
                  >
                    {statusLabels[transfer.status]}
                  </span>
                </td>
                <td>
                  {formatDateTime(transfer.received_at)}
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        loadTransferDetail(transfer.id)
                      }
                    >
                      Ver
                    </button>
                    {canEdit && transfer.status === 'enviado' && (
                      <button
                        className="btn-success"
                        onClick={() =>
                          updateTransferStatus(
                            transfer.id,
                            'receive'
                          )
                        }
                      >
                        Recibir
                      </button>
                    )}
                    {canEdit && transfer.status === 'enviado' && (
                      <button
                        className="btn-danger"
                        onClick={() =>
                          updateTransferStatus(
                            transfer.id,
                            'cancel'
                          )
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {transfers.length === 0 && (
              <tr>
                <td colSpan={9}>
                  No hay traslados para esos filtros.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

      {selectedTransfer && (

        <div className="modal-overlay">

          <div className="modal-content modal-content-wide">

            <h2 className="modal-title">
              Traslado #{selectedTransfer.id}
            </h2>

            <p className="page-subtitle">
              {selectedTransfer.source_facility_name} hacia {selectedTransfer.destination_facility_name}
            </p>

            <div className="table-container">

              <table className="data-table">

                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedTransfer.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {[
                          item.medication_name,
                          item.concentration,
                          item.presentation
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
                  setSelectedTransfer(null)
                }
              >
                Cerrar
              </button>

              {canEdit && selectedTransfer.status === 'enviado' && (
                <button
                  className="btn-success"
                  onClick={() =>
                    updateTransferStatus(
                      selectedTransfer.id,
                      'receive'
                    )
                  }
                >
                  Recibir
                </button>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
