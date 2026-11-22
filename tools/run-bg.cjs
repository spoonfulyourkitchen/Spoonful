const { spawn } = require('child_process');
const fs = require('fs');

const [logPath, cwd, cmd, ...args] = process.argv.slice(2);
if (!logPath || !cwd || !cmd) {
  console.error('usage: node tools/run-bg.cjs <log> <cwd> <cmd> [args...]');
  process.exit(2);
}

const out = fs.openSync(logPath, 'w');
fs.writeFileSync(logPath + '.state', 'running');
const child = spawn(cmd, args, { cwd, detached: true, stdio: ['ignore', out, out] });
child.on('exit', (code) => {
  try {
    fs.writeFileSync(logPath + '.state', 'exit=' + code);
  } catch {
    
  }
});
child.unref();
console.log('started pid ' + child.pid);
