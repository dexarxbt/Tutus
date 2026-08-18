/**
 * Tutus 10-Cycle Reliability Stress Test
 *
 * Runs 10 cycles of: vulnerable(:4000) → hardened(:4001) → vulnerable(:4000)
 * without restarting any service between runs.
 *
 * Prerequisites:
 *   - Vault running on :4000 (normal)
 *   - Vault running on :4001 (VAULT_HARDENED=true)
 *   - Tutus Server running on :3000
 *
 * Validates:
 *   - Vulnerable investigation always produces a critical payout finding
 *   - Hardened investigation always produces zero findings
 *   - No stale findings leak between runs
 *   - No hangs or crashes across repeated runs
 */

const SERVER = 'http://localhost:3000';
const VULNERABLE = 'http://localhost:4000';
const HARDENED = 'http://localhost:4001';
const CREDS = { username: 'employee@acme.com', password: 'employee123' };
const TIMEOUT = 120_000;

let totalPass = 0;
let totalFail = 0;

async function investigate(targetUrl) {
  const res = await fetch(`${SERVER}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, ...CREDS }),
  });
  if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
  return (await res.json()).investigationId;
}

async function waitForComplete(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch(`${SERVER}/api/status`);
      const s = await res.json();
      if (s.status === 'complete' || s.status === 'idle') return true;
    } catch { /* retry */ }
  }
  return false;
}

async function getFindings() {
  const res = await fetch(`${SERVER}/api/findings`);
  return (await res.json()).findings || [];
}

function assert(cond, msg) {
  if (cond) { totalPass++; }
  else { totalFail++; console.log(`    ✗ ${msg}`); }
  return cond;
}

async function runCycle(n) {
  console.log(`\n── Cycle ${n}/10 ──`);

  // Step A: Vulnerable → should produce finding
  console.log(`  [A] Investigating vulnerable target (:4000)...`);
  await investigate(VULNERABLE);
  const doneA = await waitForComplete(TIMEOUT);
  if (!assert(doneA, 'Vulnerable investigation timed out')) return false;
  const findingsA = await getFindings();
  if (!assert(findingsA.length === 1, `Expected 1 finding, got ${findingsA.length}`)) return false;
  if (!assert(findingsA[0].severity === 'critical', `Severity: ${findingsA[0]?.severity}`)) return false;
  if (!assert(findingsA[0].title.toLowerCase().includes('payout'), `Title: ${findingsA[0]?.title}`)) return false;
  console.log(`  [A] ✓ CRITICAL finding confirmed`);

  // Step B: Hardened → should produce zero findings
  console.log(`  [B] Investigating hardened target (:4001)...`);
  await investigate(HARDENED);
  const doneB = await waitForComplete(TIMEOUT);
  if (!assert(doneB, 'Hardened investigation timed out')) return false;
  const findingsB = await getFindings();
  if (!assert(findingsB.length === 0, `Expected 0 findings after hardened, got ${findingsB.length}`)) return false;
  console.log(`  [B] ✓ SECURE (zero findings)`);

  // Step C: Vulnerable again → should produce finding again (not stale SECURE)
  console.log(`  [C] Investigating vulnerable target again (:4000)...`);
  await investigate(VULNERABLE);
  const doneC = await waitForComplete(TIMEOUT);
  if (!assert(doneC, 'Second vulnerable investigation timed out')) return false;
  const findingsC = await getFindings();
  if (!assert(findingsC.length === 1, `Expected 1 finding on re-run, got ${findingsC.length}`)) return false;
  if (!assert(findingsC[0].severity === 'critical', `Re-run severity: ${findingsC[0]?.severity}`)) return false;
  console.log(`  [C] ✓ CRITICAL finding confirmed again`);

  return true;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Tutus 10-Cycle Reliability Stress Test      ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Preflight
  try {
    await fetch(`${VULNERABLE}/api/me`);
    await fetch(`${HARDENED}/api/me`);
    await fetch(`${SERVER}/api/status`);
  } catch (err) {
    console.log(`\nFATAL: Services not all reachable. Need :3000, :4000, :4001.`);
    process.exit(1);
  }

  let cyclesPassed = 0;
  for (let i = 1; i <= 10; i++) {
    try {
      const ok = await runCycle(i);
      if (ok) cyclesPassed++;
      else { console.log(`\n  CYCLE ${i} FAILED — stopping.`); break; }
    } catch (err) {
      totalFail++;
      console.log(`\n  CYCLE ${i} CRASHED: ${err.message}`);
      break;
    }
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`Cycles completed: ${cyclesPassed}/10`);
  console.log(`Assertions: ${totalPass} passed, ${totalFail} failed`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
