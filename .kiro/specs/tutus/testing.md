# Tutus - Testing Strategy

## Testing Philosophy

This is a hackathon project. The testing strategy prioritizes:

1. **Confidence in the critical path** over exhaustive coverage
2. **Integration tests** over unit tests (the value is in components working together)
3. **Automated smoke tests** that can run in CI or locally before a demo
4. **Fast feedback** — tests should run in under 60 seconds total

---

## Test Layers

### Layer 1: Vault API Tests (High Priority)

**Purpose**: Ensure the target application behaves correctly, including the intentional flaw.

**Framework**: Vitest + supertest (HTTP assertions without starting a real server)

**What to test**:

```
vault/src/__tests__/
├── auth.test.ts          - Login/logout, session management
├── rbac.test.ts          - Role enforcement on all protected routes
├── billing.test.ts       - THE FLAW: employee CAN update payout
└── seed.test.ts          - Seed data exists after initialization
```

**Key test cases**:

| Test | Assertion |
|------|-----------|
| Admin can login | POST /api/auth/login → 200, session cookie set |
| Employee can login | POST /api/auth/login → 200, session cookie set |
| Invalid credentials rejected | POST /api/auth/login → 401 |
| Admin can update payout | PUT /api/billing/payout → 200 |
| **Employee can update payout (THE FLAW)** | PUT /api/billing/payout → 200 (not 403) |
| Employee cannot invite team member | POST /api/team/invite → 403 |
| Employee cannot update settings | PUT /api/settings → 403 |
| Employee cannot delete team member | DELETE /api/team/:id → 403 |
| Unauthenticated requests rejected | Any protected route → 401 |

**The flaw test is critical** — it documents the intentional vulnerability and ensures it remains exploitable. If this test fails, the demo breaks.

---

### Layer 2: Investigation Engine Tests (High Priority)

**Purpose**: Ensure each pipeline phase produces correct outputs given known inputs.

**Framework**: Vitest + Playwright (real browser against running Vault)

**What to test**:

```
server/src/__tests__/
├── phases/
│   ├── authenticate.test.ts   - Can log into Vault
│   ├── explore.test.ts        - Discovers expected pages
│   ├── discover.test.ts       - Finds expected actions
│   ├── analyze.test.ts        - Scores payout action highest
│   └── verify.test.ts         - Confirms payout action succeeds
├── scoring.test.ts            - Heuristic engine unit tests
└── orchestrator.test.ts       - Full pipeline integration
```

**Key test cases**:

| Test | Assertion |
|------|-----------|
| Authentication succeeds | Phase completes, browser on dashboard |
| Exploration finds ≥5 pages | sitemap.length >= 5 |
| Exploration finds /billing/payout | sitemap contains payout URL |
| Discovery finds ≥8 actions | actions.length >= 8 |
| Discovery finds payout form | actions contain PUT payout action |
| Scoring ranks financial actions highest | payout action in top 3 |
| Verification confirms payout | result = 'confirmed', HTTP 200 |
| Verification denies team invite | result = 'denied', HTTP 403 |
| Full pipeline produces finding | finding.title contains 'payout' |
| Finding has required fields | All Finding interface fields present |

---

### Layer 3: Scoring Engine Unit Tests (Medium Priority)

**Purpose**: Validate the heuristic scoring logic in isolation (fast, no browser needed).

**Framework**: Vitest

**What to test**:

```typescript
// scoring.test.ts
describe('Risk Scoring', () => {
  it('scores "Update Payout Account" highest', () => {
    const actions = [
      { label: 'Update Payout Account', method: 'PUT', url: '/api/billing/payout' },
      { label: 'View Dashboard', method: 'GET', url: '/api/dashboard' },
      { label: 'Generate API Key', method: 'POST', url: '/api/keys' },
      { label: 'Update Settings', method: 'PUT', url: '/api/settings' },
      { label: 'Delete Team Member', method: 'DELETE', url: '/api/team/1' },
    ];
    const ranked = scoreActions(actions);
    expect(ranked[0].action.label).toContain('Payout');
  });

  it('scores write methods higher than read', () => { ... });
  it('scores financial keywords above destructive', () => { ... });
  it('handles actions with no keywords gracefully', () => { ... });
});
```

---

### Layer 4: WebSocket Communication Tests (Medium Priority)

**Purpose**: Ensure real-time messages reach the UI correctly.

**Framework**: Vitest + ws client

**What to test**:

| Test | Assertion |
|------|-----------|
| Client connects successfully | WebSocket open event received |
| Phase change events delivered | Client receives phase_changed message |
| Activity events delivered | Client receives activity messages |
| Finding delivered at end | Client receives finding_ready with valid Finding |
| Multiple clients receive same events | Broadcast reaches all connections |

---

### Layer 5: End-to-End Smoke Test (Critical)

**Purpose**: Single test that validates the entire demo works. This is the "does the hackathon demo break?" test.

**Framework**: Vitest + Playwright (or standalone script)

**File**: `e2e/smoke.test.ts`

```typescript
describe('Tutus E2E Smoke Test', () => {
  it('completes full investigation and finds payout vulnerability', async () => {
    // 1. Verify Vault is running
    const health = await fetch('http://localhost:4000/api/me');
    expect(health.status).toBe(401); // Running but requires auth

    // 2. Start investigation via API
    const res = await fetch('http://localhost:3000/api/investigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'http://localhost:4000',
        username: 'employee@acme.com',
        password: 'employee123',
      }),
    });
    expect(res.status).toBe(200);
    const { investigationId } = await res.json();

    // 3. Wait for completion (poll or WebSocket)
    const finding = await waitForFinding(investigationId, { timeout: 120_000 });

    // 4. Validate finding structure
    expect(finding).toBeDefined();
    expect(finding.severity).toBe('critical');
    expect(finding.confidence).toBe('high');
    expect(finding.actor.role).toBe('employee');
    expect(finding.expectedPrivilege).toBe('admin');
    expect(finding.actualPrivilege).toBe('employee');
    expect(finding.title.toLowerCase()).toContain('payout');

    // 5. Validate evidence
    expect(finding.evidence.screenshots.length).toBeGreaterThanOrEqual(1);
    expect(finding.evidence.request.method).toBe('PUT');
    expect(finding.evidence.request.url).toContain('/api/billing/payout');
    expect(finding.evidence.response.status).toBe(200);

    // 6. Validate reproduction steps
    expect(finding.reproductionSteps.length).toBeGreaterThanOrEqual(3);
  }, 180_000); // 3 minute timeout
});
```

---

### Layer 6: UI Component Tests (Low Priority)

**Purpose**: Catch rendering issues in key components. Low priority for hackathon.

**Framework**: Vitest + React Testing Library

**What to test (if time permits)**:

| Component | Test |
|-----------|------|
| TargetForm | Renders inputs, validates required fields, calls onSubmit |
| PhaseTracker | Highlights correct phase, shows completed checkmarks |
| FindingReport | Renders all finding fields, severity badge correct color |
| ActivityFeed | Scrolls to bottom on new events |

---

## Test Infrastructure

### Configuration

```
Root package.json scripts:
  "test": "npm run test --workspaces"
  "test:vault": "npm run test -w packages/vault"
  "test:server": "npm run test -w packages/server"
  "test:ui": "npm run test -w packages/ui"
  "test:e2e": "vitest run e2e/"
  "test:smoke": "vitest run e2e/smoke.test.ts"
```

### Prerequisites for Integration/E2E Tests

- Vault must be running on :4000 with seed data
- For server tests: Vault running, no Tutus server needed (tests start their own)
- For E2E: Both Vault (:4000) and Tutus server (:3000) running

### Test Data Management

- Each test run uses the same seed data (Vault resets on startup)
- Payout account reset to "ACME-BANK-001" before each verification test
- Use unique test values with timestamps to avoid collision: `"HACKED-{Date.now()}"`

---

## What NOT to Test (Hackathon Scope)

- Vault UI rendering (server-rendered EJS, visual verification sufficient)
- Playwright internals (trust the library)
- WebSocket reconnection edge cases
- Concurrent investigation handling
- Performance/load testing
- Security of Tutus itself (ironic but practical)
- Cross-browser compatibility (Chromium only)

---

## Pre-Demo Checklist

Run before any demo or presentation:

```bash
# 1. Quick smoke (no browser, fast)
npm run test:vault

# 2. Scoring logic (no browser, fast)  
npm run test:server -- --testPathPattern=scoring

# 3. Full integration (requires Vault running)
npm run test:smoke
```

If all three pass, the demo will work.

---

## Continuous Validation During Development

During implementation, maintain this cadence:

1. After completing each Vault route → run `test:vault`
2. After completing each pipeline phase → run that phase's test
3. After wiring WebSocket → run communication tests
4. After UI integration → run smoke test
5. Before any demo → run full test suite

This provides fast feedback without over-investing in test infrastructure for a hackathon project.
