import { createContext } from 'react';

export interface User {
  userId: number;
  email: string;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext =
  createContext<AuthContextType | null>(null);