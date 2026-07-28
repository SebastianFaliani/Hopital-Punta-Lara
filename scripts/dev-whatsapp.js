const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const children = [];
let shuttingDown = false;

const commonEnv = {
  ...process.env,
  WHATSAPP_DELIVERY_MODE: 'queue',
  CORS_ORIGINS: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175'
  ].join(',')
};

const processes = [
  {
    name: 'backend',
    color: '\x1b[36m',
    args: ['--prefix', 'backend', 'run', 'dev'],
    env: commonEnv
  },
  {
    name: 'frontend',
    color: '\x1b[35m',
    args: ['--prefix', 'frontend', 'run', 'dev'],
    env: commonEnv
  },
  {
    name: 'whatsapp-dev',
    color: '\x1b[32m',
    args: ['--prefix', 'backend', 'run', 'whatsapp:agent'],
    env: {
      ...commonEnv,
      WHATSAPP_AGENT_API_URL: 'http://127.0.0.1:4000',
      WHATSAPP_AGENT_ID: 'hospital-punta-lara-development',
      WHATSAPP_SESSION_PATH: 'D:\\Hospital-WhatsApp\\session-development'
    }
  }
];

function prefixOutput(name, color, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
  }
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

for (const item of processes) {
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', `npm ${item.args.join(' ')}`]
    : item.args;
  const child = spawn(command, args, {
    cwd: process.cwd(),
    shell: false,
    env: item.env
  });
  children.push(child);
  child.stdout.on('data', (chunk) => prefixOutput(item.name, item.color, chunk));
  child.stderr.on('data', (chunk) => prefixOutput(item.name, item.color, chunk));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`[${item.name}] proceso finalizado con codigo ${code}`);
      stopAll();
    }
  });
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
