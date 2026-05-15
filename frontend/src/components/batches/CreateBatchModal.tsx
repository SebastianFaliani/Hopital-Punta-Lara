import {
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';

type Props = {
  medicationId: number;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateBatchModal({
  medicationId,
  onClose,
  onCreated
}: Props) {

  const [form, setForm] =
    useState({
      batch_number: '',
      expiration_date: '',
      current_stock: 0,
      purchase_price: ''
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
        e.target.name === 'current_stock'
          ? Number(e.target.value)
          : e.target.value
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
        `/medications/${medicationId}/batches`,
        {
          method: 'POST',
          body: JSON.stringify(form)
        }
      );

      onCreated();
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
          Nuevo lote
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

          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            name="current_stock"
            placeholder="Stock actual"
            value={form.current_stock}
            onChange={handleChange}
          />

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
              className="btn-success"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Crear lote'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}
