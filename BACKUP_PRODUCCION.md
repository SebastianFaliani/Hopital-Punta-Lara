# Backup diario de produccion

Este backup descarga la base de datos de produccion y guarda un archivo `.sql` en la PC.

## Comando manual

Desde la raiz del proyecto:

```bash
PRODUCTION_BACKUP_DIR='C:\Backups\HospitalPuntaLara\produccion-db' MYSQL_PUBLIC_URL='mysql://root:TU_PASSWORD@HOST:PUERTO/railway' npm run backup:production
```

Si queres guardar directo en Google Drive para escritorio, cambia `PRODUCTION_BACKUP_DIR` por la ruta local de Google Drive, por ejemplo:

```bash
PRODUCTION_BACKUP_DIR='G:\Mi unidad\Backups Hospital Punta Lara\produccion-db' MYSQL_PUBLIC_URL='mysql://root:TU_PASSWORD@HOST:PUERTO/railway' npm run backup:production
```

## Retencion

Por defecto conserva backups de los ultimos 30 dias.

Para cambiarlo:

```bash
PRODUCTION_BACKUP_RETENTION_DAYS=60 MYSQL_PUBLIC_URL='mysql://root:TU_PASSWORD@HOST:PUERTO/railway' npm run backup:production
```

## Programador de tareas de Windows

Crear una tarea diaria:

- Nombre: `Backup produccion Hospital Punta Lara`
- Frecuencia: diaria
- Hora sugerida: 23:00
- Programa: `cmd.exe`
- Argumentos:

```txt
/c cd /d "C:\Users\Sebastian\Desktop\Hospital Punta Lara" && set "PRODUCTION_BACKUP_DIR=C:\Backups\HospitalPuntaLara\produccion-db" && set "MYSQL_PUBLIC_URL=mysql://root:TU_PASSWORD@HOST:PUERTO/railway" && npm run backup:production
```

Si usas Google Drive para escritorio, cambiar la carpeta:

```txt
set "PRODUCTION_BACKUP_DIR=G:\Mi unidad\Backups Hospital Punta Lara\produccion-db"
```

## Restaurar en desarrollo

Para cargar un backup en la base local:

```bash
node scripts/apply-sql-file-safe.js "C:\Backups\HospitalPuntaLara\produccion-db\backup-produccion-railway-AAAA-MM-DD-HHMMSS.sql"
```

Si XAMPP/MariaDB da error con `utf8mb4_0900_ai_ci`, primero convertir el archivo:

```bash
node scripts/normalize-mysql-backup-for-local.js "C:\Backups\HospitalPuntaLara\produccion-db\backup-produccion-railway-AAAA-MM-DD-HHMMSS.sql"
```
