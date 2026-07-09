import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useParams
} from 'react-router-dom';

import { apiFetch }
  from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import PageTitle from '../components/PageTitle';
import {
  formatDisplayDate
} from '../utils/dateFormat';

import CreateBatchModal
  from '../components/batches/CreateBatchModal';

import EditBatchModal
  from '../components/batches/EditBatchModal';

import BatchMovementsModal
  from '../components/batches/BatchMovementsModal';

type Medication = {
  id: number;
  name: string;
  generic_name: string | null;
  presentation: string | null;
  concentration: string | null;
};

type Batch = {
  id: number;
  medication_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  stock_by_facility?: BatchStock[];
  purchase_price: number | null;
  is_active: boolean;
};

type BatchStock = {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  current_stock: number;
};

function formatDate(
  value: string
) {

  return formatDisplayDate(value);
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

export default function MedicationBatchesPage() {

  const { user } = useAuth();

  const { id } =
    useParams();

  const medicationId =
    Number(id);

  const [medication, setMedication] =
    useState<Medication | null>(null);

  const [batches, setBatches] =
    useState<Batch[]>([]);

  const [openCreateModal, setOpenCreateModal] =
    useState(false);

  const [selectedBatch, setSelectedBatch] =
    useState<Batch | null>(null);

  const [movementBatch, setMovementBatch] =
    useState<Batch | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const canEdit =
    hasPermission(
      user,
      'medications.manage',
      ['admin', 'farmacia']
    );

  async function loadBatches() {

    try {

      setError('');

      const res =
        await apiFetch(
          `/medications/${medicationId}/batches`
        );

      setMedication(
        res.data.medication
      );

      setBatches(
        res.data.batches
      );

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function handleToggle(
    batchId: number
  ) {

    try {

      await apiFetch(
        `/batches/${batchId}/toggle`,
        {
          method: 'PATCH'
        }
      );

      loadBatches();

    } catch (error: any) {

      setError(error.message);
    }
  }

  useEffect(() => {

    loadBatches();

  }, [medicationId]);

  const totalStock =
    batches
      .filter((batch) =>
        batch.is_active
      )
      .reduce(
        (total, batch) =>
          total +
          Number(batch.current_stock),
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
            to="/medications"
            className="page-back-link"
          >
            Volver a medicamentos
          </Link>

          <PageTitle icon="medicamentos">
            Lotes de {medication?.name}
          </PageTitle>

          <p className="page-subtitle">
            Stock total activo: {totalStock}
          </p>

        </div>

        {canEdit && (
          <button
            className="btn-primary"
            onClick={() =>
              setOpenCreateModal(true)
            }
          >
            + Nuevo lote
          </button>
        )}

      </div>

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

              <th>Lote</th>

              <th>Vencimiento</th>

              <th>Stock</th>

              <th>Por punto</th>

              <th>Costo</th>

              <th>Estado</th>

              <th>Acciones</th>

            </tr>

          </thead>

          <tbody>

            {batches.map((batch) => (

              <tr key={batch.id}>

                <td>
                  {batch.batch_number}
                </td>

                <td>
                  {formatDate(
                    batch.expiration_date
                  )}
                </td>

                <td>
                  {Number(batch.current_stock)}
                </td>

                <td>
                  {
                    batch.stock_by_facility &&
                    batch.stock_by_facility.length > 0
                      ? batch.stock_by_facility
                        .map((stock) =>
                          `${stock.facility_name}: ${Number(stock.current_stock)}`
                        )
                        .join(' | ')
                      : '-'
                  }
                </td>

                <td>
                  {formatMoney(
                    batch.purchase_price
                  )}
                </td>

                <td>

                  <span
                    className={
                      batch.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {
                      batch.is_active
                        ? 'Activo'
                        : 'Inactivo'
                    }
                  </span>

                </td>

                <td>

                  <div className="table-actions">

                    {canEdit && (
                      <IconButton
                        icon="edit"
                        label="Editar lote"
                        onClick={() =>
                          setSelectedBatch(batch)
                        }
                        variant="primary"
                      />
                    )}

                    {canEdit && (
                      <IconButton
                        icon="eye"
                        label="Ver movimientos"
                        onClick={() =>
                          setMovementBatch(batch)
                        }
                        variant="secondary"
                      />
                    )}

                    {canEdit && (
                      <IconButton
                        icon={batch.is_active ? 'lock' : 'unlock'}
                        label={batch.is_active ? 'Desactivar lote' : 'Activar lote'}
                        onClick={() =>
                          handleToggle(batch.id)
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

            {
              batches.length === 0 && (

                <tr>

                  <td colSpan={7}>
                    No hay lotes cargados.
                  </td>

                </tr>
              )
            }

          </tbody>

        </table>

      </div>

      {
        openCreateModal && (

          <CreateBatchModal
            medicationId={medicationId}
            onClose={() =>
              setOpenCreateModal(false)
            }
            onCreated={loadBatches}
          />
        )
      }

      {
        selectedBatch && (

          <EditBatchModal
            batch={selectedBatch}
            onClose={() =>
              setSelectedBatch(null)
            }
            onUpdated={() => {

              loadBatches();

              setSelectedBatch(null);
            }}
          />
        )
      }

      {
        movementBatch && (

          <BatchMovementsModal
            batch={movementBatch}
            onClose={() =>
              setMovementBatch(null)
            }
            onCreated={loadBatches}
          />
        )
      }

    </div>
  );
}
