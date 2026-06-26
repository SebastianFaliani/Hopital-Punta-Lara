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
import MedicationDeliveriesPage from '../pages/MedicationDeliveriesPage';
import ChronicMedicationsPage from '../pages/ChronicMedicationsPage';
import TransfersPage from '../pages/TransfersPage';
import AmbulancesPage from '../pages/AmbulancesPage';
import DriversPage from '../pages/DriversPage';
import DriverShiftsPage from '../pages/DriverShiftsPage';
import WhatsappPage from '../pages/WhatsappPage';
import PersonnelPage from '../pages/PersonnelPage';
import VaccinesPage from '../pages/VaccinesPage';
import VaccineBatchesPage from '../pages/VaccineBatchesPage';
import VaccineTransfersPage from '../pages/VaccineTransfersPage';
import VaccineDeliveriesPage from '../pages/VaccineDeliveriesPage';
import AuditPage from '../pages/AuditPage';
import LaboratoryPage from '../pages/LaboratoryPage';
import NutritionPage from '../pages/NutritionPage';
import HousekeepingPage from '../pages/HousekeepingPage';

import ProtectedRoute from '../auth/ProtectedRoute';
import HomeRedirect from '../auth/HomeRedirect';
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
              path="/inicio"
              element={<HomeRedirect />}
            />

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
              path="/facilities"
              element={<MedicationFacilitiesPage />}
            />

            <Route
              path="/medications/facilities"
              element={<Navigate to="/facilities" replace />}
            />

            <Route
              path="/medications/transfers"
              element={<MedicationTransfersPage />}
            />

            <Route
              path="/medications/deliveries"
              element={<MedicationDeliveriesPage />}
            />

            <Route
              path="/medications/chronic"
              element={<ChronicMedicationsPage />}
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
              path="/personnel/settings"
              element={<PersonnelPage />}
            />

            <Route
              path="/vaccines"
              element={<VaccinesPage />}
            />

            <Route
              path="/vaccines/transfers"
              element={<VaccineTransfersPage />}
            />

            <Route
              path="/vaccines/deliveries"
              element={<VaccineDeliveriesPage />}
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
              path="/nutrition"
              element={<NutritionPage />}
            />

            <Route
              path="/housekeeping"
              element={<HousekeepingPage />}
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
