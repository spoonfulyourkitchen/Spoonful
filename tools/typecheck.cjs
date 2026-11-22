const fs = require('fs');
const path = require('path');
const ts = require(path.join('D:/Spoonful/mobile', 'node_modules', 'typescript'));

const projectDir = 'D:/Spoonful/mobile';
const logPath = 'D:/Spoonful/typecheck.log';
const statePath = 'D:/Spoonful/typecheck.state.json';

const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { done: [], errors: [], programMs: 0 };
const done = new Set(state.done);

const config = ts.readConfigFile(path.join(projectDir, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);
const options = { ...parsed.options, noEmit: true, skipLibCheck: true };

const t0 = Date.now();
const program = ts.createProgram(
  parsed.fileNames.filter((f) => !f.includes('__tests__')),
  options,
);
state.programMs = Date.now() - t0;

const fmt = (d) => {
  const file = d.file ? path.relative(projectDir, d.file.fileName) : '?';
  const pos = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
  return pos
    ? `${file}(${pos.line + 1},${pos.character + 1}): TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
    : `${file}: TS${d.code}`;
};

const flush = () => {
  fs.writeFileSync(statePath, JSON.stringify(state));
  fs.writeFileSync(logPath, state.errors.join('\n') + `\nPROGRESS ${state.done.length} ok, ${state.errors.length} errors\n`);
};

for (const d of program.getSyntacticDiagnostics()) state.errors.push('SYNTAX ' + fmt(d));

const files = program
  .getSourceFiles()
  .filter((f) => !f.fileName.includes('node_modules') && f.fileName.startsWith(projectDir) && !f.fileName.includes('__tests__'));

for (const f of files) {
  const rel = path.relative(projectDir, f.fileName);
  if (done.has(rel)) continue;
  for (const d of program.getSemanticDiagnostics(f)) state.errors.push(fmt(d));
  done.add(rel);
  state.done = [...done];
  flush();
}
flush();
fs.appendFileSync(logPath, `DONE ${state.done.length} files checked, ${state.errors.length} errors, program ${state.programMs}ms\n`);
