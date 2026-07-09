import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';

import { AuthContext } from './AuthContext';

import type { User } from './AuthContext';

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}) {

  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  async function loadUser() {

    try {

      const response =
        await apiFetch('/auth/me');

      setUser(response.user);

    } catch (error) {

      localStorage.removeItem(
        'accessToken'
      );

      localStorage.removeItem(
        'refreshToken'
      );

      setUser(null);

    } finally {

      setLoading(false);
    }
  }

  async function login(
    accessToken: string
  ) {

    localStorage.setItem(
      'accessToken',
      accessToken
    );

    await loadUser();
  }

  async function logout() {

  try {

    const refreshToken =
      localStorage.getItem(
        'refreshToken'
      );

    if (refreshToken) {

      await apiFetch(
        '/auth/logout',
        {
          method: 'POST',

          body: JSON.stringify({
            refreshToken
          })
        }
      );
    }

  } catch (error) {

    console.error(error);

  } finally {

    localStorage.removeItem(
      'accessToken'
    );

    localStorage.removeItem(
      'refreshToken'
    );

    setUser(null);
  }
}

  useEffect(() => {

    const accessToken =
      localStorage.getItem(
        'accessToken'
      );

    const refreshToken =
      localStorage.getItem(
        'refreshToken'
      );

    if (accessToken || refreshToken) {

      loadUser();

    } else {

      setLoading(false);
    }

  }, []);

  if (loading) {

    return <div>Cargando...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
