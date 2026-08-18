/**
 * Tutus End-to-End Smoke Test
 *
 * Prerequisites: Vault running on :4000, Tutus server running on :3000
 * Run: node e2e/smoke.test.mjs
 *
 * This test verifies the complete investigation flow produces
 * the expected finding: "Employee can update payout account"
 */

const VAULT_URL = 'http://localhost:4000';
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

async function waitForFinding(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`${SERVER_URL}/api/status`);
      const status = await res.json();
      if (status.status === 'complete' || status.status === 'idle') {
        const findingsRes = await fetch(`${SERVER_URL}/api/findings`);
        const data = await findingsRes.json();
        return data.findings[0] || null;
      }
    } catch {
      // Connection error while server is busy with Playwright — retry
    }
  }
  return null;
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Tutus E2E Smoke Test               ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Check Vault is running
  console.log('1. Checking Vault...');
  try {
    const vaultRes = await fetch(`${VAULT_URL}/api/me`);
    assert(vaultRes.status === 401, 'Vault responds with 401 (running, auth required)');
  } catch (err) {
    console.log(`  ✗ FATAL: Vault not reachable at ${VAULT_URL}: ${err.message}`);
    process.exit(1);
  }

  // 2. Check Tutus server is running
  console.log('2. Checking Tutus Server...');
  try {
    const serverRes = await fetch(`${SERVER_URL}/api/status`);
    const serverStatus = await serverRes.json();
    assert(serverRes.status === 200, 'Tutus server responds');
    assert(serverStatus.status === 'idle', 'Server is idle (no active investigation)');
  } catch (err) {
    console.log(`  ✗ FATAL: Server not reachable at ${SERVER_URL}: ${err.message}`);
    process.exit(1);
  }

  // 3. Verify the vulnerability exists
  console.log('3. Verifying vulnerability exists in Vault...');
  const session = {};
  const loginRes = await fetch(`${VAULT_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@acme.com', password: 'employee123' }),
    redirect: 'manual',
  });
  const cookies = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(',') || [];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  const payoutRes = await fetch(`${VAULT_URL}/api/billing/payout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    body: JSON.stringify({ payoutAccount: 'E2E-TEST-VERIFY' }),
  });
  assert(payoutRes.status === 200, 'Employee can PUT payout (vulnerability confirmed)');

  // Reset payout for investigation
  await fetch(`${VAULT_URL}/api/billing/payout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    body: JSON.stringify({ payoutAccount: 'ACME-BANK-001' }),
  });

  // 4. Start investigation
  console.log('4. Starting investigation...');
  const investigateRes = await fetch(`${SERVER_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: VAULT_URL,
      username: 'employee@acme.com',
      password: 'employee123',
    }),
  });
  const investigateData = await investigateRes.json();
  assert(investigateRes.status === 200, 'Investigation started successfully');
  assert(!!investigateData.investigationId, `Got investigation ID: ${investigateData.investigationId}`);

  // 5. Wait for completion
  console.log('5. Waiting for investigation to complete (up to 2 min)...');
  const finding = await waitForFinding(TIMEOUT_MS);
  assert(!!finding, 'Investigation produced a finding');

  if (!finding) {
    console.log('\n  ✗ FATAL: No finding produced. Check server logs.');
    process.exit(1);
  }

  // 6. Validate finding structure
  console.log('6. Validating finding...');
  assert(finding.title.toLowerCase().includes('payout'), `Title mentions payout: "${finding.title}"`);
  assert(finding.severity === 'critical', `Severity is critical (got: ${finding.severity})`);
  assert(finding.confidence === 'high', `Confidence is high (got: ${finding.confidence})`);
  assert(finding.actor.email === 'employee@acme.com', `Actor is employee (got: ${finding.actor.email})`);
  assert(finding.actor.role === 'employee', `Actor role is employee (got: ${finding.actor.role})`);
  assert(finding.expectedPrivilege === 'admin', `Expected privilege is admin (got: ${finding.expectedPrivilege})`);
  assert(finding.actualPrivilege === 'employee', `Actual privilege is employee (got: ${finding.actualPrivilege})`);
  assert(finding.impact.length > 50, `Impact description is substantive (${finding.impact.length} chars)`);

  // 7. Validate evidence
  console.log('7. Validating evidence...');
  assert(finding.evidence.screenshots.length >= 1, `Has screenshots (${finding.evidence.screenshots.length})`);
  assert(!!finding.evidence.request, 'Has captured HTTP request');
  assert(!!finding.evidence.response, 'Has captured HTTP response');

  if (finding.evidence.request) {
    assert(finding.evidence.request.method === 'PUT', `Request method is PUT (got: ${finding.evidence.request.method})`);
    assert(finding.evidence.request.url.includes('/api/billing/payout'), `Request URL targets payout endpoint`);
  }

  if (finding.evidence.response) {
    assert(finding.evidence.response.status === 200, `Response status is 200 (got: ${finding.evidence.response.status})`);
    assert(finding.evidence.response.body.includes('success'), 'Response body confirms success');
  }

  // 8. Validate reproduction steps
  console.log('8. Validating reproduction steps...');
  assert(finding.reproductionSteps.length >= 3, `Has reproduction steps (${finding.reproductionSteps.length})`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! The vertical slice is working end-to-end.\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
