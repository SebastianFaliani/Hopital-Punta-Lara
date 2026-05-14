import { useState } from 'react';

import { apiFetch } from '../../api/api';

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateUserModal({
  onClose,
  onCreated
}: Props) {

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    role_id: 2
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setError('');

    // validaciones
    if (
      !form.first_name ||
      !form.last_name ||
      !form.email ||
      !form.password
    ) {

      setError(
        'Todos los campos son obligatorios'
      );

      return;
    }

    if (form.password.length < 6) {

      setError(
        'La contraseña debe tener mínimo 6 caracteres'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        '/users',
        {
          method: 'POST',

          body: JSON.stringify({
            ...form,
            role_id: Number(form.role_id)
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

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value
    });
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Nuevo usuario
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="first_name"
            placeholder="Nombre"
            value={form.first_name}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="text"
            name="last_name"
            placeholder="Apellido"
            value={form.last_name}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="text"
            name="username"
            placeholder="Usuario"
            value={form.username}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={handleChange}
            className="form-input"
          />

          <select
            name="role_id"
            value={form.role_id}
            onChange={handleChange}
            className="form-input"
          >
            <option value={2}>
              Usuario
            </option>

            <option value={1}>
              Administrador
            </option>
          </select>

          {error && (

            <p className="form-error">
              {error}
            </p>
          )}

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
                  ? 'Creando...'
                  : 'Crear usuario'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}