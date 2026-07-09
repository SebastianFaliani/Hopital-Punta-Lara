import {
  useEffect,
  useState
} from 'react';

import {
  useNavigate,
  Link
} from 'react-router-dom';

import { Capacitor } from '@capacitor/core';

import { apiFetch } from '../api/api';

import { useAuth } from '../auth/useAuth';
import PasswordInput from '../components/PasswordInput';

export default function LoginPage() {

  const navigate = useNavigate();

  const {
    login,
    user
  } = useAuth();

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const sessionType =
    Capacitor.isNativePlatform()
      ? 'mobile'
      : 'web';

  useEffect(() => {
    if (user) {
      navigate(
        '/inicio',
        {
          replace: true
        }
      );
    }
  }, [
    navigate,
    user
  ]);

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
              password,
              session_type: sessionType
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
          src="/menu-icons/sigsa-logo.png"
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

          <PasswordInput
            placeholder="Contrasena"
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
            Olvidaste tu contrasena?
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
