/**
 * Tutus Health Check — run before starting services.
 * Checks for common issues that prevent Tutus from working correctly.
 *
 * Usage: npm run doctor
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(ok, label, fix) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    console.log(`    Fix: ${fix}`);
  }
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

async function main() {
  console.log('\n  Tutus Doctor\n');

  // 1. Check ports
  console.log('  Ports:');
  const port3000 = await isPortFree(3000);
  check(port3000, 'Port 3000 is free (Tutus Server)', 'Stop the process using port 3000, or set SERVER_PORT env var');

  const port4000 = await isPortFree(4000);
  check(port4000, 'Port 4000 is free (Vault)', 'Stop the process using port 4000, or set VAULT_PORT env var');

  const port5173 = await isPortFree(5173);
  check(port5173, 'Port 5173 is free (Tutus UI)', 'Stop the Vite dev server using port 5173');

  const port4001 = await isPortFree(4001);
  check(port4001, 'Port 4001 is free (Hardened Vault)', 'Stop the hardened Vault instance on port 4001');

  // 2. Check Playwright
  console.log('\n  Playwright:');
  let playwrightOk = false;
  try {
    const result = execSync('npx playwright --version', { cwd: ROOT, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
    playwrightOk = result.includes('.');
  } catch {}
  check(playwrightOk, 'Playwright is installed', 'Run: npx playwright install chromium');

  let chromiumOk = false;
  try {
    // Check common Playwright browser cache locations
    const localAppData = process.env.LOCALAPPDATA || '';
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const candidates = [
      path.join(localAppData, 'ms-playwright'),
      path.join(home, 'AppData', 'Local', 'ms-playwright'),
      path.join(home, '.cache', 'ms-playwright'),
    ];
    chromiumOk = candidates.some(dir =>
      fs.existsSync(dir) && fs.readdirSync(dir).some(d => d.startsWith('chromium'))
    );
  } catch {}
  check(chromiumOk, 'Chromium browser is available', 'Run: npx playwright install chromium');

  // 3. Check stale database
  console.log('\n  Database:');
  const dbPath = path.join(ROOT, 'packages', 'vault', 'vault.db');
  const dbExists = fs.existsSync(dbPath);
  check(!dbExists, 'No stale vault.db present', `Delete: ${dbPath} (it will be recreated on start)`);

  // 4. Check node_modules
  console.log('\n  Dependencies:');
  const nmExists = fs.existsSync(path.join(ROOT, 'node_modules'));
  check(nmExists, 'node_modules installed', 'Run: npm install');

  // Summary
  console.log(`\n  ──────────────────────────────`);
  console.log(`  ${passed} passed, ${failed} issue${failed !== 1 ? 's' : ''}`);
  if (failed === 0) {
    console.log('  Ready to start: npm run dev');
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Doctor failed:', err.message); process.exit(1); });
