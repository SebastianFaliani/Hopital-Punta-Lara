import {
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';

type Batch = {
  id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  purchase_price: number | null;
  is_active: boolean;
};

type Props = {
  batch: Batch;
  onClose: () => void;
  onUpdated: () => void;
};

function toDateInputValue(
  value: string
) {

  return value.slice(0, 10);
}

export default function EditBatchModal({
  batch,
  onClose,
  onUpdated
}: Props) {

  const [form, setForm] =
    useState({
      batch_number:
        batch.batch_number,
      expiration_date:
        toDateInputValue(
          batch.expiration_date
        ),
      purchase_price:
        batch.purchase_price === null
          ? ''
          : String(batch.purchase_price)
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    if (
      !form.batch_number ||
      !form.expiration_date
    ) {

      setError(
        'Lote y vencimiento son obligatorios'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/batches/${batch.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(form)
        }
      );

      onUpdated();
      onClose();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Editar lote
        </h2>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            className="form-input"
            type="text"
            name="batch_number"
            placeholder="Numero de lote"
            value={form.batch_number}
            onChange={handleChange}
          />

          <input
            className="form-input"
            type="date"
            name="expiration_date"
            value={form.expiration_date}
            onChange={handleChange}
          />

          <p className="page-subtitle">
            Stock actual: {Number(batch.current_stock)}. Para corregir stock usá Movimientos.
          </p>

          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            name="purchase_price"
            placeholder="Costo de compra"
            value={form.purchase_price}
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
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Guardar cambios'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}
