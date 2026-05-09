const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const rootDir =
  path.resolve(__dirname, '..');

const frontendDir =
  path.join(rootDir, 'frontend');

const androidDir =
  path.join(frontendDir, 'android');

const androidStudioJava =
  'C:\\Program Files\\Android\\Android Studio\\jbr';

const localAndroidSdk =
  path.join(
    process.env.LOCALAPPDATA || '',
    'Android',
    'Sdk'
  );

const javaHome =
  process.env.JAVA_HOME ||
  (
    existsSync(
      path.join(
        androidStudioJava,
        'bin',
        'java.exe'
      )
    )
      ? androidStudioJava
      : ''
  );

const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (
    existsSync(localAndroidSdk)
      ? localAndroidSdk
      : ''
  );

if (!javaHome) {
  console.error(
    'No encontre Java. Abri Android Studio una vez o configura JAVA_HOME.'
  );
  process.exit(1);
}

if (!androidHome) {
  console.error(
    'No encontre Android SDK. Abri Android Studio y completa el SDK Manager.'
  );
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  Path: [
    path.join(javaHome, 'bin'),
    path.join(androidHome, 'platform-tools'),
    path.join(
      androidHome,
      'cmdline-tools',
      'latest',
      'bin'
    ),
    process.env.Path || process.env.PATH || ''
  ].join(';')
};

const command =
  process.platform === 'win32'
    ? 'gradlew.bat'
    : './gradlew';

const result =
  spawnSync(
    command,
    ['assembleDebug'],
    {
      cwd: androidDir,
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32'
    }
  );

process.exit(result.status || 0);
