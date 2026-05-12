import dotenv from 'dotenv';
import app from './app';
import { pool } from './config/database';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {

    const connection = await pool.getConnection();

    console.log('✅ MySQL conectado');

    connection.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Error conectando MySQL:', error);
  }
}

startServer();