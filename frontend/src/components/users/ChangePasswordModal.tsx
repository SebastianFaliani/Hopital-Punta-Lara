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

  const [passwordUpdated, setPasswordUpdated] =
    useState(false);

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    if (
      !form.current_password ||
      !form.new_password ||
      !form.confirm_password
    ) {
      setError('Completa todos los campos');
      return;
    }

    if (form.new_password.length < 6) {
      setError('La nueva contrasena debe tener minimo 6 caracteres');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError('La confirmacion no coincide');
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

      setForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      setPasswordUpdated(true);

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

        {passwordUpdated ? (
          <>
            <h2 className="modal-title">
              Contrasena actualizada
            </h2>

            <p className="modal-subtitle">
              La contrasena se actualizo correctamente.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
              >
                Aceptar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">
              Cambiar contrasena
            </h2>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >

              <input
                className="form-input"
                type="password"
                name="current_password"
                placeholder="Contrasena actual"
                value={form.current_password}
                onChange={handleChange}
                autoComplete="current-password"
              />

              <input
                className="form-input"
                type="password"
                name="new_password"
                placeholder="Nueva contrasena"
                value={form.new_password}
                onChange={handleChange}
                autoComplete="new-password"
              />

              <input
                className="form-input"
                type="password"
                name="confirm_password"
                placeholder="Repetir nueva contrasena"
                value={form.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
              />

              {error && (
                <p className="form-error">
                  {error}
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
          </>
        )}

      </div>

    </div>
  );
}
