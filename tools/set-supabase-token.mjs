import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokenPath = process.argv[2] ?? path.join(root, '.token.new');
const envPath = path.join(root, '.env.local');

if (!existsSync(tokenPath)) {
  console.error(`Token-Datei fehlt: ${tokenPath}`);
  process.exit(1);
}

const token = (readFileSync(tokenPath, 'utf8').trim().split(/\s+/)[0] ?? '');
rmSync(tokenPath, { force: true });

if (!/^sbp_[A-Za-z0-9]{16,}$/.test(token)) {
  console.error('Das sieht nicht wie ein Supabase-Management-Token aus (sbp_...).');
  process.exit(1);
}

const response = await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) {
  console.error(`Management API antwortet ${response.status}. Token nicht gespeichert.`);
  process.exit(1);
}

let envText = '';
try {
  envText = readFileSync(envPath, 'utf8');
} catch {
  envText = '';
}

const line = `SUPABASE_ACCESS_TOKEN=${token}`;
if (/^SUPABASE_ACCESS_TOKEN=.*$/m.test(envText)) {
  envText = envText.replace(/^SUPABASE_ACCESS_TOKEN=.*$/m, line);
} else {
  envText = `${envText.replace(/\s*$/, '')}\n${line}\n`;
}

writeFileSync(envPath, envText, 'utf8');
console.log('Neuer Token geprueft und in .env.local gespeichert.');
