import {
  useState
} from 'react';

import { useNavigate } from 'react-router-dom';
import {
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

      const response = await apiFetch(
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
    <div
      style={{
        padding: 40
      }}
    >
      <h1>Login</h1>

      <form onSubmit={handleSubmit}>

        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />
        </div>

        <br />

        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />
        </div>

        <br />

        <button type="submit">
          Ingresar
        </button>
        <br />
<br />

<Link to="/forgot-password">
  ¿Olvidaste tu contraseña?
</Link>

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