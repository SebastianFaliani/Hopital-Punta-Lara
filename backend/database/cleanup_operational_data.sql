-- Limpieza de datos operativos / de prueba
-- Hospital Punta Lara
--
-- Este script NO elimina datos maestros importantes:
-- - usuarios
-- - roles
-- - empleados
-- - sectores
-- - claves de presentismo
-- - reglas de licencias
-- - reglas de vacaciones por antiguedad
-- - medicamentos
-- - ambulancias
-- - choferes
-- - respuestas automaticas de WhatsApp
--
-- Si lo ejecutas desde phpMyAdmin, selecciona primero la base correcta.

START TRANSACTION;

-- Farmacia: movimientos, lotes, recetas y administraciones.
DELETE FROM medication_administrations;
DELETE FROM prescription_items;
DELETE FROM prescriptions;
DELETE FROM inventory_movements;
DELETE FROM medication_batches;

-- Traslados: viajes, solicitudes y guardias programadas/de prueba.
DELETE FROM transfer_trips;
DELETE FROM transfer_requests;
DELETE FROM driver_shifts;

-- Personal: presentismo, licencias, saldos y ajustes cargados.
DELETE FROM attendance_records;
DELETE FROM attendance_periods;
DELETE FROM leave_balance_adjustments;
DELETE FROM employee_leave_balances;
DELETE FROM leave_requests;

-- Seguridad: sesiones y recuperaciones de clave.
-- No borra usuarios ni roles.
DELETE FROM password_resets;
DELETE FROM user_sessions;

-- WhatsApp: historial de mensajes.
-- No borra el menu/respuestas automaticas.
DELETE FROM whatsapp_message_logs;

COMMIT;

-- Reinicia numeradores de las tablas limpiadas.
-- Esto queda fuera de la transaccion porque MySQL confirma estos cambios de estructura de forma inmediata.
ALTER TABLE medication_administrations AUTO_INCREMENT = 1;
ALTER TABLE prescription_items AUTO_INCREMENT = 1;
ALTER TABLE prescriptions AUTO_INCREMENT = 1;
ALTER TABLE inventory_movements AUTO_INCREMENT = 1;
ALTER TABLE medication_batches AUTO_INCREMENT = 1;

ALTER TABLE transfer_trips AUTO_INCREMENT = 1;
ALTER TABLE transfer_requests AUTO_INCREMENT = 1;
ALTER TABLE driver_shifts AUTO_INCREMENT = 1;

ALTER TABLE attendance_records AUTO_INCREMENT = 1;
ALTER TABLE attendance_periods AUTO_INCREMENT = 1;
ALTER TABLE leave_balance_adjustments AUTO_INCREMENT = 1;
ALTER TABLE employee_leave_balances AUTO_INCREMENT = 1;
ALTER TABLE leave_requests AUTO_INCREMENT = 1;

ALTER TABLE password_resets AUTO_INCREMENT = 1;
ALTER TABLE user_sessions AUTO_INCREMENT = 1;
ALTER TABLE whatsapp_message_logs AUTO_INCREMENT = 1;

SELECT 'Limpieza operativa finalizada. Usuarios, empleados, sectores, medicamentos, ambulancias, choferes, claves y reglas fueron conservados.' AS resultado;
