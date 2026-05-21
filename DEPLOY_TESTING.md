# Deploy de prueba

Esta guia deja el proyecto preparado para probarlo en internet mientras sigue en desarrollo.

## Objetivo

- Publicar el backend en un servicio de prueba.
- Usar una base MySQL separada de la base local.
- Publicar el frontend web o generar una APK apuntando al backend publico.
- Evitar subir claves reales al repositorio.

## Opcion recomendada para pruebas

Para probar rapido, usar:

- Backend: Railway, Render u otro servicio Node.
- Base de datos: MySQL administrado de prueba.
- Frontend web: Vercel, Netlify o el mismo proveedor si permite sitios estaticos.

Cuando el sistema tenga datos reales de pacientes, personal o usuarios, conviene pasar a un servicio pago con backups, HTTPS, monitoreo y permisos bien controlados.

## Variables del backend

Copiar `backend/.env.example` como referencia y cargar estas variables en el panel del servidor:

- `PORT`: normalmente lo define el hosting. Si no, usar `4000`.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: datos de la base MySQL de prueba.
- `DB_SSL`: usar `true` si el proveedor de MySQL lo pide.
- `DB_SSL_REJECT_UNAUTHORIZED`: dejar `true`; para pruebas puede usarse `false` si el proveedor no entrega certificado CA.
- `JWT_SECRET` y `JWT_REFRESH_SECRET`: usar textos largos y privados.
- `FRONTEND_URL`: direccion publica del frontend.
- `CORS_ORIGINS`: direcciones permitidas separadas por coma.
- `MAIL_*`: datos del correo para recuperar contrasenas.

Ejemplo:

```env
FRONTEND_URL=https://hospital-prueba.vercel.app
CORS_ORIGINS=https://hospital-prueba.vercel.app,capacitor://localhost,http://localhost
```

## Comandos del backend

Desde la raiz del proyecto:

```bash
npm run install:all
npm run build:backend
npm run start:backend
```

Si el proveedor pide una carpeta de trabajo, usar `backend`.

Dentro de `backend`:

```bash
npm install
npm run build
npm run start
```

## Base de datos de prueba

Para probar con datos reales simulados:

1. Crear una base MySQL vacia en el proveedor.
2. Exportar desde phpMyAdmin la estructura y los datos necesarios de prueba.
3. Importar ese archivo SQL en la base de prueba.
4. Cargar las variables `DB_*` en el backend publicado.

No conviene subir dumps con datos sensibles al repositorio.

## Frontend web

Crear `frontend/.env.production` usando `frontend/.env.production.example` como guia:

```env
VITE_API_URL=https://tu-backend-publico.com
```

Luego compilar:

```bash
npm --prefix frontend run build
```

El contenido generado queda en `frontend/dist`.

## APK Android

Crear o editar `frontend/.env.android`:

```env
VITE_API_URL=https://tu-backend-publico.com
```

Despues generar la APK:

```bash
npm run android:apk
```

La APK queda en:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Verificacion rapida

Cuando el backend este publicado, abrir:

```text
https://tu-backend-publico.com/health
```

Debe responder:

```json
{
  "success": true,
  "message": "Backend disponible"
}
```
