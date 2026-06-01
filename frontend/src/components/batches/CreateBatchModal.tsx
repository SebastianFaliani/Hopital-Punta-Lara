import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';

type Props = {
  medicationId: number;
  onClose: () => void;
  onCreated: () => void;
};

type Facility = {
  id: number;
  name: string;
  facility_type: string;
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
      purchase_price: '',
      facility_id: ''
    });

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]:
        e.target.name === 'current_stock'
          ? Number(e.target.value)
          : e.target.value
    });
  }

  async function loadFacilities() {

    try {

      const res =
        await apiFetch('/health-facilities');

      setFacilities(res.data);

      const hospital =
        res.data.find((facility: Facility) =>
          facility.facility_type === 'hospital'
        );

      setForm((current) => ({
        ...current,
        facility_id:
          current.facility_id ||
          String(hospital?.id || res.data[0]?.id || '')
      }));

    } catch (error: any) {

      setError(error.message);
    }
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

    if (
      Number(form.current_stock) > 0 &&
      !form.facility_id
    ) {

      setError(
        'Debe seleccionar donde ingresa el stock'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/medications/${medicationId}/batches`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            facility_id:
              form.facility_id
                ? Number(form.facility_id)
                : null
          })
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

  useEffect(() => {

    loadFacilities();

  }, []);

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

          <select
            className="form-input"
            name="facility_id"
            value={form.facility_id}
            onChange={handleChange}
          >
            <option value="">
              Punto donde ingresa el stock
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
