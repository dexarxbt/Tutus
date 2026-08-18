/**
 * Tutus Replay Test
 *
 * Prerequisites: Vault running on :4000, Tutus server running on :3000
 * Must have a completed investigation with a finding first.
 *
 * Run: node e2e/replay.test.mjs
 */

const SERVER_URL = 'http://localhost:3000';

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
  console.log('║   Tutus Replay Test                   ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Get existing finding
  console.log('1. Getting existing finding...');
  const findingsRes = await fetch(`${SERVER_URL}/api/findings`);
  const findingsData = await findingsRes.json();
  assert(findingsData.findings.length > 0, 'Has at least one finding');

  if (findingsData.findings.length === 0) {
    console.log('  No findings available. Run smoke.test.mjs first.');
    process.exit(1);
  }

  const finding = findingsData.findings[0];
  console.log(`  Finding: "${finding.title}" (${finding.id})`);

  // 2. Start replay
  console.log('2. Starting replay...');
  const replayRes = await fetch(`${SERVER_URL}/api/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ findingId: finding.id }),
  });
  const replayStart = await replayRes.json();
  assert(replayRes.status === 200, 'Replay started successfully');
  assert(replayStart.success === true, 'Replay response confirms start');

  // 3. Wait for replay to complete
  console.log('3. Waiting for replay to complete (up to 60s)...');
  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const resultRes = await fetch(`${SERVER_URL}/api/replay/${finding.id}/full`);
      if (resultRes.ok) {
        result = await resultRes.json();
        break;
      }
    } catch {
      // Connection error during replay (server busy with Playwright) - retry
    }
  }

  assert(result !== null, 'Replay completed within timeout');

  if (!result) {
    console.log('  Replay did not complete.');
    process.exit(1);
  }

  // 4. Validate replay result
  console.log('4. Validating replay result...');
  assert(result.success === true, 'Replay executed successfully');
  assert(result.verified === true, 'Vulnerability still confirmed exploitable');
  assert(result.screenshots.length >= 1, `Has replay screenshots (${result.screenshots.length})`);
  assert(result.request !== null, 'Has captured replay request');
  assert(result.response !== null, 'Has captured replay response');

  if (result.request) {
    assert(result.request.method === 'PUT', `Replay request method is PUT`);
    assert(result.request.url.includes('/api/billing/payout'), 'Replay targets payout endpoint');
    assert(result.request.body.includes('REPLAY-'), 'Replay uses distinct test value (REPLAY- prefix)');
  }

  if (result.response) {
    assert(result.response.status === 200, `Replay response is 200 (got: ${result.response.status})`);
    assert(result.response.body.includes('success'), 'Replay response confirms success');
  }

  // 5. Verify replay evidence is distinct from original
  console.log('5. Verifying evidence distinction...');
  const originalBody = finding.evidence.request?.body || '';
  const replayBody = result.request?.body || '';
  assert(originalBody !== replayBody, 'Replay request body differs from original (distinct test values)');

  if (result.screenshots.length > 0) {
    assert(result.screenshots[0].name.includes('Replay'), 'Replay screenshots are labeled with "Replay"');
  }

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
