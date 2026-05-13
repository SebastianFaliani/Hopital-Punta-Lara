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
        'Contraseña actualizada'
      );

      navigate('/login');

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 40
      }}
    >

      <h1>
        Nueva contraseña
      </h1>

      <form
        onSubmit={handleSubmit}
      >

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }
        />

        <br />
        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {
            loading
              ? 'Guardando...'
              : 'Guardar contraseña'
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
  );
}