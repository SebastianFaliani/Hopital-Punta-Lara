import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function ProtectedRoute() {

  const { user } = useAuth();

  // si no hay usuario → fuera
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // si hay usuario → permite entrar al layout/rutas hijas
  return <Outlet />;
}