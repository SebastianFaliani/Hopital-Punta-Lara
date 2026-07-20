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
import VaccineModuleTabs from '../components/vaccines/VaccineModuleTabs';
import {
  formatDisplayDate,
  todayInputValue
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

type Delivery = {
  id: number;
  facility_id: number;
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

const emptyDeliveryForm = {
  facility_id: '',
  delivery_date: todayInputValue(),
  patient_name: '',
  patient_document: '',
  patient_phone: '',
  delivery_reason: 'aplicacion',
  notes: ''
};

const emptyDraftItem: DeliveryItemForm = {
  vaccine_batch_id: '',
  quantity: 1
};

const stockSearchPageSize = 3;

const deliveryItemsPageSize = 3;

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


function formatDate(
  value: string
) {

  return formatDisplayDate(value);
}

export default function VaccineDeliveriesPage() {

  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'vaccines.manage',
      ['admin', 'vacu']
    );

  const canEditDelivery =
    user?.role === 'admin';

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [facilityStocks, setFacilityStocks] =
    useState<FacilityStock[]>([]);

  const [deliveries, setDeliveries] =
    useState<Delivery[]>([]);

  const [selectedDelivery, setSelectedDelivery] =
    useState<DeliveryDetail | null>(null);

  const [editingDelivery, setEditingDelivery] =
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
    useState(emptyDeliveryForm);

  const [items, setItems] =
    useState<DeliveryItemForm[]>([]);

  const [draftItem, setDraftItem] =
    useState<DeliveryItemForm>(emptyDraftItem);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [stockSearch, setStockSearch] =
    useState('');

  const [stockSearchPage, setStockSearchPage] =
    useState(1);

  const [deliveryItemsPage, setDeliveryItemsPage] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const canSelectFacility =
    Boolean(
      user?.role === 'admin' ||
      user?.access_all_facilities ||
      Number(user?.facility_ids?.length || 0) > 1 ||
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

  const availableFacilityStocks =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      facilityStocks.forEach((stock) =>
        map.set(
          Number(stock.vaccine_batch_id),
          {
            ...stock,
            current_stock:
              Number(stock.current_stock)
          }
        )
      );

      if (editingDelivery) {
        editingDelivery.items.forEach((item) => {
          const id =
            Number(item.vaccine_batch_id);

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
              vaccine_batch_id:
                id,
              batch_number:
                item.batch_number,
              expiration_date:
                item.expiration_date,
              current_stock:
                Number(item.quantity),
              vaccine_name:
                item.vaccine_name,
              target_disease:
                item.target_disease,
              presentation:
                item.presentation,
              dose_unit:
                item.dose_unit
            }
          );
        });
      }

      return Array.from(map.values());
    }, [
      facilityStocks,
      editingDelivery
    ]);

  const stocksById =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock>();

      availableFacilityStocks.forEach((stock) =>
        map.set(
          Number(stock.vaccine_batch_id),
          stock
        )
      );

      return map;
    }, [availableFacilityStocks]);

  const sortedFacilityStocks =
    useMemo(() =>
      [...availableFacilityStocks].sort((first, second) =>
        (
          first.vaccine_name.localeCompare(
            second.vaccine_name,
            'es-AR',
            {
              sensitivity: 'base'
            }
          ) ||
          String(first.target_disease || '').localeCompare(
            String(second.target_disease || ''),
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
          stock.vaccine_name,
          stock.target_disease,
          stock.presentation,
          stock.dose_unit,
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

  const deliveryItemsTotalPages =
    Math.max(
      1,
      Math.ceil(
        items.length / deliveryItemsPageSize
      )
    );

  const paginatedDeliveryItems =
    items.slice(
      (deliveryItemsPage - 1) * deliveryItemsPageSize,
      deliveryItemsPage * deliveryItemsPageSize
    );

  const deliveryItemsVisibleRows =
    paginatedDeliveryItems.length || 1;

  const deliveryItemsPlaceholderRows =
    Array.from({
      length:
        Math.max(
          0,
          deliveryItemsPageSize - deliveryItemsVisibleRows
        )
    });

  const selectedDraftStock =
    stocksById.get(
      Number(draftItem.vaccine_batch_id)
    );

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

  function resetDeliveryDraft() {
    setItems([]);
    setDraftItem(emptyDraftItem);
    setStockSearch('');
    setStockSearchPage(1);
    setDeliveryItemsPage(1);
    setEditingDelivery(null);
  }

  function openCreateDelivery() {
    setError('');
    resetDeliveryDraft();
    setShowCreateModal(true);
  }

  function closeCreateDelivery() {
    setShowCreateModal(false);
    resetDeliveryDraft();
  }

  function clearDeliveryItems() {
    setItems([]);
    setDraftItem(emptyDraftItem);
    setStockSearch('');
    setStockSearchPage(1);
    setDeliveryItemsPage(1);
    setEditingDelivery((current) =>
      current
        ? {
            ...current,
            items: []
          }
        : null
    );
  }

  async function openEditDelivery(
    id: number
  ) {
    try {
      setError('');

      const res =
        await apiFetch(
          `/vaccine-deliveries/${id}`
        );

      const delivery =
        res.data as DeliveryDetail;

      setEditingDelivery(delivery);
      setForm({
        facility_id:
          String(delivery.facility_id),
        delivery_date:
          String(delivery.delivery_date).slice(0, 10),
        patient_name:
          delivery.patient_name || '',
        patient_document:
          delivery.patient_document || '',
        patient_phone:
          delivery.patient_phone || '',
        delivery_reason:
          delivery.delivery_reason,
        notes:
          delivery.notes || ''
      });
      setItems(
        delivery.items.map((item) => ({
          vaccine_batch_id:
            String(item.vaccine_batch_id),
          quantity:
            Number(item.quantity)
        }))
      );
      setDraftItem(emptyDraftItem);
      setStockSearch('');
      setStockSearchPage(1);
      setDeliveryItemsPage(1);
      setShowCreateModal(true);
    } catch (error: any) {
      setError(error.message);
    }
  }

  function selectDraftStock(
    stock: FacilityStock
  ) {
    setDraftItem((current) => ({
      ...current,
      vaccine_batch_id:
        String(stock.vaccine_batch_id),
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

  function addDraftItem() {
    setError('');

    if (!draftItem.vaccine_batch_id) {
      setError('Selecciona una vacuna y lote para agregar.');
      return;
    }

    if (Number(draftItem.quantity) <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }

    const stock =
      stocksById.get(
        Number(draftItem.vaccine_batch_id)
      );

    if (!stock) {
      setError('El lote seleccionado no esta disponible.');
      return;
    }

    const existingQuantity =
      items
        .filter((item) =>
          item.vaccine_batch_id === draftItem.vaccine_batch_id
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
          item.vaccine_batch_id === draftItem.vaccine_batch_id
        );

      if (existingIndex === -1) {
        setDeliveryItemsPage(
          Math.max(
            1,
            Math.ceil(
              (current.length + 1) / deliveryItemsPageSize
            )
          )
        );

        return [
          ...current,
          {
            vaccine_batch_id: draftItem.vaccine_batch_id,
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

  function removeItemByAbsoluteIndex(
    index: number
  ) {
    setItems((current) => {
      const next =
        current.filter((_, itemIndex) =>
          itemIndex !== index
        );

      setDeliveryItemsPage((page) =>
        Math.min(
          page,
          Math.max(
            1,
            Math.ceil(next.length / deliveryItemsPageSize)
          )
        )
      );

      return next;
    });
  }

  async function handleCreateDelivery(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      if (items.length === 0) {
        setError('Agrega al menos una vacuna a la entrega.');
        return;
      }

      await apiFetch(
        editingDelivery
          ? `/vaccine-deliveries/${editingDelivery.id}`
          : '/vaccine-deliveries',
        {
          method:
            editingDelivery
              ? 'PUT'
              : 'POST',
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

      resetDeliveryDraft();
      setShowCreateModal(false);

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

          <PageTitle icon="vacunas">
            Entregas a pacientes
          </PageTitle>

          <p className="page-subtitle">
            Entrega de medicacion desde hospital o unidades sanitarias.
          </p>

        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreateDelivery}
            type="button"
          >
            + Nueva entrega
          </button>
        )}

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
                    <IconButton
                      icon="eye"
                      label="Ver detalle"
                      onClick={() =>
                        loadDeliveryDetail(delivery.id)
                      }
                      variant="secondary"
                    />
                    {canEditDelivery && delivery.status === 'entregado' && (
                      <IconButton
                        icon="edit"
                        label="Editar entrega"
                        onClick={() =>
                          openEditDelivery(delivery.id)
                        }
                        variant="primary"
                      />
                    )}
                    {canEdit && delivery.status === 'entregado' && (
                      <IconButton
                        icon="close"
                        label="Cancelar entrega"
                        onClick={() =>
                          cancelDelivery(delivery.id)
                        }
                        variant="danger"
                      />
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

      {showCreateModal && canEdit && (

        <div className="modal-overlay">

          <div className="modal-content modal-content-wide">

            <h2 className="modal-title">
              {
                editingDelivery
                  ? `Editar entrega #${editingDelivery.id}`
                  : 'Nueva entrega'
              }
            </h2>

            <form
              className="auth-form"
              onSubmit={handleCreateDelivery}
            >

              <div className="filter-bar">

                <select
                  className="form-input"
                  value={form.facility_id}
                  disabled={!canSelectFacility}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      facility_id: e.target.value
                    });
                    clearDeliveryItems();
                  }}
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

              <div className="filter-bar">

                <input
                  className="form-input"
                  placeholder="Buscar vacuna, enfermedad, presentacion o lote"
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

              <div className="table-container vaccine-transfer-picker-table">

                <table className="data-table">

                  <thead>
                    <tr>
                      <th>Vacuna</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Stock</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedFacilityStocks.map((stock) => (
                      <tr
                        className={
                          draftItem.vaccine_batch_id === String(stock.vaccine_batch_id)
                            ? 'selected-row selectable-row'
                            : 'selectable-row'
                        }
                        key={stock.vaccine_batch_id}
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
                            stock.vaccine_name,
                            stock.target_disease,
                            stock.presentation,
                            stock.dose_unit
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
                      <tr key={`delivery-stock-placeholder-${index}`}>
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

              <div className="table-container vaccine-transfer-picker-table">

                <table className="data-table">

                  <thead>
                    <tr>
                      <th>Vacuna</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Stock</th>
                      <th>Cantidad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedDeliveryItems.map((item, index) => {
                      const stock =
                        stocksById.get(
                          Number(item.vaccine_batch_id)
                        );

                      const absoluteIndex =
                        (deliveryItemsPage - 1) *
                          deliveryItemsPageSize +
                        index;

                      return (
                        <tr key={`${item.vaccine_batch_id}-${absoluteIndex}`}>
                          <td>
                            {stock
                              ? [
                                  stock.vaccine_name,
                                  stock.target_disease,
                                  stock.presentation,
                                  stock.dose_unit
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
                              label="Quitar vacuna"
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
                          Agrega vacunas a la entrega.
                        </td>
                      </tr>
                    )}

                    {deliveryItemsPlaceholderRows.map((_, index) => (
                      <tr key={`delivery-item-placeholder-${index}`}>
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
                  Pagina {deliveryItemsPage} de {deliveryItemsTotalPages} - {items.length} vacunas agregadas
                </span>

                <div className="table-actions">
                  <button
                    className="btn-secondary"
                    disabled={deliveryItemsPage <= 1}
                    onClick={() =>
                      setDeliveryItemsPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    type="button"
                  >
                    Anterior
                  </button>

                  <button
                    className="btn-secondary"
                    disabled={deliveryItemsPage >= deliveryItemsTotalPages}
                    onClick={() =>
                      setDeliveryItemsPage((current) =>
                        Math.min(
                          deliveryItemsTotalPages,
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
                  onClick={closeCreateDelivery}
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
                      : editingDelivery
                        ? 'Guardar cambios'
                        : 'Registrar entrega'
                  }
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

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

              {canEditDelivery && selectedDelivery.status === 'entregado' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const id =
                      selectedDelivery.id;

                    setSelectedDelivery(null);
                    void openEditDelivery(id);
                  }}
                >
                  Editar
                </button>
              )}

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


