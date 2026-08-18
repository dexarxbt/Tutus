# Tutus

Autonomous security investigation agent that discovers and proves the most dangerous action an authenticated user can perform in a web application.

Tutus authenticates as a given user, explores what that user can reach, identifies meaningful actions, ranks them by potential impact, tests whether authorization actually prevents them, and captures reproducible evidence when a dangerous action succeeds. The investigation engine is deterministic and rule-based — no external LLM or paid AI service is involved. It is autonomous in the sense that it drives a real browser, makes real navigation and submission decisions, and reaches conclusions based on observed HTTP responses rather than static rules or predetermined outcomes.

---

## The Problem

Web applications commonly expose sensitive operations through API endpoints even when the corresponding UI element is hidden from a particular user role. An employee dashboard may not display a payout-settings link, but the underlying `PUT /api/billing/payout` endpoint may still accept requests from any authenticated session.

Functional testing confirms features work. Static analysis finds code patterns. Neither reliably detects that a specific user can perform a specific action they shouldn't. Authorization flaws require combining a real authenticated session with exploratory behavior — navigating beyond what the UI presents, submitting requests the role shouldn't access, and observing what the server permits.

Tutus was built to answer a single question:

> What is the most dangerous thing this authenticated user can actually do?

---

## Investigation Model

Tutus conducts a sequential, autonomous investigation through six visible pipeline stages:

```
01 AUTHENTICATE → 02 EXPLORE → 03 DISCOVER → 04 ANALYZE → 05 VERIFY → 06 PROVE
```

Followed by internal finding generation and optional replay.

| Stage | Operation |
|-------|-----------|
| AUTHENTICATE | Detect and complete the target's login form via Playwright |
| EXPLORE | Traverse reachable pages via BFS link extraction and wordlist path probing |
| DISCOVER | Extract forms, buttons, and API-relevant actions from each page's DOM |
| ANALYZE | Score all discovered actions using deterministic heuristic risk categories |
| VERIFY | Attempt top-ranked actions with the authenticated session; observe HTTP responses |
| PROVE | Capture request/response, screenshots, and resulting state for confirmed actions |

A finding is generated only when an action succeeds (HTTP 2xx) that should have been denied. If all actions are correctly denied, the investigation completes with zero findings.

---

## Tutus in Action

The system includes a target application called Vault — a financial operations platform with role-based access control and a configurable authorization flaw.

### Vulnerable Vault (`:4000`)

```
Employee → discovers payout action → attempts modification → HTTP 200
→ state change confirmed → CRITICAL finding → evidence captured → replay available
```

The server accepts the request because the `requireAdmin` middleware is absent on one specific endpoint.

### Hardened Vault (`:4001`)

```
Employee → discovers same action → attempts modification → HTTP 403
→ authorization enforced → SECURE → zero confirmed findings
```

With correct authorization in place, the identical investigation completes without producing a finding.

**SECURE is the correct, successful outcome.** The result changes because the application's actual authorization behavior changes. The investigation discovers and reports what the application permits — nothing is predetermined.

---

## Getting Started

```bash
npm install
npx playwright install chromium
npm run doctor
npm run dev
```

`npm run doctor` checks for port conflicts, missing Playwright browsers, and stale database files before you start.

Three services start concurrently:

| Service | URL | Role |
|---------|-----|------|
| Vault | http://localhost:4000 | Target application |
| Tutus Server | http://localhost:3000 | Investigation engine |
| Tutus UI | http://localhost:5173 | Investigation dashboard |

To start an investigation: open the Tutus UI, navigate to **Investigate**, enter the target URL and credentials, and click **Begin Investigation**.

---

## Running the Hardened Demo

Keep Tutus Server running on `:3000`. Start a second Vault instance with authorization enforced:

**PowerShell:**
```powershell
cd packages/vault
$env:VAULT_HARDENED='true'; $env:VAULT_PORT='4001'; npx tsx src/index.ts
```

If you see "Could not determine Node.js install directory":
```powershell
$env:VAULT_HARDENED='true'; $env:VAULT_PORT='4001'; node --import tsx/esm src/index.ts
```

**Unix/macOS:**
```bash
cd packages/vault
VAULT_HARDENED=true VAULT_PORT=4001 npx tsx src/index.ts
```

Wait for `[Vault] Running on http://localhost:4001`.

Confirm enforcement:
```bash
node -e "fetch('http://localhost:4001/api/me').then(r => console.log('status:', r.status))"
# Expected: status: 401
```

In the Tutus UI, set target to `http://localhost:4001`, use employee credentials, click **Begin Investigation**. The pipeline completes through all six stages; Findings, Evidence, and Replay pages show **SECURE / No vulnerabilities confirmed**.

| Target | Payout Response | Outcome |
|--------|----------------|---------|
| `:4000` (vulnerable) | HTTP 200 | CRITICAL finding |
| `:4001` (hardened) | HTTP 403 | SECURE — zero findings |

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Could not determine Node.js install directory" | npx resolution on some Windows/Node versions | Use `node --import tsx/esm src/index.ts` instead |
| Port already in use | Previous instance not stopped | `npm run doctor` to identify; kill the process |
| Stale finding from previous target | vault.db persisted from prior run | Delete `packages/vault/vault.db` and restart |
| Playwright browser not found | Chromium not installed | `npx playwright install chromium` |
| ECONNRESET during E2E tests | Server briefly busy with Playwright | Tests include retry logic; re-run if it persists |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│   Tutus UI (:5173)                                     │
│   React + Vite + Tailwind                              │
│        │                                               │
│        │ WebSocket + REST                              │
│        ↓                                               │
│   Tutus Server (:3000)                                 │
│   Express + WebSocket                                  │
│        │                                               │
│        ├── Investigation Orchestrator                  │
│        ├── Heuristic Scoring Engine                    │
│        ├── Playwright Controller (Chromium)            │
│        ├── Evidence Capture                            │
│        └── Replay Engine                              │
│             │                                          │
│             │ HTTP (real browser automation)           │
│             ↓                                          │
│   Vault (:4000 / :4001)                               │
│   Express + SQLite + EJS                               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

| Component | Responsibility |
|-----------|---------------|
| **Tutus UI** | Real-time investigation dashboard with live WebSocket event stream, finding display, evidence viewer, replay interface, and distinct SECURE/CRITICAL/empty states |
| **Tutus Server** | Orchestrates the investigation pipeline, manages Playwright browser instances, broadcasts progress, exposes REST API for findings/replay/status |
| **Vault** | Target application with session-based auth, role-based access control, server-rendered pages, and a configurable authorization flaw (`VAULT_HARDENED=true` fixes it) |

---

## Investigation Pipeline

### Authenticate

Navigates to the target URL. Detects the login form by locating email/password input fields. Fills credentials, submits, and verifies authentication succeeded by observing the URL change away from `/login`.

### Explore

Extracts all `<a href>` elements from the authenticated page (including CSS-hidden links still present in the DOM). Visits each discovered page via breadth-first traversal, up to 20 pages. Supplements link-following with a wordlist of common sensitive paths (`/billing/payout`, `/admin`, `/settings/advanced`, etc.).

### Discover

For each visited page, extracts HTML forms with their action URLs, HTTP methods, field names, and submit button text. Classifies each as a distinct actionable element. Deduplicates by URL + method. Filters out login forms.

### Analyze (Rank)

Applies the deterministic scoring engine. Returns actions sorted by risk score descending. The top 5 proceed to verification.

### Verify

For each top-ranked action, constructs a test payload from form field names and executes the request using the browser's authenticated session cookies. Tries multiple HTTP methods (PUT, POST, PATCH) since HTML forms can't express PUT but APIs commonly require it. Classifies results: `confirmed` (2xx), `denied` (401/403), `failed` (other).

### Prove (Evidence)

For confirmed actions, navigates to the affected page and captures a screenshot showing the persisted state change. Packages the full HTTP request (method, URL, headers, body) and response (status, body) as structured evidence.

The orchestrator then assembles the finding (severity, actor, privilege gap, impact, reproduction steps) and broadcasts it to connected clients.

### Replay

Launches a fresh Playwright browser, authenticates independently, navigates to the vulnerable endpoint, and re-executes the exploit with `REPLAY-{timestamp}` test values distinct from the original. Reports whether the vulnerability remains exploitable.

---

## Risk Model

The scoring engine uses deterministic keyword-weighted heuristics:

| Category | Weight | Keywords |
|----------|--------|----------|
| Financial | 40 | payout, payment, transfer, bank, account, billing, withdraw, deposit, refund, wire |
| Destructive | 30 | delete, remove, revoke, disable, destroy, purge, terminate, cancel |
| Privilege | 25 | admin, role, permission, invite, settings, config, access, grant |
| Data | 20 | export, download, credentials, key, secret, token, api-key, password |
| Organization Scope | 15 | organization, company, team, all, global, org |

Write methods (PUT, POST, DELETE, PATCH) receive an additional +10 bonus.

Actions are scored by matching their label, URL, and form field names against the keyword lists. The engine is generic — it contains no knowledge of specific vulnerabilities, target applications, or expected outcomes. No external LLM or paid API is required for the investigation engine.

---

## Evidence

A confirmed finding contains:

| Type | Content |
|------|---------|
| HTTP Request | Method, URL, headers, body |
| HTTP Response | Status code, headers, body |
| Screenshots | Browser state captured at verification time |
| Actor | Authenticated user identity and role |
| Privilege Gap | Expected privilege vs. actual privilege |
| Impact | Generated business-consequence description |
| Reproduction Steps | Ordered sequence sufficient to repeat the exploit |
| Timestamps | Investigation start time and verification time |

Evidence is captured from the live investigation — it represents what actually happened, not a static vulnerability description.

---

## Replay

Replay re-executes a verified finding in a fresh browser context:

1. Launches a new Chromium instance
2. Authenticates independently using stored credentials
3. Navigates to the vulnerable endpoint
4. Executes the same HTTP method with distinct `REPLAY-` prefixed test values
5. Captures the response and resulting state
6. Reports whether the vulnerability persists

Replay evidence is labeled separately from original investigation evidence. The distinct test values prove the replay is an independent execution, not cached data. Replay confirms persistence — it does not prove exploitability in different environments.

---

## Verification

Results from the 10-cycle stress test (30 consecutive investigations across vulnerable/hardened/vulnerable targets without service restarts):

| Test | Result |
|------|--------|
| TypeScript compilation | PASS |
| Production build (Vite) | PASS |
| Smoke E2E | 23/23 |
| Replay E2E | 16/16 |
| Hardened E2E | 5/5 |
| Unreachable Target E2E | 6/6 |
| 10-Cycle Stress Test | 90/90 (10 full cycles) |

### Hardened test assertions

| # | Assertion |
|---|-----------|
| 1 | Hardened Vault responds 401 when unauthenticated |
| 2 | Employee payout modification returns 403 |
| 3 | Investigation starts successfully |
| 4 | Investigation completes within timeout |
| 5 | Zero findings produced |

### Running tests

```bash
# Prerequisites: Vault (:4000) and Server (:3000) running
node e2e/smoke.test.mjs          # 23 assertions
node e2e/replay.test.mjs         # 16 assertions (requires prior finding)
node e2e/unreachable.test.mjs    # 6 assertions (nothing on :4099)

# Hardened (requires hardened Vault on :4001)
node e2e/hardened.test.mjs       # 5 assertions

# Stress test (requires both :4000 and :4001)
node e2e/stress.test.mjs         # 90 assertions (10 cycles)
```

---

## Development with Kiro

Tutus was developed using Kiro as the primary spec-driven development environment. The full lifecycle — requirements, architecture, task breakdown, and testing strategy — was defined through structured specification documents before implementation began.

### Specification Documents

| Document | Content |
|----------|---------|
| `requirements.md` | Functional/non-functional requirements, acceptance criteria, scope |
| `design.md` | Architecture, component interfaces, data models, API contracts, WebSocket protocol, correctness properties, error handling |
| `tasks.md` | Implementation task breakdown with dependency graph and effort estimates |
| `testing.md` | Layered testing strategy from unit through E2E |
| `vertical-slice.md` | Minimum viable end-to-end slice used to validate the architecture before expanding |

Located at `.kiro/specs/tutus/`.

### Workflow

```
Requirements → Design → Tasks → Vertical Slice → Implementation → Testing → Iteration
```

The vertical slice approach was the critical architectural decision. Rather than building the full application breadth-first, a minimal 3-page Vault + complete 7-phase pipeline was built and validated first. Only after this slice produced a correct finding end-to-end were additional pages, polish, replay, and hardened mode added.

A concrete example: the design document specifies that the verify phase should try multiple HTTP methods per discovered action because HTML forms only support GET/POST but APIs commonly use PUT. This decision — derived during spec writing before implementation — directly solved a real integration problem: Vault's payout form submits as POST, but the vulnerable API endpoint requires PUT. Without the multi-method retry (defined in design, implemented in `verify.ts`), the investigation would have failed to confirm the vulnerability.

---

## Current Scope and Roadmap

Tutus demonstrates generic discovery and real HTTP-based verification of privilege escalation vulnerabilities, validated through behavioral contrast between vulnerable and hardened configurations of the bundled Vault target.

Planned extensions:
- Additional vulnerability classes beyond privilege escalation (IDOR, data exposure, mass assignment)
- Configurable target definitions for investigating arbitrary web applications
- Expanded heuristic risk categories and configurable scoring weights
- Multi-role comparison (investigating the same application as different users and diffing their reachable actions)
- CI/CD integration for continuous authorization verification

---

## Project Structure

```
tutus/
├── .kiro/specs/tutus/       Specification documents
├── packages/
│   ├── vault/               Target application (Express + SQLite + EJS)
│   │   └── src/
│   │       ├── db/          Schema, seed data, connection
│   │       ├── middleware/  Auth and RBAC middleware
│   │       ├── routes/      API route handlers
│   │       └── views/       EJS templates with partials
│   ├── server/              Investigation engine
│   │   └── src/
│   │       ├── engine/      Orchestrator + pipeline phases + scoring
│   │       ├── browser/     Playwright controller + replay
│   │       └── ws/          WebSocket broadcaster
│   └── ui/                  Dashboard (React + Vite + Tailwind)
│       └── src/
│           ├── pages/       Route-level page components
│           ├── components/  Shared UI components
│           └── hooks/       WebSocket + data hooks
├── e2e/                     End-to-end test suite
├── scripts/                 Utility scripts (doctor.mjs)
├── package.json             Workspace root
└── tsconfig.base.json       Shared TypeScript configuration
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | TypeScript | Type safety across all packages |
| UI | React 18 + Vite | Investigation dashboard with routing |
| Styling | Tailwind CSS | Design system with custom theme |
| Routing | react-router-dom | Multi-page navigation |
| Server | Express.js | REST API and HTTP server |
| Real-time | ws | WebSocket event broadcasting |
| Browser Automation | Playwright | Headless Chromium for exploration and verification |
| Database | sql.js (SQLite) | Vault data persistence, zero native compilation |
| Templates | EJS | Vault server-rendered pages |
| Auth | bcryptjs + express-session | Password hashing and session management |
| Monorepo | npm workspaces | Single dependency tree |
| Process Management | concurrently | Parallel service startup |

---

## Test Accounts

Local credentials for the Vault target application:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@acme.com | admin123 |
| Employee | employee@acme.com | employee123 |

These are demo credentials for the local Vault instance only.
