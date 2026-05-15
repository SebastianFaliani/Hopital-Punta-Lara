import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';

type Batch = {
  id: number;
  batch_number: string;
  current_stock: number;
};

type Movement = {
  id: number;
  movement_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
};

type Props = {
  batch: Batch;
  onClose: () => void;
  onCreated: () => void;
};

const movementLabels: Record<string, string> = {
  compra: 'Compra',
  ajuste: 'Ajuste',
  perdida: 'Perdida',
  devolucion: 'Devolucion'
};

function formatDateTime(
  value: string
) {

  return new Date(value)
    .toLocaleString('es-AR');
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

export default function BatchMovementsModal({
  batch,
  onClose,
  onCreated
}: Props) {

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [form, setForm] =
    useState({
      movement_type: 'compra',
      movement_direction: 'entrada',
      quantity: 0,
      notes: ''
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function loadMovements() {

    try {

      const res =
        await apiFetch(
          `/batches/${batch.id}/movements`
        );

      setMovements(res.data);

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

    setForm({
      ...form,
      [e.target.name]:
        e.target.name === 'quantity'
          ? Number(e.target.value)
          : e.target.value
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    if (form.quantity <= 0) {

      setError(
        'La cantidad debe ser mayor a cero'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/batches/${batch.id}/movements`,
        {
          method: 'POST',
          body: JSON.stringify(form)
        }
      );

      setForm({
        movement_type: 'compra',
        movement_direction: 'entrada',
        quantity: 0,
        notes: ''
      });

      await loadMovements();

      onCreated();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {

    loadMovements();

  }, [batch.id]);

  return (

    <div className="modal-overlay">

      <div className="modal-content modal-content-wide">

        <h2 className="modal-title">
          Movimientos del lote {batch.batch_number}
        </h2>

        <p className="page-subtitle">
          Stock actual: {Number(batch.current_stock)}
        </p>

        <form
          onSubmit={handleSubmit}
          className="movement-form"
        >

          <select
            className="form-input"
            name="movement_type"
            value={form.movement_type}
            onChange={handleChange}
          >
            <option value="compra">
              Compra
            </option>

            <option value="ajuste">
              Ajuste
            </option>

            <option value="perdida">
              Perdida
            </option>

            <option value="devolucion">
              Devolucion
            </option>
          </select>

          {
            form.movement_type === 'ajuste' && (

              <select
                className="form-input"
                name="movement_direction"
                value={form.movement_direction}
                onChange={handleChange}
              >
                <option value="entrada">
                  Entrada
                </option>

                <option value="salida">
                  Salida
                </option>
              </select>
            )
          }

          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            name="quantity"
            placeholder="Cantidad"
            value={form.quantity}
            onChange={handleChange}
          />

          <textarea
            className="form-input"
            name="notes"
            placeholder="Observaciones"
            rows={3}
            value={form.notes}
            onChange={handleChange}
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
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>

            <button
              type="submit"
              className="btn-success"
              disabled={loading}
            >
              {
                loading
                  ? 'Registrando...'
                  : 'Registrar movimiento'
              }
            </button>

          </div>

        </form>

        <div className="table-container movement-history">

          <table className="data-table">

            <thead>

              <tr>

                <th>Fecha</th>

                <th>Tipo</th>

                <th>Cantidad</th>

                <th>Usuario</th>

                <th>Notas</th>

              </tr>

            </thead>

            <tbody>

              {movements.map((movement) => (

                <tr key={movement.id}>

                  <td>
                    {formatDateTime(
                      movement.created_at
                    )}
                  </td>

                  <td>
                    {
                      movementLabels[
                        movement.movement_type
                      ]
                    }
                  </td>

                  <td>
                    {formatQuantity(
                      movement.quantity
                    )}
                  </td>

                  <td>
                    {
                      movement.created_by_name ||
                      '-'
                    }
                  </td>

                  <td>
                    {movement.notes || '-'}
                  </td>

                </tr>
              ))}

              {
                movements.length === 0 && (

                  <tr>

                    <td colSpan={5}>
                      No hay movimientos registrados.
                    </td>

                  </tr>
                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
