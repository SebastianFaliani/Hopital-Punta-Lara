# Reconfigurar Railway

## Servicios necesarios

El proyecto necesita dos servicios en Railway:

- Backend Node conectado al repositorio de GitHub.
- MySQL en el mismo proyecto de Railway.

## Backend

Railway debe detectar estos archivos desde la raiz del repo:

- `railway.json`
- `nixpacks.toml`
- `package.json`

La configuracion esperada es:

- Build command: `npm run install:all && npm run build:backend`
- Start command: `npm run start:backend`
- Healthcheck: `/health`

El backend escucha en `0.0.0.0:$PORT`, asi que no hace falta definir `PORT` manualmente.

## Variables del backend

Si el servicio MySQL esta en el mismo proyecto, en el servicio Backend hay que crear referencias a las variables del servicio MySQL. En la pestana `Variables` del backend, agregar:

```env
MYSQLHOST=${{ MySQL.MYSQLHOST }}
MYSQLPORT=${{ MySQL.MYSQLPORT }}
MYSQLUSER=${{ MySQL.MYSQLUSER }}
MYSQLPASSWORD=${{ MySQL.MYSQLPASSWORD }}
MYSQLDATABASE=${{ MySQL.MYSQLDATABASE }}
MYSQL_URL=${{ MySQL.MYSQL_URL }}
```

Si el servicio de base tiene otro nombre, reemplazar `MySQL` por el nombre exacto del servicio en Railway.

El backend tambien entiende estas variables locales si se prefieren cargar manualmente:

- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`
- `MYSQL_URL`

Ademas hay que cargar estas variables privadas:

```env
JWT_SECRET=usar_un_texto_largo_y_privado
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=usar_otro_texto_largo_y_privado
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
FRONTEND_URL=https://tu-frontend-publico
CORS_ORIGINS=https://tu-frontend-publico,capacitor://localhost,http://localhost,ionic://localhost
```

Para recuperacion de contrasena, usar Resend o SMTP:

```env
RESEND_API_KEY=
RESEND_FROM=
MAIL_HOST=
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
```

## Cargar datos en el nuevo MySQL

Si hay que restaurar la ultima copia local en el MySQL nuevo de Railway:

1. En Railway, abrir el servicio MySQL.
2. Copiar la URL publica de conexion o activar el TCP Proxy.
3. Usar un backup de `backups/`, por ejemplo:

```powershell
node .\scripts\import-railway-mysql.js --host=HOST --port=PUERTO --user=root --database=railway --file=.\backups\archivo.sql
```

El script pide la password sin mostrarla en pantalla.

## Verificacion

Cuando Railway termine el deploy, abrir:

```text
https://TU_BACKEND.up.railway.app/health
```

Debe responder:

```json
{
  "success": true,
  "message": "Backend disponible"
}
```
