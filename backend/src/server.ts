import dotenv from 'dotenv';
import app from './app';
import { pool } from './config/database';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();

    console.log('MySQL conectado');

    connection.release();
  } catch (error) {
    console.error('Error conectando MySQL:', error);
  }
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  void checkDatabaseConnection();
});
