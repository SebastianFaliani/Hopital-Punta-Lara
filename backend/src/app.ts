import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes  from './modules/roles/roles.routes';
import medicationsRoutes  from './modules/medications/medications.routes';
import batchesRoutes from './modules/batches/batches.routes';
import ambulancesRoutes from './modules/ambulances/ambulances.routes';
import driversRoutes from './modules/drivers/drivers.routes';
import driverShiftsRoutes from './modules/driver-shifts/driver-shifts.routes';
import transfersRoutes from './modules/transfers/transfers.routes';
import transferTripsRoutes from './modules/transfer-trips/transfer-trips.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import personnelRoutes from './modules/personnel/personnel.routes';
import vaccinesRoutes from './modules/vaccines/vaccines.routes';
import vaccineBatchesRoutes from './modules/vaccine-batches/vaccine-batches.routes';
import auditRoutes from './modules/audit/audit.routes';
import laboratoryRoutes from './modules/laboratory/laboratory.routes';
import healthFacilitiesRoutes from './modules/health-facilities/health-facilities.routes';

dotenv.config();

const app = express();

const corsOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Backend funcionando 🚀'
  });
});



app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend disponible'
  });
});

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/roles', rolesRoutes);
app.use('/medications',  medicationsRoutes);
app.use('/batches', batchesRoutes);
app.use('/ambulances', ambulancesRoutes);
app.use('/drivers', driversRoutes);
app.use('/driver-shifts', driverShiftsRoutes);
app.use('/transfers', transfersRoutes);
app.use('/transfer-trips', transferTripsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/personnel', personnelRoutes);
app.use('/vaccines', vaccinesRoutes);
app.use('/vaccine-batches', vaccineBatchesRoutes);
app.use('/audit', auditRoutes);
app.use('/laboratory', laboratoryRoutes);
app.use('/health-facilities', healthFacilitiesRoutes);

export default app;
