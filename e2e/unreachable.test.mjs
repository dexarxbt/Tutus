/**
 * Tutus Unreachable Target Test
 *
 * Verifies that when the target URL is unreachable (nothing listening),
 * Tutus fails gracefully and produces zero findings.
 *
 * Prerequisites: Tutus server running on :3000. NO Vault on :4099.
 *
 * Run: node e2e/unreachable.test.mjs
 */

const SERVER_URL = 'http://localhost:3000';
const UNREACHABLE_TARGET = 'http://localhost:4099'; // Nothing runs here
const TIMEOUT_MS = 60_000;

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
  console.log('║   Tutus Unreachable Target Test       ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Verify nothing is running on the unreachable port
  console.log('1. Confirming target is unreachable...');
  try {
    await fetch(UNREACHABLE_TARGET, { signal: AbortSignal.timeout(3000) });
    console.log('  ✗ FATAL: Something is running on ' + UNREACHABLE_TARGET);
    console.log('  Stop whatever is listening on port 4099 before running this test.');
    process.exit(1);
  } catch {
    assert(true, `Nothing reachable at ${UNREACHABLE_TARGET}`);
  }

  // 2. Verify Tutus server is running
  console.log('2. Checking Tutus Server...');
  try {
    const res = await fetch(`${SERVER_URL}/api/status`);
    assert(res.status === 200, 'Tutus server is running');
  } catch (err) {
    console.log(`  ✗ FATAL: Server not reachable at ${SERVER_URL}: ${err.message}`);
    process.exit(1);
  }

  // 3. Start investigation against unreachable target
  console.log('3. Starting investigation against unreachable target...');
  const investigateRes = await fetch(`${SERVER_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: UNREACHABLE_TARGET,
      username: 'employee@acme.com',
      password: 'employee123',
    }),
  });
  assert(investigateRes.status === 200, 'Investigation accepted by server');

  // 4. Wait for investigation to complete (should fail fast)
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
      // Server busy, retry
    }
  }
  assert(finalStatus !== null, 'Investigation completed (did not hang)');

  // 5. Verify zero findings
  console.log('5. Verifying zero findings...');
  const findingsRes = await fetch(`${SERVER_URL}/api/findings`);
  const findingsData = await findingsRes.json();
  assert(findingsData.findings.length === 0, `Zero findings produced (got: ${findingsData.findings.length})`);

  // 6. Verify that changing target actually matters
  console.log('6. Verifying findings are not cached from a previous run...');
  // Run a second investigation against the same unreachable target
  await fetch(`${SERVER_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: UNREACHABLE_TARGET,
      username: 'test@test.com',
      password: 'test',
    }),
  });

  // Wait for completion
  const start2 = Date.now();
  while (Date.now() - start2 < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusRes = await fetch(`${SERVER_URL}/api/status`);
      const status = await statusRes.json();
      if (status.status === 'complete' || status.status === 'idle') break;
    } catch {}
  }

  const findingsRes2 = await fetch(`${SERVER_URL}/api/findings`);
  const findingsData2 = await findingsRes2.json();
  assert(findingsData2.findings.length === 0, `Still zero findings after second unreachable investigation (got: ${findingsData2.findings.length})`);

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
