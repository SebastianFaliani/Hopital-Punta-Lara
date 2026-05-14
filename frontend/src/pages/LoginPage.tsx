import {
  useState
} from 'react';

import {
  useNavigate,
  Link
} from 'react-router-dom';

import { apiFetch } from '../api/api';

import { useAuth } from '../auth/useAuth';

export default function LoginPage() {

  const navigate = useNavigate();

  const { login } = useAuth();

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [error, setError] =
    useState('');

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setError('');

    try {

      const response =
        await apiFetch(
          '/auth/login',
          {
            method: 'POST',

            body: JSON.stringify({
              email,
              password
            })
          }
        );

      localStorage.setItem(
        'accessToken',
        response.data.accessToken
      );

      localStorage.setItem(
        'refreshToken',
        response.data.refreshToken
      );

      await login(
        response.data.accessToken
      );

      navigate('/dashboard');

    } catch (error: any) {

      setError(error.message);
    }
  }

  return (

    <div className="auth-container">

      <div className="auth-card">

        <h1>
          Hospital Punta Lara
        </h1>

        <p>
          Iniciar sesión
        </p>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="auth-input"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="auth-input"
          />

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%'
            }}
          >
            Ingresar
          </button>

          <Link
            to="/forgot-password"
            className="auth-link"
          >
            ¿Olvidaste tu contraseña?
          </Link>

          {
            error && (
              <p className="auth-error">
                {error}
              </p>
            )
          }

        </form>

      </div>

    </div>
  );
}