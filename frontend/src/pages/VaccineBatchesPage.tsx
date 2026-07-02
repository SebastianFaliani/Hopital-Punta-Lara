import {
  Link,
  useParams
} from 'react-router-dom';

import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import {
  formatDisplayDate,
  formatDisplayDateTime
} from '../utils/dateFormat';

type Vaccine = {
  id: number;
  name: string;
  target_disease: string | null;
  presentation: string | null;
  dose_unit: string | null;
};

type Batch = {
  id: number;
  vaccine_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  purchase_price: number | null;
  is_active: boolean;
  stock_by_facility?: Array<{
    facility_id: number;
    facility_name: string;
    facility_type: string;
    current_stock: number;
  }>;
};

type Movement = {
  id: number;
  facility_name: string | null;
  movement_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
};

type Facility = {
  id: number;
  name: string;
  facility_type: string;
};

const emptyBatchForm = {
  batch_number: '',
  expiration_date: '',
  current_stock: 0,
  purchase_price: '',
  facility_id: ''
};

const movementLabels: Record<string, string> = {
  ingreso: 'Ingreso',
  ajuste: 'Ajuste',
  perdida: 'Perdida',
  devolucion: 'Devolucion'
};

function formatDate(
  value: string
) {
  return formatDisplayDate(value);
}

function formatDateTime(
  value: string
) {
  return formatDisplayDateTime(value);
}

function formatMoney(
  value: number | null
) {
  if (value === null) {
    return '-';
  }

  return Number(value)
    .toLocaleString(
      'es-AR',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
}

function formatQuantity(
  value: number
) {
  const quantity =
    Number(value);

  return quantity > 0
    ? `+${quantity}`
    : String(quantity);
}

export default function VaccineBatchesPage() {

  const { user } = useAuth();

  const { id } =
    useParams();

  const vaccineId =
    Number(id);

  const [vaccine, setVaccine] =
    useState<Vaccine | null>(null);

  const [batches, setBatches] =
    useState<Batch[]>([]);

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [batchForm, setBatchForm] =
    useState(emptyBatchForm);

  const [showBatchForm, setShowBatchForm] =
    useState(false);

  const [editingBatch, setEditingBatch] =
    useState<Batch | null>(null);

  const [movementBatch, setMovementBatch] =
    useState<Batch | null>(null);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [movementForm, setMovementForm] =
    useState({
      movement_type: 'ingreso',
      movement_direction: 'entrada',
      quantity: 0,
      facility_id: '',
      notes: ''
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const canEdit =
    hasPermission(
      user,
      'vaccines.manage',
      ['admin', 'vacu']
    );

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

  async function loadFacilities() {
    try {
      const res =
        await apiFetch('/health-facilities');

      setFacilities(res.data);

      const defaultFacility =
        res.data.find((facility: Facility) =>
          facility.facility_type === 'secretaria'
        ) || res.data[0];

      const nextFacilityId =
        scopedFacilityId ||
        (
          defaultFacility
            ? String(defaultFacility.id)
            : ''
        );

      setBatchForm((current) => ({
        ...current,
        facility_id:
          current.facility_id || nextFacilityId
      }));

      setMovementForm((current) => ({
        ...current,
        facility_id:
          current.facility_id || nextFacilityId
      }));
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function loadBatches() {
    try {
      setError('');

      const res =
        await apiFetch(
          `/vaccines/${vaccineId}/batches`
        );

      setVaccine(res.data.vaccine);
      setBatches(res.data.batches);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements(
    batchId: number
  ) {
    try {
      const res =
        await apiFetch(
          `/vaccine-batches/${batchId}/movements`
        );

      setMovements(res.data);
    } catch (error: any) {
      setError(error.message);
    }
  }

  useEffect(() => {
    loadBatches();
    loadFacilities();
  }, [vaccineId]);

  function openCreateBatch() {
    setEditingBatch(null);
    setBatchForm({
      ...emptyBatchForm,
      facility_id:
        scopedFacilityId ||
        facilities.find((facility) =>
          facility.facility_type === 'secretaria'
        )?.id.toString() ||
        facilities[0]?.id.toString() ||
        ''
    });
    setError('');
    setShowBatchForm(true);
  }

  function openEditBatch(
    batch: Batch
  ) {
    setEditingBatch(batch);
    setBatchForm({
      batch_number: batch.batch_number,
      expiration_date: String(batch.expiration_date).slice(0, 10),
      current_stock: Number(batch.current_stock),
      purchase_price:
        batch.purchase_price === null
          ? ''
          : String(batch.purchase_price),
      facility_id:
        scopedFacilityId ||
        batch.stock_by_facility?.[0]?.facility_id.toString() ||
        facilities[0]?.id.toString() ||
        ''
    });
    setError('');
    setShowBatchForm(true);
  }

  async function handleBatchSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError('');

    if (!batchForm.batch_number || !batchForm.expiration_date) {
      setError('El lote y vencimiento son obligatorios');
      return;
    }

    try {
      setSaving(true);

      const payload =
        editingBatch
          ? {
            batch_number: batchForm.batch_number,
            expiration_date: batchForm.expiration_date,
            purchase_price: batchForm.purchase_price
          }
          : batchForm;

      await apiFetch(
        editingBatch
          ? `/vaccine-batches/${editingBatch.id}`
          : `/vaccines/${vaccineId}/batches`,
        {
          method: editingBatch ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        }
      );

      setShowBatchForm(false);
      setEditingBatch(null);
      await loadBatches();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBatch(
    batchId: number
  ) {
    try {
      await apiFetch(
        `/vaccine-batches/${batchId}/toggle`,
        {
          method: 'PATCH'
        }
      );

      loadBatches();
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function openMovements(
    batch: Batch
  ) {
    setMovementBatch(batch);
    setMovementForm({
      movement_type: 'ingreso',
      movement_direction: 'entrada',
      quantity: 0,
      facility_id:
        scopedFacilityId ||
        batch.stock_by_facility?.find((stock) =>
          Number(stock.current_stock) > 0
        )?.facility_id.toString() ||
        facilities.find((facility) =>
          facility.facility_type === 'secretaria'
        )?.id.toString() ||
        facilities[0]?.id.toString() ||
        '',
      notes: ''
    });
    setMovements([]);
    await loadMovements(batch.id);
  }

  async function handleMovementSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError('');

    if (movementForm.quantity <= 0) {
      setError('La cantidad debe ser mayor a cero');
      return;
    }

    if (!movementBatch) {
      return;
    }

    try {
      setSaving(true);

      await apiFetch(
        `/vaccine-batches/${movementBatch.id}/movements`,
        {
          method: 'POST',
          body: JSON.stringify(movementForm)
        }
      );

      await loadMovements(movementBatch.id);
      await loadBatches();

      setMovementForm({
        movement_type: 'ingreso',
      movement_direction: 'entrada',
      quantity: 0,
      facility_id: movementForm.facility_id,
      notes: ''
    });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const totalStock =
    batches
      .filter((batch) => batch.is_active)
      .reduce(
        (total, batch) =>
          total + Number(batch.current_stock),
        0
      );

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (

    <div>

      <div className="page-header">
        <div>
          <Link
            to="/vaccines"
            className="page-back-link"
          >
            Volver a vacunas
          </Link>

          <h1 className="page-title">
            Lotes de {vaccine?.name}
          </h1>

          <p className="page-subtitle">
            Stock total activo: {totalStock}
          </p>
        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={openCreateBatch}
          >
            + Nuevo lote
          </button>
        )}
      </div>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Vencimiento</th>
              <th>Stock</th>
              <th>Costo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number}</td>
                <td>{formatDate(batch.expiration_date)}</td>
                <td>
                  <div>
                    <strong>{Number(batch.current_stock)}</strong>
                    {batch.stock_by_facility &&
                      batch.stock_by_facility.length > 0 && (
                      <div className="batch-stock-list">
                        {batch.stock_by_facility.map((stock) => (
                          <span key={stock.facility_id}>
                            {stock.facility_name}: {Number(stock.current_stock)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td>{formatMoney(batch.purchase_price)}</td>
                <td>
                  <span
                    className={
                      batch.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {batch.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {canEdit && (
                      <IconButton
                        icon="edit"
                        label="Editar lote"
                        onClick={() =>
                          openEditBatch(batch)
                        }
                        variant="primary"
                      />
                    )}

                    {canEdit && (
                      <IconButton
                        icon="eye"
                        label="Ver movimientos"
                        onClick={() =>
                          openMovements(batch)
                        }
                        variant="secondary"
                      />
                    )}

                    {canEdit && (
                      <IconButton
                        icon={batch.is_active ? 'lock' : 'unlock'}
                        label={batch.is_active ? 'Desactivar lote' : 'Activar lote'}
                        onClick={() =>
                          handleToggleBatch(batch.id)
                        }
                        variant={
                          batch.is_active
                            ? 'danger'
                            : 'success'
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {batches.length === 0 && (
              <tr>
                <td colSpan={6}>
                  No hay lotes cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showBatchForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              {editingBatch ? 'Editar lote' : 'Nuevo lote'}
            </h2>

            <form
              className="auth-form"
              onSubmit={handleBatchSubmit}
            >
              <input
                className="form-input"
                placeholder="Lote"
                value={batchForm.batch_number}
                onChange={(e) =>
                  setBatchForm({
                    ...batchForm,
                    batch_number: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                type="date"
                value={batchForm.expiration_date}
                onChange={(e) =>
                  setBatchForm({
                    ...batchForm,
                    expiration_date: e.target.value
                  })
                }
              />

              {!editingBatch && (
                <>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Stock"
                    value={batchForm.current_stock}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        current_stock: Number(e.target.value)
                      })
                    }
                  />

                  <select
                    className="form-input"
                    value={batchForm.facility_id}
                    disabled={!canSelectFacility}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        facility_id: e.target.value
                      })
                    }
                  >
                    <option value="">Dependencia</option>
                    {facilities.map((facility) => (
                      <option
                        key={facility.id}
                        value={facility.id}
                      >
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                placeholder="Costo"
                value={batchForm.purchase_price}
                onChange={(e) =>
                  setBatchForm({
                    ...batchForm,
                    purchase_price: e.target.value
                  })
                }
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setShowBatchForm(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movementBatch && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <h2 className="modal-title">
              Movimientos del lote {movementBatch.batch_number}
            </h2>

            <p className="page-subtitle">
              Stock actual: {Number(movementBatch.current_stock)}
            </p>

            <form
              className="movement-form"
              onSubmit={handleMovementSubmit}
            >
              <select
                className="form-input"
                value={movementForm.movement_type}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    movement_type: e.target.value
                  })
                }
              >
                <option value="ingreso">Ingreso</option>
                <option value="ajuste">Ajuste</option>
                <option value="perdida">Perdida</option>
                <option value="devolucion">Devolucion</option>
              </select>

              {movementForm.movement_type === 'ajuste' && (
                <select
                  className="form-input"
                  value={movementForm.movement_direction}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      movement_direction: e.target.value
                    })
                  }
                >
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              )}

              <select
                className="form-input"
                value={movementForm.facility_id}
                disabled={!canSelectFacility}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    facility_id: e.target.value
                  })
                }
              >
                <option value="">Dependencia</option>
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
                type="number"
                min="0"
                step="1"
                placeholder="Cantidad"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    quantity: Number(e.target.value)
                  })
                }
              />

              <textarea
                className="form-input"
                placeholder="Observaciones"
                rows={3}
                value={movementForm.notes}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    notes: e.target.value
                  })
                }
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setMovementBatch(null)
                  }
                >
                  Cerrar
                </button>

                <button
                  type="submit"
                  className="btn-success"
                  disabled={saving}
                >
                  {saving ? 'Registrando...' : 'Registrar movimiento'}
                </button>
              </div>
            </form>

            <div className="table-container movement-history">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Punto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Usuario</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDateTime(movement.created_at)}</td>
                      <td>{movement.facility_name || '-'}</td>
                      <td>{movementLabels[movement.movement_type]}</td>
                      <td>{formatQuantity(movement.quantity)}</td>
                      <td>{movement.created_by_name || '-'}</td>
                      <td>{movement.notes || '-'}</td>
                    </tr>
                  ))}

                  {movements.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

