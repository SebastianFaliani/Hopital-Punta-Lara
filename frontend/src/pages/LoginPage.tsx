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

        <form onSubmit={handleSubmit}>

          <div
            style={{
              marginBottom: 16
            }}
          >

            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
            />

          </div>

          <div
            style={{
              marginBottom: 20
            }}
          >

            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
            />

          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%'
            }}
          >
            Ingresar
          </button>

        </form>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center'
          }}
        >

          <Link to="/forgot-password">
            ¿Olvidaste tu contraseña?
          </Link>

        </div>

        {
          error && (

            <p
              style={{
                marginTop: 18,
                color: '#8a1616',
                textAlign: 'center'
              }}
            >
              {error}
            </p>
          )
        }

      </div>

    </div>
  );
}