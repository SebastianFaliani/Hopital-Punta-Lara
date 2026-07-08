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

  const [username, setUsername] =
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
              username,
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

      navigate('/inicio');

    } catch (error: any) {

      setError(error.message);
    }
  }

  return (

    <div className="auth-container">

      <div className="auth-card">

        <img
          src="/sigsa-logo-display.png"
          alt="SIGSA - Sistema Integral de Gestion de Salud"
          className="auth-brand-logo"
        />

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            className="auth-input"
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="auth-input"
            autoComplete="current-password"
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
