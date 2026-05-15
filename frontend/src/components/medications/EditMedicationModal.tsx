import {
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';



type Medication = {

  id: number;

  name: string;

  generic_name: string;

  presentation: string;

  concentration: string;

  unit: string;

  description: string;

  minimum_stock: number;

  is_active: boolean;
};



type Props = {

  medication: Medication;

  onClose: () => void;

  onUpdated: () => void;
};



export default function EditMedicationModal({
  medication,
  onClose,
  onUpdated
}: Props) {

  const [form, setForm] = useState({

    name:
      medication.name,

    generic_name:
      medication.generic_name,

    presentation:
      medication.presentation,

    concentration:
      medication.concentration,

    unit:
      medication.unit,

    description:
      medication.description,

    minimum_stock:
      medication.minimum_stock
  });



  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');



  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement
    >
  ) {

    setForm({
      ...form,

      [e.target.name]:
        e.target.name === 'minimum_stock'
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
      !form.name ||
      !form.generic_name
    ) {

      setError(
        'Nombre y genérico son obligatorios'
      );

      return;
    }



    try {

      setLoading(true);



      await apiFetch(
        `/medications/${medication.id}`,
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
          Editar medicamento
        </h2>



        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            className="auth-input"
            type="text"
            name="name"
            placeholder="Nombre comercial"
            value={form.name}
            onChange={handleChange}
          />



          <input
            className="auth-input"
            type="text"
            name="generic_name"
            placeholder="Nombre genérico"
            value={form.generic_name}
            onChange={handleChange}
          />



          <input
            className="auth-input"
            type="text"
            name="presentation"
            placeholder="Presentación"
            value={form.presentation}
            onChange={handleChange}
          />



          <input
            className="auth-input"
            type="text"
            name="concentration"
            placeholder="Concentración"
            value={form.concentration}
            onChange={handleChange}
          />



          <input
            className="auth-input"
            type="text"
            name="unit"
            placeholder="Unidad"
            value={form.unit}
            onChange={handleChange}
          />



          <input
            className="auth-input"
            type="number"
            name="minimum_stock"
            placeholder="Stock mínimo"
            value={form.minimum_stock}
            onChange={handleChange}
          />



          <textarea
            className="auth-input"
            name="description"
            placeholder="Descripción"
            value={form.description}
            onChange={handleChange}
            rows={4}
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