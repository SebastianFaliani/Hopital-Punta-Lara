import { createContext } from 'react';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role: string;
  role_description?: string | null;
  facility_id?: number | null;
  facility_name?: string | null;
  facility_type?: string | null;
  access_all_facilities?: boolean;
  facility_ids?: number[];
  permissions?: string[];
  permissions_configured?: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext =
  createContext<AuthContextType | null>(null);
