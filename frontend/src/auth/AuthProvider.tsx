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

  async function loadUser() {

    try {

      const response =
        await apiFetch('/auth/me');

      setUser(response.user);

    } catch (error) {

      localStorage.removeItem('token');

      setUser(null);
    }
  }

  async function login(token: string) {

    localStorage.setItem('token', token);

    await loadUser();
  }

  function logout() {

    localStorage.removeItem('token');

    setUser(null);
  }

  useEffect(() => {

    const token =
      localStorage.getItem('token');

    if (token) {

      loadUser();
    }

  }, []);

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