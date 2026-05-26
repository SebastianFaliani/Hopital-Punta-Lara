import {
  useState
} from 'react';

import { apiFetch } from '../../api/api';

type User = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
};

type Props = {
  user: User;
  onClose: () => void;
};

export default function AdminResetPasswordModal({
  user,
  onClose
}: Props) {

  const [form, setForm] =
    useState({
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

    if (!form.new_password || !form.confirm_password) {
      setError('Completá la nueva contraseña');
      return;
    }

    if (form.new_password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError('La confirmación no coincide');
      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/users/${user.id}/password`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            new_password: form.new_password
          })
        }
      );

      setSuccess('Contraseña actualizada');

      setForm({
        new_password: '',
        confirm_password: ''
      });

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
          Nueva contraseña
        </h2>

        <p className="modal-subtitle">
          {user.first_name} {user.last_name} ({user.username})
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <input
            className="form-input"
            type="password"
            placeholder="Nueva contraseña"
            value={form.new_password}
            onChange={(e) =>
              setForm({
                ...form,
                new_password: e.target.value
              })
            }
            autoComplete="new-password"
          />

          <input
            className="form-input"
            type="password"
            placeholder="Repetir nueva contraseña"
            value={form.confirm_password}
            onChange={(e) =>
              setForm({
                ...form,
                confirm_password: e.target.value
              })
            }
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
