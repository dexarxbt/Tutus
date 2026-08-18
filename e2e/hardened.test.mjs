/**
 * Tutus Hardened Vault Test
 *
 * Tests that when Vault runs with VAULT_HARDENED=true,
 * Tutus correctly reports NO confirmed vulnerability.
 *
 * Prerequisites:
 *   - Vault running on :4001 with VAULT_HARDENED=true
 *   - Tutus server running on :3000
 *
 * Run:
 *   set VAULT_HARDENED=true&& set VAULT_PORT=4001&& npx tsx src/index.ts  (in packages/vault)
 *   node e2e/hardened.test.mjs
 */

const VAULT_URL = 'http://localhost:4001';
const SERVER_URL = 'http://localhost:3000';
const TIMEOUT_MS = 120_000;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAILED: ${message}`);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Tutus Hardened Vault Test           ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Check hardened Vault is running
  console.log('1. Checking hardened Vault...');
  try {
    const vaultRes = await fetch(`${VAULT_URL}/api/me`);
    assert(vaultRes.status === 401, 'Hardened Vault responds (401)');
  } catch (err) {
    console.log(`  ✗ FATAL: Hardened Vault not reachable at ${VAULT_URL}`);
    console.log(`  Start it with: $env:VAULT_HARDENED='true'; $env:VAULT_PORT='4001'; npx tsx src/index.ts`);
    process.exit(1);
  }

  // 2. Verify the flaw is FIXED in hardened mode
  console.log('2. Verifying flaw is fixed...');
  const loginRes = await fetch(`${VAULT_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@acme.com', password: 'employee123' }),
  });
  const cookies = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(',') || [];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  const payoutRes = await fetch(`${VAULT_URL}/api/billing/payout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    body: JSON.stringify({ payoutAccount: 'SHOULD-FAIL' }),
  });
  assert(payoutRes.status === 403, `Employee PUT payout returns 403 in hardened mode (got: ${payoutRes.status})`);

  // 3. Run investigation against hardened Vault
  console.log('3. Starting investigation against hardened Vault...');
  const investigateRes = await fetch(`${SERVER_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: VAULT_URL,
      username: 'employee@acme.com',
      password: 'employee123',
    }),
  });
  assert(investigateRes.status === 200, 'Investigation started');

  // 4. Wait for completion
  console.log('4. Waiting for investigation to complete...');
  let finalStatus = null;
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusRes = await fetch(`${SERVER_URL}/api/status`);
      const status = await statusRes.json();
      if (status.status === 'complete' || status.status === 'idle') {
        finalStatus = status.status;
        break;
      }
    } catch {
      // Connection error while server is busy — retry
    }
  }
  assert(finalStatus !== null, 'Investigation completed within timeout');

  // 5. Verify NO confirmed finding
  console.log('5. Verifying no confirmed finding...');
  const findingsRes = await fetch(`${SERVER_URL}/api/findings`);
  const findingsData = await findingsRes.json();

  // Findings are scoped to the current investigation — array should be empty
  assert(findingsData.findings.length === 0, `No findings produced against hardened vault (found: ${findingsData.findings.length})`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
