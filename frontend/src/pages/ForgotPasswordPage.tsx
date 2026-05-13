import {
  useState
} from 'react';

import {
  apiFetch
} from '../api/api';

export default function ForgotPasswordPage() {

  const [email, setEmail] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
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
        '/auth/forgot-password',
        {
          method: 'POST',

          body: JSON.stringify({
            email
          })
        }
      );

      setSuccess(true);

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
        Recuperar contraseña
      </h1>

      {
        success ? (

          <p>
            Revisá tu email
          </p>

        ) : (

          <form
            onSubmit={handleSubmit}
          >

            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) =>
                setEmail(
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
                  ? 'Enviando...'
                  : 'Enviar email'
              }
            </button>

          </form>
        )
      }

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