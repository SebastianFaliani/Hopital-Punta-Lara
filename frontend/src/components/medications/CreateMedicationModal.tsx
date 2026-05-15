import {
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';



type Props = {

  onClose: () => void;

  onCreated: () => void;
};



export default function CreateMedicationModal({
  onClose,
  onCreated
}: Props) {

  const [form, setForm] = useState({

    name: '',

    generic_name: '',

    presentation: '',

    concentration: '',

    unit: '',

    description: '',

    minimum_stock: 0
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
        '/medications',
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
          Nuevo medicamento
        </h2>



        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            type="text"
            name="name"
            placeholder="Nombre comercial"
            value={form.name}
            onChange={handleChange}
            className="form-input"
            />



          <input
            type="text"
            name="generic_name"
            placeholder="Nombre genérico"
            value={form.generic_name}
            onChange={handleChange}
            className="form-input"
          />



          <input
            type="text"
            name="presentation"
            placeholder="Presentación"
            value={form.presentation}
            onChange={handleChange}
            className="form-input"
          />



          <input
            type="text"
            name="concentration"
            placeholder="Concentración"
            value={form.concentration}
            onChange={handleChange}
            className="form-input"
          />



          <input
            type="text"
            name="unit"
            placeholder="Unidad"
            value={form.unit}
            onChange={handleChange}
            className="form-input"
          />



          <input
            type="number"
            name="minimum_stock"
            placeholder="Stock mínimo"
            value={form.minimum_stock}
            onChange={handleChange}
            className="form-input"
          />



          <textarea
            name="description"
            placeholder="Descripción"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="form-input"
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
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>



            <button
              type="submit"
              disabled={loading}
              className="btn-success"
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Crear medicamento'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}