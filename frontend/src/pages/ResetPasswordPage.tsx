import {
  useState
} from 'react';

import {
  useNavigate,
  useSearchParams
} from 'react-router-dom';

import {
  apiFetch
} from '../api/api';
import PasswordInput from '../components/PasswordInput';

export default function ResetPasswordPage() {

  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const token =
    searchParams.get('token');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);

      setError('');

      await apiFetch(
        '/auth/reset-password',
        {
          method: 'POST',

          body: JSON.stringify({
            token,
            password
          })
        }
      );

      alert(
        'Contrasena actualizada'
      );

      navigate('/login');

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  return (
    <div className="auth-container">

      <div className="auth-card">

        <h1>
          Nueva contrasena
        </h1>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <PasswordInput
            placeholder="Nueva contrasena"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            className="auth-input"
            autoComplete="new-password"
          />

          <br />
          <br />

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {
              loading
                ? 'Guardando...'
                : 'Guardar contrasena'
            }
          </button>

        </form>

        {
          error && (
            <p>
              {error}
            </p>
          )
        }

      </div>
    </div>
  );
}
