import {
  useEffect,
  useMemo,
  useState
} from 'react';

import type {
  FormEvent
} from 'react';

import { apiFetch } from '../api/api';
import { hasPermission } from '../auth/permissions';
import { useAuth } from '../auth/useAuth';
import PageTitle from '../components/PageTitle';
import {
  formatDisplayDate,
  todayInputValue
} from '../utils/dateFormat';

type Item = {
  id: number;
  name: string;
  category: string;
  unit: string;
  is_returnable: boolean | number;
  is_active: boolean | number;
  notes: string | null;
};

type Movement = {
  id: number;
  movement_date: string;
  item_id: number;
  item_name: string;
  item_category: string;
  unit: string;
  movement_type: string;
  quantity: number | string;
  destination_person: string | null;
  destination_sector: string | null;
  delivery_signature_name: string | null;
  delivery_signed_on_paper: boolean | number;
  requires_return: boolean | number;
  expected_return_date: string | null;
  returned_quantity: number | string;
  return_date: string | null;
  return_signature_name: string | null;
  return_signed_on_paper: boolean | number;
  status: string;
  notes: string | null;
};

type Stats = {
  total_movements: number;
  entries: number;
  exits: number;
  loans: number;
  consumptions: number;
  pending_returns: number;
  returned: number;
  total_items: number;
  active_items: number;
};

const emptyItemForm = {
  name: '',
  category: 'material',
  unit: 'unidad',
  is_returnable: false,
  notes: ''
};

const emptyMovementForm = {
  movement_date: todayInputValue(),
  item_id: '',
  movement_type: 'prestamo',
  quantity: '1',
  destination_person: '',
  destination_sector: '',
  delivery_signature_name: '',
  delivery_signed_on_paper: true,
  requires_return: true,
  expected_return_date: '',
  notes: ''
};

const emptyReturnForm = {
  return_date: todayInputValue(),
  returned_quantity: '',
  return_signature_name: '',
  return_signed_on_paper: true,
  notes: ''
};

const initialStats = {
  total_movements: 0,
  entries: 0,
  exits: 0,
  loans: 0,
  consumptions: 0,
  pending_returns: 0,
  returned: 0,
  total_items: 0,
  active_items: 0
};

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema',
  variant: 'error' | 'success' | 'info' = 'error'
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

function formatDate(value?: string | null) {
  return formatDisplayDate(value);
}

function boolValue(value: boolean | number) {
  return Boolean(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    registrado: 'Registrado',
    pendiente_devolucion: 'Pendiente devolucion',
    devuelto: 'Devuelto',
    parcial: 'Parcial',
    cancelado: 'Cancelado'
  };

  return labels[status] || status;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    entrada: 'Entrada',
    salida: 'Salida',
    prestamo: 'Prestamo',
    consumo: 'Consumo'
  };

  return labels[type] || type;
}

export default function HousekeepingPage() {
  const { user } =
    useAuth();

  const canView =
    hasPermission(
      user,
      'housekeeping.view',
      ['admin', 'mayo', 'dir']
    );

  const canManage =
    hasPermission(
      user,
      'housekeeping.manage',
      ['admin', 'mayo']
    );

  const [activeTab, setActiveTab] =
    useState<'movements' | 'items'>('movements');

  const [items, setItems] =
    useState<Item[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [stats, setStats] =
    useState<Stats>(initialStats);

  const [pagination, setPagination] =
    useState({
      page: 1,
      per_page: 25,
      total: 0,
      total_pages: 1
    });

  const [filters, setFilters] =
    useState({
      search: '',
      date_from: '',
      date_to: '',
      type: 'todos',
      status: 'todos',
      category: 'todas',
      page: 1,
      per_page: 25
    });

  const [itemForm, setItemForm] =
    useState(emptyItemForm);

  const [movementForm, setMovementForm] =
    useState(emptyMovementForm);

  const [editingItem, setEditingItem] =
    useState<Item | null>(null);

  const [returnMovement, setReturnMovement] =
    useState<Movement | null>(null);

  const [returnForm, setReturnForm] =
    useState(emptyReturnForm);

  const [showItemForm, setShowItemForm] =
    useState(false);

  const [showMovementForm, setShowMovementForm] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== 'todos' && value !== 'todas') {
          params.set(key, String(value));
        }
      });

      params.set('page', String(filters.page));
      params.set('per_page', String(filters.per_page));

      return params.toString();
    }, [filters]);

  async function loadItems() {
    const res =
      await apiFetch('/housekeeping/items?status=activos');

    setItems(res.data);
  }

  async function loadMovements() {
    try {
      setLoading(true);

      const [movementsRes, statsRes] =
        await Promise.all([
          apiFetch(`/housekeeping/movements?${queryString}`),
          apiFetch(`/housekeeping/stats?${queryString}`)
        ]);

      setMovements(movementsRes.data);
      setPagination(movementsRes.pagination);
      setStats({
        ...initialStats,
        ...statsRes.data
      });
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      return;
    }

    loadItems();
  }, [canView]);

  useEffect(() => {
    if (!canView) {
      return;
    }

    loadMovements();
  }, [canView, queryString]);

  function updateFilter(
    key: string,
    value: string | number
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page:
        key === 'page'
          ? Number(value)
          : 1
    }));
  }

  function updateMovementForm(
    key: string,
    value: string | boolean
  ) {
    setMovementForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'movement_type' && value !== 'prestamo'
        ? {
          requires_return: false,
          expected_return_date: ''
        }
        : {}),
      ...(key === 'movement_type' && value === 'prestamo'
        ? {
          requires_return: true
        }
        : {})
    }));
  }

  function openEditItem(item: Item) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      is_returnable: boolValue(item.is_returnable),
      notes: item.notes || ''
    });
    setShowItemForm(true);
  }

  function resetItemForm() {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setShowItemForm(false);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();

    try {
      await apiFetch(
        editingItem
          ? `/housekeeping/items/${editingItem.id}`
          : '/housekeeping/items',
        {
          method: editingItem ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...itemForm
          })
        }
      );

      resetItemForm();
      await loadItems();
      await loadMovements();
      showSystemAlert(
        'Elemento guardado correctamente.',
        'Aviso del sistema',
        'success'
      );
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  async function saveMovement(event: FormEvent) {
    event.preventDefault();

    try {
      await apiFetch(
        '/housekeeping/movements',
        {
          method: 'POST',
          body: JSON.stringify({
            ...movementForm,
            item_id: Number(movementForm.item_id),
            quantity: Number(movementForm.quantity || 0)
          })
        }
      );

      setMovementForm(emptyMovementForm);
      setShowMovementForm(false);
      await loadItems();
      await loadMovements();
      showSystemAlert(
        'Movimiento cargado correctamente.',
        'Aviso del sistema',
        'success'
      );
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  async function saveReturn(event: FormEvent) {
    event.preventDefault();

    if (!returnMovement) {
      return;
    }

    try {
      await apiFetch(
        `/housekeeping/movements/${returnMovement.id}/return`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...returnForm,
            returned_quantity:
              Number(returnForm.returned_quantity || 0)
          })
        }
      );

      setReturnMovement(null);
      setReturnForm(emptyReturnForm);
      await loadItems();
      await loadMovements();
      showSystemAlert(
        'Devolucion registrada.',
        'Aviso del sistema',
        'success'
      );
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  async function cancelMovement(id: number) {
    if (!window.confirm('Cancelar este movimiento y ajustar el stock?')) {
      return;
    }

    try {
      await apiFetch(
        `/housekeeping/movements/${id}/cancel`,
        { method: 'PATCH' }
      );

      await loadItems();
      await loadMovements();
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  async function toggleItem(id: number) {
    try {
      await apiFetch(
        `/housekeeping/items/${id}/toggle`,
        { method: 'PATCH' }
      );

      await loadItems();
    } catch (error: any) {
      showSystemAlert(error.message);
    }
  }

  function printBlankSheet() {
    const printWindow =
      window.open('', '_blank', 'width=1200,height=800');

    if (!printWindow) {
      showSystemAlert(
        'No se pudo abrir la ventana de impresion. Revisa si el navegador bloqueo las ventanas emergentes.'
      );
      return;
    }

    const rows =
      Array.from({ length: 14 }, (_, index) => `
        <tr>
          <td>${index + 1}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `).join('');

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Planilla de Mayordomia</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              color: #111827;
              font-family: Arial, sans-serif;
              font-size: 11px;
            }

            .sheet {
              width: 100%;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              align-items: flex-start;
              border: 2px solid #111827;
              padding: 10px 12px;
              margin-bottom: 10px;
            }

            .header h1 {
              margin: 0;
              font-size: 20px;
              letter-spacing: 0;
              text-transform: uppercase;
            }

            .header p {
              margin: 5px 0 0;
              font-size: 12px;
            }

            .header-fields {
              display: grid;
              grid-template-columns: 90px 160px;
              gap: 6px 8px;
              min-width: 280px;
            }

            .line {
              border-bottom: 1px solid #111827;
              min-height: 18px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            th,
            td {
              border: 1px solid #111827;
              padding: 5px;
              vertical-align: top;
            }

            th {
              background: #e5e7eb;
              text-align: center;
              font-size: 10px;
              text-transform: uppercase;
            }

            tbody td {
              height: 35px;
            }

            .number {
              width: 28px;
            }

            .date {
              width: 72px;
            }

            .qty {
              width: 58px;
            }

            .signature {
              width: 120px;
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <section class="header">
              <div>
                <h1>Planilla de Mayordomia</h1>
                <p>Registro manual de entradas, salidas, prestamos, consumos y devoluciones.</p>
              </div>
              <div class="header-fields">
                <strong>Fecha:</strong>
                <span class="line"></span>
                <strong>Turno:</strong>
                <span class="line"></span>
                <strong>Responsable:</strong>
                <span class="line"></span>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th class="number">N</th>
                  <th class="date">Fecha</th>
                  <th>Elemento / material / herramienta</th>
                  <th class="qty">Cant.</th>
                  <th>Tipo<br />Entrada / salida / prestamo / consumo / devolucion</th>
                  <th>A quien se entrega / presta</th>
                  <th>Sector / destino</th>
                  <th class="signature">Firma</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </main>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (!canView) {
    return <h2>No autorizado</h2>;
  }

  const pendingReturnQuantity =
    returnMovement
      ? Number(returnMovement.quantity || 0) -
        Number(returnMovement.returned_quantity || 0)
      : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <PageTitle icon="mayordomia">
            Mayordomia
          </PageTitle>
          <p className="page-subtitle">
            Control de entradas, salidas, prestamos y devoluciones.
          </p>
        </div>
        <button
          className="btn-secondary"
          type="button"
          onClick={printBlankSheet}
        >
          Imprimir planilla
        </button>
      </div>

      <div className="module-tabs">
        <button
          className={
            activeTab === 'movements'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          type="button"
          onClick={() => setActiveTab('movements')}
        >
          Movimientos
        </button>
        <button
          className={
            activeTab === 'items'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          type="button"
          onClick={() => setActiveTab('items')}
        >
          Elementos
        </button>
      </div>

      {activeTab === 'movements' && (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Movimientos</h3>
              <p>{Number(stats.total_movements || 0)}</p>
              <span>Segun filtros</span>
            </div>
            <div className="dashboard-card">
              <h3>Prestamos</h3>
              <p>{Number(stats.loans || 0)}</p>
              <span>Pendientes {Number(stats.pending_returns || 0)}</span>
            </div>
            <div className="dashboard-card">
              <h3>Elementos</h3>
              <p>{Number(stats.active_items || 0)}</p>
              <span>Activos cargados</span>
            </div>
            <div className="dashboard-card">
              <h3>Consumos</h3>
              <p>{Number(stats.consumptions || 0)}</p>
              <span>Materiales sin devolucion</span>
            </div>
          </div>

          <div className="filters-grid housekeeping-filters">
            <input
              className="form-input"
              placeholder="Buscar elemento, persona, sector o firma"
              value={filters.search}
              onChange={(event) =>
                updateFilter('search', event.target.value)
              }
            />
            <input
              className="form-input"
              type="date"
              value={filters.date_from}
              onChange={(event) =>
                updateFilter('date_from', event.target.value)
              }
            />
            <input
              className="form-input"
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                updateFilter('date_to', event.target.value)
              }
            />
            <select
              className="form-input"
              value={filters.type}
              onChange={(event) =>
                updateFilter('type', event.target.value)
              }
            >
              <option value="todos">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="prestamo">Prestamo</option>
              <option value="consumo">Consumo</option>
            </select>
            <select
              className="form-input"
              value={filters.status}
              onChange={(event) =>
                updateFilter('status', event.target.value)
              }
            >
              <option value="todos">Todos los estados</option>
              <option value="registrado">Registrado</option>
              <option value="pendiente_devolucion">Pendiente devolucion</option>
              <option value="parcial">Parcial</option>
              <option value="devuelto">Devuelto</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {canManage && (
            <div className="toolbar-actions">
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  setShowMovementForm((current) => !current)
                }
              >
                + Cargar movimiento
              </button>
            </div>
          )}

          {showMovementForm && canManage && (
            <form
              className="personnel-form"
              onSubmit={saveMovement}
            >
              <input
                className="form-input"
                type="date"
                value={movementForm.movement_date}
                onChange={(event) =>
                  updateMovementForm('movement_date', event.target.value)
                }
              />
              <select
                className="form-input"
                value={movementForm.item_id}
                onChange={(event) =>
                  updateMovementForm('item_id', event.target.value)
                }
              >
                <option value="">Elemento</option>
                {items.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} - {item.category}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                value={movementForm.movement_type}
                onChange={(event) =>
                  updateMovementForm('movement_type', event.target.value)
                }
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="prestamo">Prestamo</option>
                <option value="consumo">Consumo</option>
              </select>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Cantidad"
                value={movementForm.quantity}
                onChange={(event) =>
                  updateMovementForm('quantity', event.target.value)
                }
              />
              <input
                className="form-input"
                placeholder="A quien se entrega"
                value={movementForm.destination_person}
                onChange={(event) =>
                  updateMovementForm('destination_person', event.target.value)
                }
              />
              <input
                className="form-input"
                placeholder="Sector o destino"
                value={movementForm.destination_sector}
                onChange={(event) =>
                  updateMovementForm('destination_sector', event.target.value)
                }
              />
              <input
                className="form-input"
                placeholder="Firma entrega"
                value={movementForm.delivery_signature_name}
                onChange={(event) =>
                  updateMovementForm('delivery_signature_name', event.target.value)
                }
              />
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={movementForm.delivery_signed_on_paper}
                  onChange={(event) =>
                    updateMovementForm('delivery_signed_on_paper', event.target.checked)
                  }
                />
                Firmado en papel
              </label>
              {movementForm.movement_type === 'prestamo' && (
                <>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={movementForm.requires_return}
                      onChange={(event) =>
                        updateMovementForm('requires_return', event.target.checked)
                      }
                    />
                    Requiere devolucion
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={movementForm.expected_return_date}
                    onChange={(event) =>
                      updateMovementForm('expected_return_date', event.target.value)
                    }
                  />
                </>
              )}
              <textarea
                className="form-input personnel-notes"
                rows={3}
                placeholder="Observaciones"
                value={movementForm.notes}
                onChange={(event) =>
                  updateMovementForm('notes', event.target.value)
                }
              />
              <button
                className="btn-success"
                type="submit"
              >
                Guardar movimiento
              </button>
            </form>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Elemento</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Entregado a</th>
                  <th>Firma</th>
                  <th>Devolucion</th>
                  <th>Estado</th>
                  {canManage && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.movement_date)}</td>
                    <td>
                      <strong>{movement.item_name}</strong>
                      <br />
                      <span>{movement.item_category}</span>
                    </td>
                    <td>{typeLabel(movement.movement_type)}</td>
                    <td>
                      {Number(movement.quantity || 0)} {movement.unit}
                    </td>
                    <td>
                      <strong>{movement.destination_person || '-'}</strong>
                      <br />
                      <span>{movement.destination_sector || '-'}</span>
                    </td>
                    <td>
                      {movement.delivery_signature_name || '-'}
                      <br />
                      <span>
                        {boolValue(movement.delivery_signed_on_paper)
                          ? 'Papel'
                          : 'Sin marcar'}
                      </span>
                    </td>
                    <td>
                      {boolValue(movement.requires_return)
                        ? `${Number(movement.returned_quantity || 0)} / ${Number(movement.quantity || 0)}`
                        : 'No requiere'}
                      <br />
                      <span>
                        {movement.return_date
                          ? formatDate(movement.return_date)
                          : movement.expected_return_date
                            ? `Prevista ${formatDate(movement.expected_return_date)}`
                            : '-'}
                      </span>
                    </td>
                    <td>
                      <span className="badge">
                        {statusLabel(movement.status)}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        {boolValue(movement.requires_return) &&
                          !['devuelto', 'cancelado'].includes(movement.status) && (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => {
                                setReturnMovement(movement);
                                setReturnForm({
                                  ...emptyReturnForm,
                                  returned_quantity:
                                    String(
                                      Number(movement.quantity || 0) -
                                      Number(movement.returned_quantity || 0)
                                    )
                                });
                              }}
                            >
                              Devolver
                            </button>
                          )}
                        {movement.status !== 'cancelado' && (
                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() =>
                              cancelMovement(movement.id)
                            }
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}

                {movements.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 9 : 8}>
                      {loading
                        ? 'Cargando movimientos...'
                        : 'No hay movimientos para mostrar.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <button
              className="btn-secondary"
              type="button"
              disabled={filters.page <= 1}
              onClick={() =>
                updateFilter('page', filters.page - 1)
              }
            >
              Anterior
            </button>
            <span>
              Pagina {pagination.page} de {pagination.total_pages} - {pagination.total} registros
            </span>
            <button
              className="btn-secondary"
              type="button"
              disabled={filters.page >= pagination.total_pages}
              onClick={() =>
                updateFilter('page', filters.page + 1)
              }
            >
              Siguiente
            </button>
          </div>
        </>
      )}

      {activeTab === 'items' && (
        <>
          {canManage && (
            <div className="toolbar-actions">
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  setShowItemForm((current) => !current)
                }
              >
                + Nuevo elemento
              </button>
            </div>
          )}

          {showItemForm && canManage && (
            <form
              className="personnel-form"
              onSubmit={saveItem}
            >
              <input
                className="form-input"
                placeholder="Elemento"
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
              <select
                className="form-input"
                value={itemForm.category}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    category: event.target.value
                  }))
                }
              >
                <option value="material">Material</option>
                <option value="herramienta">Herramienta</option>
                <option value="combustible">Combustible</option>
                <option value="insumo">Insumo</option>
                <option value="otro">Otro</option>
              </select>
              <input
                className="form-input"
                placeholder="Unidad"
                value={itemForm.unit}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    unit: event.target.value
                  }))
                }
              />
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={itemForm.is_returnable}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      is_returnable: event.target.checked
                    }))
                  }
                />
                Normalmente vuelve
              </label>
              <textarea
                className="form-input personnel-notes"
                rows={3}
                placeholder="Notas"
                value={itemForm.notes}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
              <button
                className="btn-success"
                type="submit"
              >
                Guardar elemento
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={resetItemForm}
              >
                Cancelar
              </button>
            </form>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Elemento</th>
                  <th>Categoria</th>
                  <th>Devuelve</th>
                  <th>Estado</th>
                  {canManage && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <br />
                      <span>{item.notes || '-'}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      {boolValue(item.is_returnable) ? 'Si' : 'No'}
                    </td>
                    <td>
                      <span className="badge">
                        {boolValue(item.is_active) ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() =>
                            openEditItem(item)
                          }
                        >
                          Editar
                        </button>
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() =>
                            toggleItem(item.id)
                          }
                        >
                          {boolValue(item.is_active) ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4}>
                      No hay elementos cargados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {returnMovement && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title-row">
              <div>
                <h2 className="modal-title">Registrar devolucion</h2>
                <p>
                  {returnMovement.item_name} - pendiente {pendingReturnQuantity} {returnMovement.unit}
                </p>
              </div>
              <button
                className="modal-close-button"
                type="button"
                onClick={() => setReturnMovement(null)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <form
              className="personnel-form"
              onSubmit={saveReturn}
            >
              <input
                className="form-input"
                type="date"
                value={returnForm.return_date}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    return_date: event.target.value
                  }))
                }
              />
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Cantidad devuelta"
                value={returnForm.returned_quantity}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    returned_quantity: event.target.value
                  }))
                }
              />
              <input
                className="form-input"
                placeholder="Firma devolucion"
                value={returnForm.return_signature_name}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    return_signature_name: event.target.value
                  }))
                }
              />
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={returnForm.return_signed_on_paper}
                  onChange={(event) =>
                    setReturnForm((current) => ({
                      ...current,
                      return_signed_on_paper: event.target.checked
                    }))
                  }
                />
                Firmado en papel
              </label>
              <textarea
                className="form-input personnel-notes"
                rows={3}
                placeholder="Observaciones"
                value={returnForm.notes}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
              <button
                className="btn-success"
                type="submit"
              >
                Guardar devolucion
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
