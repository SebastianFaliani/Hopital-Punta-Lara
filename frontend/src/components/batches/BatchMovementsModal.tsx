import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';
import {
  formatDisplayDateTime
} from '../../utils/dateFormat';

type Batch = {
  id: number;
  batch_number: string;
  current_stock: number;
  stock_by_facility?: BatchStock[];
};

type BatchStock = {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  current_stock: number;
};

type Movement = {
  id: number;
  facility_id: number | null;
  facility_name: string | null;
  movement_type: string;
  quantity: number;
  donor_name: string | null;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
};

type Facility = {
  id: number;
  name: string;
  facility_type: string;
};

type Props = {
  batch: Batch;
  onClose: () => void;
  onCreated: () => void;
};

const movementLabels: Record<string, string> = {
  compra: 'Compra',
  donacion: 'Donacion',
  ajuste: 'Ajuste',
  perdida: 'Perdida',
  devolucion: 'Devolucion'
};

function formatDateTime(
  value: string
) {

  return formatDisplayDateTime(value);
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
      facility_id: '',
      quantity: 0,
      donor_name: '',
      notes: ''
    });

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

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

  async function loadFacilities() {

    try {

      const res =
        await apiFetch('/health-facilities');

      setFacilities(res.data);

      const firstWithStock =
        batch.stock_by_facility?.find((stock) =>
          Number(stock.current_stock) > 0
        );

      const hospital =
        res.data.find((facility: Facility) =>
          facility.facility_type === 'hospital'
        );

      setForm((current) => ({
        ...current,
        facility_id:
          current.facility_id ||
          String(
            firstWithStock?.facility_id ||
            hospital?.id ||
            res.data[0]?.id ||
            ''
          )
      }));

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

    if (!form.facility_id) {

      setError(
        'Debe seleccionar la dependencia'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/batches/${batch.id}/movements`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            facility_id:
              Number(form.facility_id)
          })
        }
      );

      setForm({
        movement_type: 'compra',
        movement_direction: 'entrada',
        facility_id: form.facility_id,
        quantity: 0,
        donor_name: '',
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
    loadFacilities();

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

            <option value="donacion">
              Donacion
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

          <select
            className="form-input"
            name="facility_id"
            value={form.facility_id}
            onChange={handleChange}
          >
            <option value="">
              Dependencia
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
            step="1"
            name="quantity"
            placeholder="Cantidad"
            value={form.quantity}
            onChange={handleChange}
          />

          {
            form.movement_type === 'donacion' && (

              <input
                className="form-input"
                type="text"
                name="donor_name"
                placeholder="Quien dona"
                value={form.donor_name}
                onChange={handleChange}
              />
            )
          }

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

          {
            batch.stock_by_facility &&
            batch.stock_by_facility.length > 0 && (

              <div className="dashboard-list">
                {batch.stock_by_facility.map((stock) => (
                  <div
                    className="dashboard-list-item"
                    key={stock.facility_id}
                  >
                    <strong>{stock.facility_name}</strong>
                    <span>Stock: {Number(stock.current_stock)}</span>
                  </div>
                ))}
              </div>
            )
          }

          <table className="data-table">

            <thead>

              <tr>

                <th>Fecha</th>

                <th>Tipo</th>

                <th>Punto</th>

                <th>Cantidad</th>

                <th>Donante</th>

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
                    {movement.facility_name || '-'}
                  </td>

                  <td>
                    {formatQuantity(
                      movement.quantity
                    )}
                  </td>

                  <td>
                    {movement.donor_name || '-'}
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

                    <td colSpan={7}>
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

