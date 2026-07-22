# Agente local de WhatsApp

La aplicacion de Railway guarda los envios en `whatsapp_outbox`. Una PC local consulta esa cola por HTTPS, envia con la integracion existente de WhatsApp Web e informa el resultado. La PC no escucha conexiones ni necesita puertos abiertos.

## 1. Configurar Railway

Agregar estas variables al backend:

```env
WHATSAPP_DELIVERY_MODE=queue
WHATSAPP_AGENT_KEY=una-clave-aleatoria-de-al-menos-32-caracteres
WHATSAPP_QUEUE_MAX_ATTEMPTS=5
WHATSAPP_QUEUE_RETRY_SECONDS=30
WHATSAPP_QUEUE_LOCK_MINUTES=5
```

La tabla se crea automaticamente al primer envio o consulta. El archivo `backend/database/whatsapp_outbox.sql` permite crearla manualmente si se prefiere administrar migraciones por SQL.

No configurar `WHATSAPP_AGENT_API_URL` en Railway. La clave debe tratarse como un secreto y no debe guardarse en Git.

## 2. Configurar la PC local

Crear o completar `backend/.env` (no se versiona):

```env
WHATSAPP_AGENT_API_URL=https://DOMINIO-REAL-DEL-BACKEND
WHATSAPP_AGENT_KEY=la-misma-clave-de-railway
WHATSAPP_AGENT_ID=hospital-punta-lara-pc
WHATSAPP_AGENT_POLL_MS=5000
WHATSAPP_SESSION_PATH=D:\\Hospital-WhatsApp\\session
WHATSAPP_HEADLESS=true
WHATSAPP_ENABLE_INCOMING_BOT=false
```

`WHATSAPP_AGENT_API_URL` exige HTTPS. La sesion queda en la ruta local indicada y permite reconectar despues de reiniciar.

Instalar, compilar y ejecutar desde la raiz:

```powershell
npm run install:all
npm run build:backend
npm run whatsapp:agent
```

En el primer inicio aparece un QR en la consola. Escanearlo desde WhatsApp > Dispositivos vinculados. El proceso reintenta la conexion y el sondeo automaticamente. Para inicio automatico en Windows, crear una tarea del Programador de tareas que ejecute `npm run whatsapp:agent` al iniciar el equipo, con la carpeta del proyecto como directorio de trabajo y reinicio ante error.

## Estados y reintentos

- `pending`: esperando al agente.
- `processing`: reservado temporalmente por un agente.
- `sent`: WhatsApp confirmo el envio.
- `failed`: alcanzo el maximo de intentos.

Los errores vuelven a `pending` con espera exponencial. Un trabajo bloqueado por un cierre inesperado se libera despues de `WHATSAPP_QUEUE_LOCK_MINUTES`. El agente solo puede confirmar trabajos que el mismo reservo.

La entrega es de tipo "al menos una vez": si WhatsApp acepta un mensaje pero se corta Internet antes de confirmar el resultado a Railway, el trabajo puede volver a enviarse al vencer el bloqueo. El agente reintenta la confirmacion varias veces para reducir ese caso excepcional.

## Desarrollo y migracion futura

Con `WHATSAPP_DELIVERY_MODE=direct`, el backend conserva el comportamiento actual y envia directamente mediante WhatsApp Web. Para migrar a un servidor propio, copiar el proyecto y la carpeta de sesion, configurar las mismas variables del agente y ejecutar el mismo comando; Railway y el frontend no requieren cambios.
