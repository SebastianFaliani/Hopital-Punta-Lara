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
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import VaccineModuleTabs from '../components/vaccines/VaccineModuleTabs';
import {
  formatDisplayDate,
  formatDisplayDateTime
} from '../utils/dateFormat';

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

type TransferItemForm = {
  vaccine_batch_id: string;
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

  return formatDisplayDate(value);
}

function formatDateTime(
  value: string | null
) {

  if (!value) {
    return '-';
  }

  return formatDisplayDateTime(value);
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

export default function VaccineTransfersPage() {

  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'vaccines.manage',
      ['admin', 'vacu']
    );

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
      search: '',
      date_from: '',
      date_to: ''
    });

  const [pagination, setPagination] =
    useState({
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 1
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
        vaccine_batch_id: '',
        quantity: 1
      }
    ]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const selectedSource =
    form.source_facility_id;

  const canSelectSource =
    Boolean(
      user?.role === 'admin' ||
      user?.access_all_facilities ||
      Number(user?.facility_ids?.length || 0) > 1 ||
      user?.facility_type === 'secretaria' ||
      !user?.facility_id
    );

  const scopedFacilityId =
    !canSelectSource && user?.facility_id
      ? String(user.facility_id)
      : '';

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
      const firstDestination =
        res.data.find((facility: Facility) =>
          String(facility.id) !== scopedFacilityId
        );

      setForm((current) => ({
        ...current,
        source_facility_id: scopedFacilityId,
        destination_facility_id:
          current.destination_facility_id &&
          current.destination_facility_id !== scopedFacilityId
            ? current.destination_facility_id
            : String(firstDestination?.id || '')
      }));

      setFilters((current) => ({
        ...current,
        facility_id: scopedFacilityId
      }));

      return;
    }

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

      params.set(
        'page',
        String(pagination.page)
      );

      params.set(
        'page_size',
        String(pagination.page_size)
      );

      const res =
        await apiFetch(
          `/vaccine-transfers?${params.toString()}`
        );

      setTransfers(
        Array.isArray(res.data)
          ? res.data
          : res.data.items
      );

      if (!Array.isArray(res.data)) {
        setPagination(res.data.pagination);
      }

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
          `/vaccine-transfers/facility-stocks?facility_id=${facilityId}`
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

  async function handleCreateTransfer(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        '/vaccine-transfers',
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
                vaccine_batch_id:
                  Number(item.vaccine_batch_id),
                quantity:
                  Number(item.quantity)
              }))
          })
        }
      );

      setItems([
        {
          vaccine_batch_id: '',
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
          `/vaccine-transfers/${id}`
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
        `/vaccine-transfers/${id}/${action}`,
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
    filters.search,
    filters.date_from,
    filters.date_to,
    pagination.page,
    pagination.page_size
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

          <h1 className="page-title">
            Traslados de Vacunas
          </h1>

          <p className="page-subtitle">
            Remitos entre Secretaria, hospital y unidades sanitarias.
          </p>

        </div>

      </div>

      <VaccineModuleTabs />

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
              disabled={!canSelectSource}
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
                  : 'Crear traslado'
              }
            </button>

          </div>

        </form>
      )}

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar Vacuna, lote o punto"
          value={filters.search}
          onChange={(e) =>
            {
              setPagination((current) => ({
                ...current,
                page: 1
              }));

              setFilters({
                ...filters,
                search: e.target.value
              });
            }
          }
        />

        <select
          className="form-input"
          value={filters.status}
          onChange={(e) =>
            {
              setPagination((current) => ({
                ...current,
                page: 1
              }));

              setFilters({
                ...filters,
                status: e.target.value
              });
            }
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
          disabled={!canSelectSource}
          onChange={(e) =>
            {
              setPagination((current) => ({
                ...current,
                page: 1
              }));

              setFilters({
                ...filters,
                facility_id: e.target.value
              });
            }
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

        <input
          className="form-input"
          type="date"
          value={filters.date_from}
          onChange={(e) => {
            setPagination((current) => ({
              ...current,
              page: 1
            }));

            setFilters({
              ...filters,
              date_from: e.target.value
            });
          }}
        />

        <input
          className="form-input"
          type="date"
          value={filters.date_to}
          onChange={(e) => {
            setPagination((current) => ({
              ...current,
              page: 1
            }));

            setFilters({
              ...filters,
              date_to: e.target.value
            });
          }}
        />

        <button
          className="btn-secondary"
          onClick={() => {
            setPagination((current) => ({
              ...current,
              page: 1
            }));

            setFilters({
              status: 'todos',
              facility_id:
                scopedFacilityId || 'todos',
              search: '',
              date_from: '',
              date_to: ''
            });
          }}
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
                    <IconButton
                      icon="eye"
                      label="Ver detalle"
                      onClick={() =>
                        loadTransferDetail(transfer.id)
                      }
                      variant="secondary"
                    />
                    {canEdit && transfer.status === 'enviado' && (
                      <IconButton
                        icon="check"
                        label="Recibir traslado"
                        onClick={() =>
                          updateTransferStatus(
                            transfer.id,
                            'receive'
                          )
                        }
                        variant="success"
                      />
                    )}
                    {canEdit && transfer.status === 'enviado' && (
                      <IconButton
                        icon="close"
                        label="Cancelar traslado"
                        onClick={() =>
                          updateTransferStatus(
                            transfer.id,
                            'cancel'
                          )
                        }
                        variant="danger"
                      />
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

      <div className="modal-actions">
        <span className="page-subtitle">
          Pagina {pagination.page} de {pagination.total_pages} - {pagination.total} traslados
        </span>

        <div className="table-actions">
          <button
            className="btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page:
                  Math.max(1, current.page - 1)
              }))
            }
          >
            Anterior
          </button>

          <button
            className="btn-secondary"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page:
                  Math.min(
                    current.total_pages,
                    current.page + 1
                  )
              }))
            }
          >
            Siguiente
          </button>
        </div>
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
                    <th>Vacuna</th>
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


