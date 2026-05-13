import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import LoginPage from '../pages/LoginPage';

import DashboardPage from '../pages/DashboardPage';

import ProtectedRoute from '../auth/ProtectedRoute';

export default function AppRouter() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<LoginPage />}
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