import {
  useState
} from 'react';

import { useNavigate } from 'react-router-dom';

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

      await login(
        response.data.token
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