// Lancia tutte le prove della cartella, una per volta. Esce con errore se una fallisce.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
let fallite = 0;
for (const f of readdirSync(qui).filter(n => n.endsWith('.mjs') && n !== 'esegui.mjs').sort()) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(qui, f)], { stdio: 'inherit' });
  if (r.status !== 0) fallite++;
}
process.exit(fallite ? 1 : 0);
