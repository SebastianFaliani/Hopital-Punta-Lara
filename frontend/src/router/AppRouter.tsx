import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

import ProtectedRoute from '../auth/ProtectedRoute';
import Layout from '../layout/Layout';

export default function AppRouter() {

  return (

    <BrowserRouter>

      <Routes>

        {/* AUTH */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        {/* SISTEMA PROTEGIDO */}
        <Route element={<ProtectedRoute />}>

          {/* LAYOUT GLOBAL */}
          <Route element={<Layout />}>

            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />

          </Route>

        </Route>

      </Routes>

    </BrowserRouter>
  );
}