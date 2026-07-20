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
import PageTitle from '../components/PageTitle';
import MedicationModuleTabs from '../components/medications/MedicationModuleTabs';
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
  source_facility_id: number;
  source_facility_name: string;
  destination_facility_id: number;
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
    unit: string | null;
    batch_number: string;
    expiration_date: string;
    quantity: number;
  }>;
};

type TransferItemForm = {
  medication_batch_id: string;
  quantity: number;
};

const emptyTransferForm = {
  source_facility_id: '',
  destination_facility_id: '',
  transfer_date: todayInputValue(),
  notes: ''
};

const emptyDraftItem: TransferItemForm = {
  medication_batch_id: '',
  quantity: 1
};

const stockSearchPageSize = 3;

const transferItemsPageSize = 5;

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

export default function MedicationTransfersPage() {

  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'medications.manage',
      ['admin', 'vacu']
    );

  const canReactivate =
    user?.role === 'admin';

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [facilityStocks, setFacilityStocks] =
    useState<FacilityStock[]>([]);

  const [transfers, setTransfers] =
    useState<Transfer[]>([]);

  const [selectedTransfer, setSelectedTransfer] =
    useState<TransferDetail | null>(null);

  const [editingTransfer, setEditingTransfer] =
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
    useState(emptyTransferForm);

  const [items, setItems] =
    useState<TransferItemForm[]>([]);

  const [draftItem, setDraftItem] =
    useState<TransferItemForm>(emptyDraftItem);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [stockSearch, setStockSearch] =
    useState('');

  const [stockSearchPage, setStockSearchPage] =
    useState(1);

  const [transferItemsPage, setTransferItemsPage] =
    useState(1);

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

  const availableFacilityStocks =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      facilityStocks.forEach((stock) =>
        map.set(
          Number(stock.medication_batch_id),
          {
            ...stock,
            current_stock:
              Number(stock.current_stock)
          }
        )
      );

      if (editingTransfer) {
        editingTransfer.items.forEach((item) => {
          const id =
            Number(item.medication_batch_id);

          const existing =
            map.get(id);

          if (existing) {
            map.set(
              id,
              {
                ...existing,
                current_stock:
                  Number(existing.current_stock) +
                  Number(item.quantity)
              }
            );
            return;
          }

          map.set(
            id,
            {
              medication_batch_id:
                id,
              batch_number:
                item.batch_number,
              expiration_date:
                item.expiration_date,
              current_stock:
                Number(item.quantity),
              medication_name:
                item.medication_name,
              generic_name:
                item.generic_name,
              concentration:
                item.concentration,
              presentation:
                item.presentation,
              unit:
                item.unit
            }
          );
        });
      }

      return Array.from(map.values());
    }, [
      facilityStocks,
      editingTransfer
    ]);

  const stocksById =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      availableFacilityStocks.forEach((stock) =>
        map.set(
          Number(stock.medication_batch_id),
          stock
        )
      );

      return map;
    }, [availableFacilityStocks]);

  const sortedFacilityStocks =
    useMemo(() =>
      [...availableFacilityStocks].sort((first, second) =>
        (
          first.medication_name.localeCompare(
            second.medication_name,
            'es-AR',
            {
              sensitivity: 'base'
            }
          ) ||
          String(first.generic_name || '').localeCompare(
            String(second.generic_name || ''),
            'es-AR',
            {
              sensitivity: 'base'
            }
          ) ||
          String(first.expiration_date).localeCompare(
            String(second.expiration_date)
          )
        )
      ),
    [availableFacilityStocks]);

  const filteredFacilityStocks =
    useMemo(() => {
      const search =
        stockSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return sortedFacilityStocks;
      }

      return sortedFacilityStocks.filter((stock) =>
        [
          stock.medication_name,
          stock.generic_name,
          stock.concentration,
          stock.presentation,
          stock.unit,
          stock.batch_number,
          formatDate(stock.expiration_date)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)
      );
    }, [
      sortedFacilityStocks,
      stockSearch
    ]);

  const stockSearchTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredFacilityStocks.length / stockSearchPageSize
      )
    );

  const paginatedFacilityStocks =
    filteredFacilityStocks.slice(
      (stockSearchPage - 1) * stockSearchPageSize,
      stockSearchPage * stockSearchPageSize
    );

  const stockResultVisibleRows =
    paginatedFacilityStocks.length || 1;

  const stockPlaceholderRows =
    Array.from({
      length:
        Math.max(
          0,
          stockSearchPageSize - stockResultVisibleRows
        )
    });

  const transferItemsTotalPages =
    Math.max(
      1,
      Math.ceil(
        items.length / transferItemsPageSize
      )
    );

  const paginatedTransferItems =
    items.slice(
      (transferItemsPage - 1) * transferItemsPageSize,
      transferItemsPage * transferItemsPageSize
    );

  const transferItemsVisibleRows =
    paginatedTransferItems.length || 1;

  const transferItemsPlaceholderRows =
    Array.from({
      length:
        Math.max(
          0,
          transferItemsPageSize - transferItemsVisibleRows
        )
    });

  const selectedDraftStock =
    stocksById.get(
      Number(draftItem.medication_batch_id)
    );

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
          `/medication-transfers?${params.toString()}`
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
          `/medication-transfers/facility-stocks?facility_id=${facilityId}`
        );

      setFacilityStocks(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function resetTransferDraft() {
    setItems([]);
    setDraftItem(emptyDraftItem);
    setStockSearch('');
    setStockSearchPage(1);
    setTransferItemsPage(1);
    setEditingTransfer(null);
  }

  function clearTransferItems() {
    setItems([]);
    setDraftItem(emptyDraftItem);
    setStockSearch('');
    setStockSearchPage(1);
    setTransferItemsPage(1);
    setEditingTransfer((current) =>
      current
        ? {
            ...current,
            items: []
          }
        : null
    );
  }

  function openCreateTransfer() {
    setError('');
    resetTransferDraft();
    setShowCreateModal(true);
  }

  function closeCreateTransfer() {
    setShowCreateModal(false);
    resetTransferDraft();
  }

  async function openEditTransfer(
    id: number
  ) {
    try {
      setError('');

      const res =
        await apiFetch(
          `/medication-transfers/${id}`
        );

      const transfer =
        res.data as TransferDetail;

      setEditingTransfer(transfer);
      setForm({
        source_facility_id:
          String(transfer.source_facility_id),
        destination_facility_id:
          String(transfer.destination_facility_id),
        transfer_date:
          String(transfer.transfer_date).slice(0, 10),
        notes:
          transfer.notes || ''
      });
      setItems(
        transfer.items.map((item) => ({
          medication_batch_id:
            String(item.medication_batch_id),
          quantity:
            Number(item.quantity)
        }))
      );
      setDraftItem(emptyDraftItem);
      setStockSearch('');
      setStockSearchPage(1);
      setTransferItemsPage(1);
      setShowCreateModal(true);
    } catch (error: any) {
      setError(error.message);
    }
  }

  function addDraftItem() {
    setError('');

    if (!draftItem.medication_batch_id) {
      setError('Selecciona un medicamento y lote para agregar.');
      return;
    }

    if (Number(draftItem.quantity) <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }

    const stock =
      stocksById.get(
        Number(draftItem.medication_batch_id)
      );

    if (!stock) {
      setError('El lote seleccionado no esta disponible.');
      return;
    }

    const existingQuantity =
      items
        .filter((item) =>
          item.medication_batch_id === draftItem.medication_batch_id
        )
        .reduce(
          (total, item) =>
            total + Number(item.quantity || 0),
          0
        );

    const nextQuantity =
      existingQuantity + Number(draftItem.quantity);

    if (nextQuantity > Number(stock.current_stock)) {
      setError(
        `La cantidad supera el stock disponible del lote ${stock.batch_number}.`
      );
      return;
    }

    setItems((current) => {
      const existingIndex =
        current.findIndex((item) =>
          item.medication_batch_id === draftItem.medication_batch_id
        );

      if (existingIndex === -1) {
        setTransferItemsPage(
          Math.max(
            1,
            Math.ceil(
              (current.length + 1) / transferItemsPageSize
            )
          )
        );

        return [
          ...current,
          {
            medication_batch_id: draftItem.medication_batch_id,
            quantity: Number(draftItem.quantity)
          }
        ];
      }

      return current.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity:
                Number(item.quantity) + Number(draftItem.quantity)
            }
          : item
      );
    });

    setDraftItem(emptyDraftItem);
  }

  function selectDraftStock(
    stock: FacilityStock
  ) {
    setDraftItem((current) => ({
      ...current,
      medication_batch_id:
        String(stock.medication_batch_id),
      quantity: Math.min(
        Math.max(
          Number(current.quantity || 1),
          1
        ),
        Number(stock.current_stock)
      )
    }));
    setError('');
  }

  function removeItemByAbsoluteIndex(
    index: number
  ) {
    setItems((current) => {
      const next =
        current.filter((_, itemIndex) =>
          itemIndex !== index
        );

      setTransferItemsPage((page) =>
        Math.min(
          page,
          Math.max(
            1,
            Math.ceil(next.length / transferItemsPageSize)
          )
        )
      );

      return next;
    });
  }

  async function handleCreateTransfer(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      if (items.length === 0) {
        setError('Agrega al menos un medicamento al traslado.');
        return;
      }

      await apiFetch(
        editingTransfer
          ? `/medication-transfers/${editingTransfer.id}`
          : '/medication-transfers',
        {
          method:
            editingTransfer
              ? 'PUT'
              : 'POST',
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

      resetTransferDraft();
      setShowCreateModal(false);

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

  async function reactivateTransfer(
    id: number
  ) {
    try {
      setLoading(true);
      setError('');

      await apiFetch(
        `/medication-transfers/${id}/reactivate`,
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

          <PageTitle icon="medicamentos">
            Traslados de Medicamentos
          </PageTitle>

          <p className="page-subtitle">
            Remitos entre Secretaria, hospital y unidades sanitarias.
          </p>

        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreateTransfer}
            type="button"
          >
            + Nuevo traslado
          </button>
        )}

      </div>

      <MedicationModuleTabs />

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

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar Medicamento, lote o punto"
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
                        icon="edit"
                        label="Editar traslado"
                        onClick={() =>
                          openEditTransfer(transfer.id)
                        }
                        variant="primary"
                      />
                    )}
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
                    {canReactivate && transfer.status === 'cancelado' && (
                      <IconButton
                        icon="unlock"
                        label="Reactivar traslado"
                        onClick={() =>
                          reactivateTransfer(transfer.id)
                        }
                        variant="success"
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

      {showCreateModal && canEdit && (

        <div className="modal-overlay">

          <div className="modal-content modal-content-wide">

            <h2 className="modal-title">
              {
                editingTransfer
                  ? `Editar traslado #${editingTransfer.id}`
                  : 'Nuevo traslado'
              }
            </h2>

            <form
              className="auth-form"
              onSubmit={handleCreateTransfer}
            >

              <div className="filter-bar">

                <select
                  className="form-input"
                  value={form.source_facility_id}
                  disabled={!canSelectSource}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      source_facility_id: e.target.value
                    });
                    clearTransferItems();
                  }}
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

              <div className="filter-bar">

                <input
                  className="form-input"
                  placeholder="Buscar medicamento, generico, presentacion o lote"
                  value={stockSearch}
                  onChange={(e) => {
                    setStockSearch(e.target.value);
                    setStockSearchPage(1);
                  }}
                />

                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="1"
                  max={
                    selectedDraftStock
                      ? Number(selectedDraftStock.current_stock)
                      : undefined
                  }
                  value={draftItem.quantity}
                  onChange={(e) =>
                    setDraftItem({
                      ...draftItem,
                      quantity: Number(e.target.value)
                    })
                  }
                />

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addDraftItem}
                >
                  Agregar a grilla
                </button>

              </div>

              <div className="table-container medication-transfer-picker-table">

                <table className="data-table">

                  <thead>
                    <tr>
                      <th>Medicamento</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Stock</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedFacilityStocks.map((stock) => (
                      <tr
                        className={
                          draftItem.medication_batch_id === String(stock.medication_batch_id)
                            ? 'selected-row selectable-row'
                            : 'selectable-row'
                        }
                        key={stock.medication_batch_id}
                        onClick={() =>
                          selectDraftStock(stock)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' ||
                            event.key === ' '
                          ) {
                            event.preventDefault();
                            selectDraftStock(stock);
                          }
                        }}
                        tabIndex={0}
                        title="Seleccionar lote"
                      >
                        <td>
                          {[
                            stock.medication_name,
                            stock.generic_name,
                            stock.concentration,
                            stock.presentation,
                            stock.unit
                          ]
                            .filter(Boolean)
                            .join(' - ')}
                        </td>
                        <td>{stock.batch_number}</td>
                        <td>{formatDate(stock.expiration_date)}</td>
                        <td>{Number(stock.current_stock)}</td>
                      </tr>
                    ))}

                    {paginatedFacilityStocks.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          No hay lotes disponibles para esa busqueda.
                        </td>
                      </tr>
                    )}

                    {stockPlaceholderRows.map((_, index) => (
                      <tr key={`stock-placeholder-${index}`}>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

              <div className="modal-actions">
                <span className="page-subtitle">
                  Pagina {stockSearchPage} de {stockSearchTotalPages} - {filteredFacilityStocks.length} lotes
                </span>

                <div className="table-actions">
                  <button
                    className="btn-secondary"
                    disabled={stockSearchPage <= 1}
                    onClick={() =>
                      setStockSearchPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    type="button"
                  >
                    Anterior
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={stockSearchPage >= stockSearchTotalPages}
                    onClick={() =>
                      setStockSearchPage((current) =>
                        Math.min(
                          stockSearchTotalPages,
                          current + 1
                        )
                      )
                    }
                    type="button"
                  >
                    Siguiente
                  </button>
                </div>
              </div>

              <div className="table-container medication-transfer-picker-table">

                <table className="data-table">

                  <thead>
                    <tr>
                      <th>Medicamento</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Stock</th>
                      <th>Cantidad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedTransferItems.map((item, index) => {
                      const stock =
                        stocksById.get(
                          Number(item.medication_batch_id)
                        );

                      const absoluteIndex =
                        (transferItemsPage - 1) *
                          transferItemsPageSize +
                        index;

                      return (
                        <tr key={`${item.medication_batch_id}-${absoluteIndex}`}>
                          <td>
                            {stock
                              ? [
                                  stock.medication_name,
                                  stock.generic_name,
                                  stock.concentration,
                                  stock.presentation,
                                  stock.unit
                                ]
                                  .filter(Boolean)
                                  .join(' - ')
                              : '-'}
                          </td>
                          <td>{stock?.batch_number || '-'}</td>
                          <td>
                            {stock
                              ? formatDate(stock.expiration_date)
                              : '-'}
                          </td>
                          <td>
                            {stock
                              ? Number(stock.current_stock)
                              : '-'}
                          </td>
                          <td>{Number(item.quantity)}</td>
                          <td>
                            <IconButton
                              icon="trash"
                              label="Quitar medicamento"
                              onClick={() =>
                                removeItemByAbsoluteIndex(
                                  absoluteIndex
                                )
                              }
                              variant="danger"
                            />
                          </td>
                        </tr>
                      );
                    })}

                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          Agrega medicamentos al traslado.
                        </td>
                      </tr>
                    )}

                    {transferItemsPlaceholderRows.map((_, index) => (
                      <tr key={`transfer-item-placeholder-${index}`}>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

              <div className="modal-actions">
                <span className="page-subtitle">
                  Pagina {transferItemsPage} de {transferItemsTotalPages} - {items.length} medicamentos agregados
                </span>

                <div className="table-actions">
                  <button
                    className="btn-secondary"
                    disabled={transferItemsPage <= 1}
                    onClick={() =>
                      setTransferItemsPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    type="button"
                  >
                    Anterior
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={transferItemsPage >= transferItemsTotalPages}
                    onClick={() =>
                      setTransferItemsPage((current) =>
                        Math.min(
                          transferItemsTotalPages,
                          current + 1
                        )
                      )
                    }
                    type="button"
                  >
                    Siguiente
                  </button>
                </div>
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
                  onClick={closeCreateTransfer}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={loading || items.length === 0}
                >
                  {
                    loading
                      ? 'Guardando...'
                      : editingTransfer
                        ? 'Guardar cambios'
                        : 'Crear traslado'
                  }
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

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
                          item.generic_name,
                          item.concentration,
                          item.presentation,
                          item.unit
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
                  className="btn-primary"
                  onClick={() => {
                    const id =
                      selectedTransfer.id;

                    setSelectedTransfer(null);
                    void openEditTransfer(id);
                  }}
                >
                  Editar
                </button>
              )}

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

              {canReactivate && selectedTransfer.status === 'cancelado' && (
                <button
                  className="btn-success"
                  onClick={() =>
                    reactivateTransfer(selectedTransfer.id)
                  }
                >
                  Reactivar
                </button>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


