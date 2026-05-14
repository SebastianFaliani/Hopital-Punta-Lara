import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes  from './modules/roles/roles.routes';

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

export default app;