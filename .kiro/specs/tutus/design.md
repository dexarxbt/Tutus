# Tutus - Technical Design

## Overview

Tutus is a local security investigation agent that autonomously discovers authorization flaws in web applications. Given a target URL and user credentials, it authenticates, explores the application, identifies high-risk actions, attempts them, and produces a structured security finding with evidence.

The system consists of three components deployed as local processes in an npm workspaces monorepo:

- **Vault** (`:4000`): A realistic SaaS target application with an intentional authorization flaw
- **Tutus Server** (`:3000`): The investigation engine using Playwright for browser automation
- **Tutus UI** (`:5173`): A React frontend showing real-time investigation progress

Key technical decisions:
- Rule-based heuristic engine (no external AI/LLM, deterministic, portable)
- Playwright for browser automation and evidence capture
- WebSocket for real-time progress streaming
- SQLite (sql.js) for Vault data persistence
- Hardened mode (`VAULT_HARDENED=true`) for demonstrating correct authorization enforcement

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Developer Machine                      │
│                                                               │
│  ┌──────────────┐     ┌──────────────────┐    ┌──────────┐  │
│  │  Tutus UI    │────▶│  Tutus Server    │───▶│  Vault   │  │
│  │  (React)     │◀────│  (Node/Express)  │◀───│  (Express)│  │
│  │  :5173       │ WS  │  :3000           │HTTP│  :4000   │  │
│  └──────────────┘     └────────┬─────────┘    └──────────┘  │
│                                │                              │
│                        ┌───────▼────────┐                    │
│                        │   Playwright   │                    │
│                        │   (Chromium)   │                    │
│                        └────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (strict) | Type safety, single language across stack |
| Vault Backend | Express.js + EJS | Minimal REST API + server-rendered pages |
| Vault Data | SQLite (sql.js) | Zero-config, pure JS, no native compilation |
| Tutus Backend | Express.js + ws | REST for commands, WS for live updates |
| Tutus Frontend | React + Vite | Fast dev, component model |
| UI Styling | Tailwind CSS | Dark theme, rapid styling |
| Browser Automation | Playwright | Headless Chromium, screenshots, network interception |
| Decision Engine | Rule-based heuristic scoring | Deterministic, no GPU, instant results |
| Monorepo | npm workspaces | Single install, shared tooling |
| Process Management | concurrently | One command starts all services |

The investigation pipeline executes 7 sequential phases:

```
Authentication → Exploration → Discovery → Analysis → Verification → Evidence → Finding
```

After a finding is produced, a separate **Replay** capability re-executes the exploit using a fresh Playwright browser to confirm the vulnerability persists.

## Components and Interfaces

### Vault (Target Application)

Express.js application serving both REST API and EJS-rendered pages.

**REST API:**
```
POST   /api/auth/login          - Authenticate (returns session cookie)
POST   /api/auth/logout         - End session
GET    /api/me                  - Current user info
GET    /api/dashboard           - Dashboard metrics
GET    /api/team                - List team members
POST   /api/team/invite         - Invite member (requireAdmin)
DELETE /api/team/:id            - Remove member (requireAdmin)
GET    /api/billing/invoices    - List invoices
GET    /api/billing/payout      - Get payout account
PUT    /api/billing/payout      - Update payout account (FLAW: missing requireAdmin)
GET    /api/settings            - Organization settings
PUT    /api/settings            - Update settings (requireAdmin)
```

**Middleware:**
- `requireAuth`: Checks `req.session.userId`, returns 401 if absent
- `requireAdmin`: Checks `req.session.userRole === 'admin'`, returns 403 if not

**Authorization Flaw:** `PUT /api/billing/payout` uses only `requireAuth` (missing `requireAdmin`). The payout nav link is CSS-hidden (`style="display:none"`) for employees but the `<a>` element remains in the DOM, enabling discovery via link extraction.

**Hardened Mode:** When `VAULT_HARDENED=true`, `requireAdmin` is enforced on the payout endpoint, fixing the flaw.

### Tutus Server (Investigation Engine)

**REST API:**
```
POST /api/investigate         - Start investigation { url, username, password }
GET  /api/status              - Current phase and progress
GET  /api/findings            - List all findings
GET  /api/findings/:id        - Get specific finding
POST /api/replay              - Start replay { findingId }
GET  /api/replay/:id/full     - Get replay result with evidence
```

**Internal Modules:**

| Module | File | Responsibility |
|--------|------|---------------|
| Orchestrator | `engine/orchestrator.ts` | Manages InvestigationState, executes phases sequentially |
| Authenticate | `engine/phases/authenticate.ts` | Logs in via form detection and submission |
| Explore | `engine/phases/explore.ts` | BFS link traversal + wordlist probing |
| Discover | `engine/phases/discover.ts` | Extracts forms/buttons from each page |
| Analyze | `engine/phases/analyze.ts` | Applies heuristic scoring |
| Verify | `engine/phases/verify.ts` | Attempts top-ranked actions via API |
| Evidence | `engine/phases/evidence.ts` | Screenshots + request/response capture |
| Finding | `engine/phases/finding.ts` | Assembles structured Finding object |
| Scoring | `engine/scoring.ts` | Keyword-weighted risk scoring engine |
| PlaywrightController | `browser/controller.ts` | Browser lifecycle, navigation, form interaction |
| Replay | `browser/replay.ts` | Re-executes exploit in fresh browser |
| Broadcaster | `ws/broadcaster.ts` | WebSocket message dispatch to all clients |

**WebSocket Protocol (server → client):**
```typescript
type ServerMessage =
  | { type: 'phase_changed'; phase: Phase; timestamp: string }
  | { type: 'activity'; message: string; details?: string; timestamp: string }
  | { type: 'page_discovered'; url: string; title: string }
  | { type: 'action_discovered'; action: DiscoveredAction }
  | { type: 'verification_result'; action: string; result: 'confirmed' | 'denied' | 'failed' }
  | { type: 'finding_ready'; finding: Finding }
  | { type: 'screenshot'; name: string; data: string }
  | { type: 'error'; message: string }
  | { type: 'investigation_started'; id: string }
  | { type: 'investigation_complete'; id: string };
```

### Tutus UI (Frontend)

React SPA with Tailwind CSS dark theme.

**Components:**
- `TargetForm` — URL + credentials + FIND button
- `PhaseTracker` — 8-step visual stepper (complete/active/pending)
- `ActivityFeed` — Scrolling real-time event log
- `FindingReport` — Severity badge, actor/privilege details, tabbed evidence (Details/Evidence/Reproduction/Replay)

**State:** `useState` + WebSocket hook. View transitions: `input` → `investigating` → `finding`. When investigation completes with no finding, displays "No Vulnerabilities Found" card.

**Replay UI:** Amber-colored evidence section distinguishes replay data from indigo-colored original investigation evidence. Replay uses `REPLAY-{timestamp}` test values.

### PlaywrightController Interface

```typescript
class PlaywrightController {
  async launch(headless: boolean): Promise<void>;
  async navigate(url: string): Promise<void>;
  async screenshot(name: string): Promise<string>;  // base64
  async getCurrentUrl(): Promise<string>;
  async getPageTitle(): Promise<string>;
  async getPageLinks(): Promise<string[]>;
  async getPageForms(): Promise<FormInfo[]>;
  async getButtons(): Promise<ButtonInfo[]>;
  async loginWithCredentials(username: string, password: string): Promise<boolean>;
  async fillAndSubmit(formSelector: string, fields: {name: string; value: string}[]): Promise<void>;
  async makeApiRequest(url: string, method: string, body?: Record<string, string>): Promise<ApiResult>;
  async startIntercepting(): Promise<void>;
  async stopIntercepting(): Promise<CapturedExchange[]>;
  async close(): Promise<void>;
}
```

### Risk Scoring Engine

```typescript
const SCORING_FACTORS = [
  { name: 'financial',       weight: 40, keywords: ['payout','payment','transfer','bank','account','billing','withdraw','deposit','refund','wire'] },
  { name: 'destructive',    weight: 30, keywords: ['delete','remove','revoke','disable','destroy','purge','terminate','cancel'] },
  { name: 'privilege',      weight: 25, keywords: ['admin','role','permission','invite','settings','config','access','grant'] },
  { name: 'data_sensitive', weight: 20, keywords: ['export','download','credentials','key','secret','token','api-key','password'] },
  { name: 'org_scope',      weight: 15, keywords: ['organization','company','team','all','global','org'] },
];
const WRITE_METHOD_BONUS = 10; // PUT, POST, DELETE, PATCH
```

Scoring is purely generic — no action-specific logic. The engine scores ANY discovered action by matching its label, URL, and field names against the keyword lists.

## Data Models

### Vault Database (SQLite)

```sql
CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  payout_account TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'pro',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- bcryptjs
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  invited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue')),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Seed Data

| Entity | Data |
|--------|------|
| Organization | Acme Corp, payout_account: "ACME-BANK-001", plan: "pro" |
| Admin | admin@acme.com / admin123, role: admin |
| Employee | employee@acme.com / employee123, role: employee |
| Additional users | carol@acme.com, dave@acme.com, eve@acme.com (all employee) |
| Invoices | 5 invoices with varied statuses and amounts |

### Investigation State (In-Memory)

```typescript
interface InvestigationState {
  id: string;
  target: { url: string; credentials: Credentials };
  phase: Phase;
  sitemap: PageNode[];
  actions: DiscoveredAction[];
  rankedActions: RankedAction[];
  verificationResults: VerificationResult[];
  finding: Finding | null;
  timeline: TimelineEvent[];
  startedAt: string;
}
```

### Finding Structure

```typescript
interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  actor: { email: string; role: string };
  expectedPrivilege: string;
  actualPrivilege: string;
  impact: string;
  reproductionSteps: ReproductionStep[];
  evidence: {
    screenshots: Screenshot[];
    request: CapturedRequest | null;
    response: CapturedResponse | null;
  };
  timestamp: string;
}
```

### Replay Result

```typescript
interface ReplayResult {
  success: boolean;
  finding: Finding;
  verified: boolean;
  screenshots: Screenshot[];  // labeled "Replay: ..."
  request: CapturedRequest | null;
  response: CapturedResponse | null;
  error?: string;
  timestamp: string;
}
```

## Correctness Properties

### Property 1: Verified before finding

A discovered action only becomes a confirmed finding after the verification phase executes a real HTTP request against the target and receives an HTTP 2xx response. Actions that return 403, 401, or any error status are classified as "denied" or "failed" and never produce a finding.

### Property 2: Confirmed findings contain reproducible evidence

Every confirmed finding includes: (a) the exact HTTP request (method, URL, headers, body) that succeeded, (b) the HTTP response (status code, body) proving success, (c) at least one screenshot captured at the time of verification, and (d) ordered reproduction steps sufficient to repeat the exploit.

### Property 3: Replay reproduces the verified action and validates state

Replay launches a fresh Playwright browser context, authenticates independently, re-executes the same HTTP method and endpoint from the finding's evidence, uses distinct `REPLAY-{timestamp}` test values, and returns a `verified: true` result only if the response status is 2xx. Replay screenshots are labeled with a "Replay:" prefix to distinguish them from original evidence.

### Property 4: Hardened authorization produces no confirmed finding

When the target application enforces correct authorization (Vault with `VAULT_HARDENED=true`), the verification phase receives 403 for all high-risk actions, the finding phase returns null, and the investigation completes with zero findings added to the findings store.

### Property 5: Discovery is generic and not vulnerability-specific

The exploration phase discovers pages through DOM link extraction and a general-purpose wordlist of common paths. The scoring engine ranks actions using category-weighted keyword matching (financial, destructive, privilege, data, org-scope) without any action-specific logic. The same engine would score any financial-keyword action highest regardless of which target application is being investigated.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Authentication fails | Orchestrator aborts, broadcasts error, sets phase to complete |
| Page navigation timeout | Explore phase skips that page, continues BFS |
| No actions discovered | Orchestrator completes with null finding, UI shows "no findings" |
| All verifications denied/failed | Finding phase returns null, investigation completes cleanly |
| `makeApiRequest` timeout (15s) | Promise.race rejects, verify phase catches error, marks action as 'failed' |
| Playwright browser crash | Orchestrator catch block broadcasts error, finally block calls browser.close() |
| Replay target unreachable | ReplayResult.success = false, error message captured |
| WebSocket disconnect | UI auto-reconnects after 2 seconds |

The orchestrator wraps the entire pipeline in try/catch/finally. Every phase failure path calls `setPhase('complete')` so the UI never gets stuck.

## Testing Strategy

Three E2E test suites run against live services:

| Test | File | Assertions | What it proves |
|------|------|-----------|----------------|
| Smoke | `e2e/smoke.test.mjs` | 23 | Full investigation finds "Employee can update payout account" with correct severity, evidence, and reproduction steps |
| Replay | `e2e/replay.test.mjs` | 16 | Replay re-executes the exploit, confirms it still works, uses distinct REPLAY- values, labels screenshots |
| Hardened | `e2e/hardened.test.mjs` | 5 | With VAULT_HARDENED=true, employee gets 403, investigation produces zero findings |

**Prerequisites:** Vault on :4000, Tutus Server on :3000. For hardened test: hardened Vault on :4001.

**Run:**
```bash
node e2e/smoke.test.mjs      # 23/23
node e2e/replay.test.mjs     # 16/16 (requires prior smoke run)
node e2e/hardened.test.mjs   # 5/5 (requires hardened vault on :4001)
```

**Total: 44 assertions** covering the critical path, replay, and negative case.
