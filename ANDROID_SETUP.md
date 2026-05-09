# Android

El proyecto usa Capacitor para empaquetar el frontend React/Vite como app Android.

## Comandos

Desde la raiz del proyecto:

```bash
npm run android:sync
```

Compila el frontend en modo Android y sincroniza los archivos con Capacitor.

```bash
npm run android:open
```

Abre el proyecto Android en Android Studio.

```bash
npm run android:apk
```

Genera una APK debug cuando Java/JDK y Android SDK estan instalados.

La APK debug queda en:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Requisitos para crear APK

Instalar Android Studio, que incluye:

- Android SDK
- Gradle tooling
- JDK compatible

Despues de instalarlo, verificar que exista `JAVA_HOME` y que el comando `java` funcione en la terminal.

## Backend/API

Para Android, el frontend usa:

```text
frontend/.env.android
```

Actualmente apunta a:

```text
VITE_API_URL=http://192.168.0.157:4000
```

Cuando el sistema se suba a un servidor, cambiar esa URL por el dominio real del backend, por ejemplo:

```text
VITE_API_URL=https://api.hospitalpuntalara.com
```

Mientras se use HTTP en red local, Android tiene una excepcion de seguridad para `192.168.0.157` en:

```text
frontend/android/app/src/main/res/xml/network_security_config.xml
```

En produccion conviene usar HTTPS y eliminar la excepcion de HTTP local.
