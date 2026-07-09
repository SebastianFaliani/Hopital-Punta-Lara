import {
  useState
} from 'react';

import { apiFetch } from '../../api/api';
import PasswordInput from '../PasswordInput';

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

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema',
  variant: 'error' | 'success' | 'info' = 'error'
) {
  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant
        }
      }
    )
  );
}

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

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    if (!form.new_password || !form.confirm_password) {
      showSystemAlert(
        'Completa la nueva contrasena'
      );
      return;
    }

    if (form.new_password.length < 6) {
      showSystemAlert(
        'La contrasena debe tener minimo 6 caracteres'
      );
      return;
    }

    if (form.new_password !== form.confirm_password) {
      showSystemAlert(
        'La confirmacion no coincide'
      );
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

      setForm({
        new_password: '',
        confirm_password: ''
      });

      onClose();

      showSystemAlert(
        'Contrasena actualizada correctamente',
        'Usuario actualizado',
        'success'
      );

    } catch (error: any) {

      showSystemAlert(error.message);

    } finally {

      setLoading(false);
    }
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Nueva contrasena
        </h2>

        <p className="modal-subtitle">
          {user.first_name} {user.last_name} ({user.username})
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <PasswordInput
            placeholder="Nueva contrasena"
            value={form.new_password}
            onChange={(e) =>
              setForm({
                ...form,
                new_password: e.target.value
              })
            }
            autoComplete="new-password"
          />

          <PasswordInput
            placeholder="Repetir nueva contrasena"
            value={form.confirm_password}
            onChange={(e) =>
              setForm({
                ...form,
                confirm_password: e.target.value
              })
            }
            autoComplete="new-password"
          />

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
