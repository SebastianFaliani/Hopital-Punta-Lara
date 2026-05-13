import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import LoginPage from '../pages/LoginPage';

import DashboardPage from '../pages/DashboardPage';

import ResetPasswordPage
  from '../pages/ResetPasswordPage';

import ProtectedRoute
  from '../auth/ProtectedRoute';

import ForgotPasswordPage
  from '../pages/ForgotPasswordPage';

export default function AppRouter() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<LoginPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/reset-password"
          element={
            <ResetPasswordPage />
          }
        />

        <Route
          path="/forgot-password"
          element={
            <ForgotPasswordPage />
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}