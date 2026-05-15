import express from 'express';
import cors from 'cors';
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

const app = express();

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Backend funcionando 🚀'
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

export default app;
