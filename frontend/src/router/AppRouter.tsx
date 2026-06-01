import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import UsersPage from '../pages/UsersPage';
import MedicationsPage from '../pages/MedicationsPage';
import MedicationBatchesPage from '../pages/MedicationBatchesPage';
import MedicationFacilitiesPage from '../pages/MedicationFacilitiesPage';
import MedicationTransfersPage from '../pages/MedicationTransfersPage';
import TransfersPage from '../pages/TransfersPage';
import AmbulancesPage from '../pages/AmbulancesPage';
import DriversPage from '../pages/DriversPage';
import DriverShiftsPage from '../pages/DriverShiftsPage';
import WhatsappPage from '../pages/WhatsappPage';
import PersonnelPage from '../pages/PersonnelPage';
import VaccinesPage from '../pages/VaccinesPage';
import VaccineBatchesPage from '../pages/VaccineBatchesPage';
import AuditPage from '../pages/AuditPage';
import LaboratoryPage from '../pages/LaboratoryPage';

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

            <Route
              path="/users"
              element={<UsersPage />}
            />

            <Route
              path="/medications"
              element={<MedicationsPage />}
            />

            <Route
              path="/medications/facilities"
              element={<MedicationFacilitiesPage />}
            />

            <Route
              path="/medications/transfers"
              element={<MedicationTransfersPage />}
            />

            <Route
              path="/medications/:id/batches"
              element={<MedicationBatchesPage />}
            />

            <Route
              path="/transfers"
              element={<TransfersPage />}
            />

            <Route
              path="/ambulances"
              element={<Navigate to="/transfers/ambulances" replace />}
            />

            <Route
              path="/drivers"
              element={<Navigate to="/transfers/drivers" replace />}
            />

            <Route
              path="/driver-shifts"
              element={<Navigate to="/transfers/shifts" replace />}
            />

            <Route
              path="/transfers/ambulances"
              element={<AmbulancesPage />}
            />

            <Route
              path="/transfers/drivers"
              element={<DriversPage />}
            />

            <Route
              path="/transfers/shifts"
              element={<DriverShiftsPage />}
            />

            <Route
              path="/whatsapp"
              element={<WhatsappPage />}
            />

            <Route
              path="/personnel"
              element={<PersonnelPage />}
            />

            <Route
              path="/vaccines"
              element={<VaccinesPage />}
            />

            <Route
              path="/vaccines/:id/batches"
              element={<VaccineBatchesPage />}
            />

            <Route
              path="/laboratory"
              element={<LaboratoryPage />}
            />

            <Route
              path="/audit"
              element={<AuditPage />}
            />

          </Route>

        </Route>

      </Routes>

    </BrowserRouter>
  );
}
