const { spawn } = require('child_process');

const isWindows =
  process.platform === 'win32';

function npmScript(
  folder,
  script
) {

  if (isWindows) {
    return {
      command: 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        `npm --prefix ${folder} run ${script}`
      ]
    };
  }

  return {
    command: 'npm',
    args: [
      '--prefix',
      folder,
      'run',
      script
    ]
  };
}

const processes = [
  {
    name: 'backend',
    color: '\x1b[36m',
    ...npmScript(
      'backend',
      'dev'
    )
  },
  {
    name: 'frontend',
    color: '\x1b[35m',
    ...npmScript(
      'frontend',
      'dev:lan'
    )
  }
];

const resetColor = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixOutput(
  name,
  color,
  chunk
) {

  const text =
    chunk.toString();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    process.stdout.write(
      `${color}[${name}]${resetColor} ${line}\n`
    );
  }
}

function stopAll() {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const item of processes) {
  const child =
    spawn(
      item.command,
      item.args,
      {
        cwd: process.cwd(),
        shell: false,
        env: process.env
      }
    );

  children.push(child);

  child.stdout.on(
    'data',
    (chunk) =>
      prefixOutput(
        item.name,
        item.color,
        chunk
      )
  );

  child.stderr.on(
    'data',
    (chunk) =>
      prefixOutput(
        item.name,
        item.color,
        chunk
      )
  );

  child.on(
    'exit',
    (code) => {
      if (!shuttingDown) {
        console.log(
          `[${item.name}] proceso finalizado con codigo ${code}`
        );
        stopAll();
      }
    }
  );
}

process.on(
  'SIGINT',
  stopAll
);

process.on(
  'SIGTERM',
  stopAll
);
