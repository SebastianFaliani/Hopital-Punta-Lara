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
  purchase_price: number | null;
  is_active: boolean;
};

function formatDate(
  value: string
) {

  return new Date(value)
    .toLocaleDateString('es-AR');
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

          <h1 className="page-title">
            Lotes de {medication?.name}
          </h1>

          <p className="page-subtitle">
            Stock total activo: {totalStock}
          </p>

        </div>

        <button
          className="btn-primary"
          onClick={() =>
            setOpenCreateModal(true)
          }
        >
          + Nuevo lote
        </button>

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

                    <button
                      className="btn-primary"
                      onClick={() =>
                        setSelectedBatch(batch)
                      }
                    >
                      Editar
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() =>
                        setMovementBatch(batch)
                      }
                    >
                      Movimientos
                    </button>

                    <button
                      className={
                        batch.is_active
                          ? 'btn-danger'
                          : 'btn-success'
                      }
                      onClick={() =>
                        handleToggle(batch.id)
                      }
                    >
                      {
                        batch.is_active
                          ? 'Desactivar'
                          : 'Activar'
                      }
                    </button>

                  </div>

                </td>

              </tr>

            ))}

            {
              batches.length === 0 && (

                <tr>

                  <td colSpan={6}>
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
