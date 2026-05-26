import {
  useState
} from 'react';

import { apiFetch } from '../../api/api';

type Props = {
  onClose: () => void;
};

export default function ChangePasswordModal({
  onClose
}: Props) {

  const [form, setForm] =
    useState({
      current_password: '',
      new_password: '',
      confirm_password: ''
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setError('');
    setSuccess('');

    if (
      !form.current_password ||
      !form.new_password ||
      !form.confirm_password
    ) {
      setError('Completá todos los campos');
      return;
    }

    if (form.new_password.length < 6) {
      setError('La nueva contraseña debe tener mínimo 6 caracteres');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError('La confirmación no coincide');
      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        '/users/me/password',
        {
          method: 'PATCH',
          body: JSON.stringify({
            current_password: form.current_password,
            new_password: form.new_password
          })
        }
      );

      setSuccess('Contraseña actualizada');

      setForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Cambiar contraseña
        </h2>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <input
            className="form-input"
            type="password"
            name="current_password"
            placeholder="Contraseña actual"
            value={form.current_password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          <input
            className="form-input"
            type="password"
            name="new_password"
            placeholder="Nueva contraseña"
            value={form.new_password}
            onChange={handleChange}
            autoComplete="new-password"
          />

          <input
            className="form-input"
            type="password"
            name="confirm_password"
            placeholder="Repetir nueva contraseña"
            value={form.confirm_password}
            onChange={handleChange}
            autoComplete="new-password"
          />

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          {success && (
            <p className="form-success">
              {success}
            </p>
          )}

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
                  ? 'Guardando...'
                  : 'Guardar'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}
