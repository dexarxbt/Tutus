# Tutus - Implementation Task Breakdown

## Phase 0: Project Scaffolding

### Task 0.1: Initialize Monorepo
- [ ] Create root `package.json` with npm workspaces configuration
- [ ] Configure workspaces: `packages/vault`, `packages/server`, `packages/ui`
- [ ] Create root `tsconfig.base.json` with shared compiler options
- [ ] Add root scripts: `dev`, `build`, `start`
- [ ] Install `concurrently` for parallel process management
- [ ] Create `scripts/start.ts` to orchestrate all services

### Task 0.2: Configure Each Package
- [ ] `packages/vault/package.json` - Express, better-sqlite3, ejs, bcrypt, express-session, cookie-parser
- [ ] `packages/vault/tsconfig.json` - extends base, Node target
- [ ] `packages/server/package.json` - Express, ws, playwright
- [ ] `packages/server/tsconfig.json` - extends base, Node target
- [ ] `packages/ui/package.json` - React, Vite, Tailwind CSS
- [ ] `packages/ui/tsconfig.json` - extends base, DOM target
- [ ] `packages/ui/vite.config.ts` - proxy API to server, configure dev port
- [ ] `packages/ui/tailwind.config.ts` - dark mode, custom colors

---

## Phase 1: Vault Application

### Task 1.1: Database Layer
- [ ] Create `packages/vault/src/db/schema.ts` - Define tables: users, organizations, team_members, invoices, api_keys
- [ ] Create `packages/vault/src/db/connection.ts` - SQLite connection singleton
- [ ] Create `packages/vault/src/db/seed.ts` - Seed script with:
  - Organization "Acme Corp" with payout account "ACME-BANK-001"
  - Admin user: admin@acme.com / admin123
  - Employee user: employee@acme.com / employee123
  - 3 additional team members
  - 5 invoices with varied statuses
  - 2 API keys

### Task 1.2: Authentication & Middleware
- [ ] Create `packages/vault/src/middleware/auth.ts`:
  - `requireAuth` - checks session, returns 401 if not authenticated
  - Session configuration with signed cookies
- [ ] Create `packages/vault/src/middleware/rbac.ts`:
  - `requireAdmin` - checks user.role === 'admin', returns 403 if not
- [ ] Implement login/logout session management
- [ ] Password hashing with bcrypt (hash on seed, compare on login)

### Task 1.3: API Routes
- [ ] `routes/auth.ts` - POST /api/auth/login, POST /api/auth/logout, GET /api/me
- [ ] `routes/dashboard.ts` - GET /api/dashboard (metrics: team size, invoices, plan)
- [ ] `routes/team.ts` - GET /api/team, POST /api/team/invite (ADMIN), DELETE /api/team/:id (ADMIN)
- [ ] `routes/billing.ts`:
  - GET /api/billing/invoices
  - GET /api/billing/payment-methods
  - GET /api/billing/payout
  - PUT /api/billing/payout (**INTENTIONALLY MISSING requireAdmin**)
- [ ] `routes/settings.ts` - GET /api/settings, PUT /api/settings (ADMIN)
- [ ] `routes/keys.ts` - GET /api/keys, POST /api/keys, DELETE /api/keys/:id

### Task 1.4: Vault Frontend (Server-Rendered)
- [ ] Create EJS layout template with navigation sidebar
- [ ] Login page (`/login`)
- [ ] Dashboard page (`/dashboard`) - metrics cards
- [ ] Team page (`/team`) - member table, invite form (admin only)
- [ ] Billing page (`/billing`) - invoices table, payment methods
- [ ] Payout page (`/billing/payout`) - payout account form (hidden from employee nav but accessible via URL)
- [ ] Settings page (`/settings`) - org settings form (admin only)
- [ ] API Keys page (`/api-keys`) - key list, generate button
- [ ] Navigation: conditionally render admin-only links based on user role
- [ ] Static assets: minimal CSS for professional appearance

### Task 1.5: Vault Server Entry
- [ ] Create `packages/vault/src/index.ts`:
  - Express app setup
  - Session middleware
  - EJS view engine configuration
  - Mount all route modules
  - Serve static files
  - Database initialization and seeding on first run
  - Listen on port 4000

---

## Phase 2: Tutus Investigation Server

### Task 2.1: Server Infrastructure
- [ ] Create `packages/server/src/index.ts`:
  - Express app + HTTP server
  - WebSocket server (ws) attached to HTTP server
  - CORS configuration for UI dev server
  - Listen on port 3000
- [ ] Create `packages/server/src/ws/broadcaster.ts`:
  - WebSocket connection management
  - Broadcast helper: send typed messages to all connected clients
  - Connection heartbeat/keepalive
- [ ] Create `packages/server/src/api/routes.ts`:
  - POST /api/investigate - Start new investigation
  - POST /api/replay - Replay a finding
  - GET /api/findings - List past findings
  - GET /api/findings/:id - Get specific finding

### Task 2.2: Playwright Controller
- [ ] Create `packages/server/src/browser/controller.ts`:
  - `launch(headless: boolean)` - Start browser instance
  - `navigate(url: string)` - Go to URL, wait for load
  - `screenshot(name: string)` - Capture page screenshot as base64
  - `getPageLinks()` - Extract all anchor hrefs from current page
  - `getPageForms()` - Extract form actions, methods, and fields
  - `getButtons()` - Extract button elements with text/attributes
  - `fillAndSubmit(selector, fields, submitSelector)` - Fill form and click submit
  - `click(selector)` - Click an element
  - `getText(selector)` - Get text content
  - `waitForNavigation()` - Wait for page navigation
  - `getCurrentUrl()` - Get current URL
  - `getPageTitle()` - Get page title
  - `close()` - Close browser
- [ ] Create network interception utilities:
  - `startIntercepting()` - Begin capturing API requests/responses
  - `stopIntercepting()` - Stop and return captured data
  - Filter to only API calls (exclude static assets)

### Task 2.3: Investigation Orchestrator
- [ ] Create `packages/server/src/engine/orchestrator.ts`:
  - Manages InvestigationState
  - Executes phases sequentially
  - Emits events to broadcaster between phases
  - Handles errors and phase transitions
  - Stores completed investigation results in memory

### Task 2.4: Phase - Authentication
- [ ] Create `packages/server/src/engine/phases/authenticate.ts`:
  - Navigate to target URL
  - Detect login form (find input[type=email], input[type=password], submit button)
  - Fill credentials
  - Submit form
  - Wait for redirect/navigation
  - Verify login succeeded (check for dashboard elements or URL change away from /login)
  - Return authenticated state
  - Emit progress events

### Task 2.5: Phase - Exploration
- [ ] Create `packages/server/src/engine/phases/explore.ts`:
  - Start from current page (post-login)
  - Extract navigation links (sidebar, header, footer)
  - Create visited set to avoid loops
  - BFS through discovered links (max depth 3, max pages 20)
  - For each page: record URL, title, visible text, forms, buttons
  - Build PageNode[] sitemap
- [ ] Create `packages/server/src/engine/phases/wordlist.ts`:
  - Small list of common sensitive paths: `/admin`, `/billing/payout`, `/settings/advanced`, `/api/admin`, etc.
  - Probe each by appending to base URL
  - If page loads (non-404, non-redirect to login), add to sitemap
  - Emit page_discovered events for each new page

### Task 2.6: Phase - Action Discovery
- [ ] Create `packages/server/src/engine/phases/discover.ts`:
  - For each page in sitemap:
    - Extract forms: action URL, method, field names, button text
    - Extract buttons: text, type, onclick hints
    - Extract API endpoints from links with method hints
  - Classify each action:
    - Label (from button/link text)
    - Target URL
    - HTTP method (inferred from form method or link pattern)
    - Field names and types
    - Page where found
  - Deduplicate actions (same URL + method = same action)
  - Emit action_discovered events

### Task 2.7: Phase - Risk Analysis
- [ ] Create `packages/server/src/engine/scoring.ts`:
  - Implement risk scoring weights:
    - Financial keywords (40): payout, payment, transfer, bank, account, billing
    - Destructive keywords (30): delete, remove, revoke, disable, destroy
    - Privilege keywords (25): admin, role, permission, invite, settings
    - Data keywords (20): export, download, credentials, key, secret
    - Organization scope (15): detected from URL or context
    - Write method (10): PUT/POST/DELETE score higher than GET
  - Score each discovered action
  - Sort by score descending
  - Return top N (5) for verification
- [ ] Create `packages/server/src/engine/phases/analyze.ts`:
  - Apply scoring to all discovered actions
  - Emit ranked list via broadcaster
  - Log scoring rationale for each action

### Task 2.8: Phase - Verification
- [ ] Create `packages/server/src/engine/phases/verify.ts`:
  - For each top-ranked action:
    - Start network interception
    - Navigate to the action's page
    - Attempt to perform the action:
      - For forms: fill with test data, submit
      - For API calls: make direct request with session cookies
    - Observe result:
      - HTTP status code
      - Response body
      - Any error messages on page
      - Success indicators (confirmation messages, data changes)
    - Stop interception, capture request/response
    - Classify: CONFIRMED / DENIED / FAILED
  - Use safe test values:
    - Payout account: "HACKED-ACCOUNT-999"
    - Other fields: "test-value-{timestamp}"
  - Emit verification_result events

### Task 2.9: Phase - Evidence Collection
- [ ] Create `packages/server/src/engine/phases/evidence.ts`:
  - For each CONFIRMED finding:
    - Screenshot the confirmation/success state
    - Re-navigate and screenshot showing the changed data persisted
    - Package captured network request (method, URL, headers, body)
    - Package captured network response (status, headers, body)
    - Record timestamps for all evidence items
  - Store evidence in investigation state

### Task 2.10: Phase - Finding Generation
- [ ] Create `packages/server/src/engine/phases/finding.ts`:
  - Select highest-impact confirmed action as primary finding
  - Generate Finding object:
    - Title: descriptive action name
    - Severity: based on risk score (financial confirmed = critical)
    - Confidence: high (if HTTP 200 + state change verified)
    - Actor: the authenticated user email + role
    - Expected privilege: "admin" (inferred from action type)
    - Actual privilege: "employee" (the authenticated role)
    - Impact: generated description of business impact
    - Reproduction steps: ordered list from authentication to action
    - Evidence: screenshots + request/response
    - Timestamp: ISO string
  - Emit finding_ready event with complete finding

### Task 2.11: Replay Engine
- [ ] Create `packages/server/src/browser/replay.ts`:
  - Accept Finding with reproduction steps
  - Launch new browser (headed mode for visibility)
  - Execute each step sequentially:
    - Navigate to URL
    - Fill form fields
    - Click buttons
    - Wait for responses
  - After final step, verify the action succeeded again
  - Emit replay_progress and replay_complete events
  - Screenshot final state as replay evidence

---

## Phase 3: Tutus Frontend

### Task 3.1: Project Setup & Layout
- [ ] Create `packages/ui/src/main.tsx` - React entry point
- [ ] Create `packages/ui/src/App.tsx` - Top-level routing between views
- [ ] Create `packages/ui/src/components/Layout.tsx`:
  - Dark theme container
  - Header with Tutus logo/wordmark
  - Centered content area
  - Professional security-product aesthetic
- [ ] Create `packages/ui/src/styles/globals.css`:
  - Tailwind imports
  - Custom CSS variables for brand colors
  - Dark theme defaults
- [ ] Create `packages/ui/index.html` - Vite entry HTML

### Task 3.2: Target Input Form
- [ ] Create `packages/ui/src/components/TargetForm.tsx`:
  - URL input field (prefilled with localhost:4000 for demo)
  - Username input field
  - Password input field
  - Large "FIND" button (primary CTA)
  - Validation: all fields required
  - Submit calls POST /api/investigate
  - Transitions to investigation view on success

### Task 3.3: Investigation Progress View
- [ ] Create `packages/ui/src/components/PhaseTracker.tsx`:
  - Vertical stepper showing all phases
  - Current phase highlighted/animated
  - Completed phases with checkmarks
  - Upcoming phases grayed out
  - Phase names: Authentication, Exploration, Discovery, Analysis, Verification, Evidence, Finding
- [ ] Create `packages/ui/src/components/ActivityFeed.tsx`:
  - Scrolling list of real-time events
  - Each entry: timestamp + message + optional detail
  - Auto-scroll to latest
  - Color-coded by type (info, success, warning)
  - Shows discovered pages, actions, verification results
- [ ] Create `packages/ui/src/components/StatusBar.tsx`:
  - Current phase label
  - Elapsed time counter
  - Discovered pages count
  - Discovered actions count

### Task 3.4: Finding Report View
- [ ] Create `packages/ui/src/components/FindingReport.tsx`:
  - Finding title and severity badge
  - Structured details: actor, expected privilege, actual privilege
  - Impact description
  - Confidence indicator
- [ ] Create `packages/ui/src/components/EvidencePanel.tsx`:
  - Tabbed interface: Screenshots | Request | Response
  - Screenshot viewer with before/after comparison
  - Request viewer: syntax-highlighted HTTP request
  - Response viewer: syntax-highlighted HTTP response
- [ ] Create `packages/ui/src/components/ReproductionSteps.tsx`:
  - Ordered numbered list of steps
  - Each step: action description + target URL
- [ ] Create `packages/ui/src/components/ReplayButton.tsx`:
  - Prominent "Replay" button
  - Loading state during replay
  - Success/failure result display
  - Progress indicator (step X of Y)

### Task 3.5: WebSocket Integration
- [ ] Create `packages/ui/src/hooks/useWebSocket.ts`:
  - Connect to ws://localhost:3000
  - Auto-reconnect on disconnect
  - Parse incoming messages by type
  - Expose: connected status, messages, last event
- [ ] Create `packages/ui/src/hooks/useInvestigation.ts`:
  - useReducer for UIState management
  - Process WebSocket messages into state updates
  - Handle phase transitions, activity events, finding delivery
  - Manage view transitions (input → investigating → finding)

### Task 3.6: Type Definitions
- [ ] Create `packages/ui/src/types/index.ts`:
  - Mirror server-side types: Phase, Finding, DiscoveredAction, Evidence, etc.
  - ServerMessage union type
  - UIState interface

---

## Phase 4: Integration & Polish

### Task 4.1: End-to-End Wiring
- [ ] Verify Vault starts and serves pages correctly
- [ ] Verify Tutus server connects to Vault via Playwright
- [ ] Verify WebSocket messages flow from server to UI
- [ ] Verify complete investigation pipeline produces a finding
- [ ] Verify replay executes and confirms vulnerability

### Task 4.2: Startup Orchestration
- [ ] Configure root `package.json` dev script with concurrently:
  - Start Vault on :4000
  - Start Tutus server on :3000
  - Start Tutus UI on :5173
- [ ] Add health checks / readiness detection
- [ ] Create README with setup instructions

### Task 4.3: UI Polish
- [ ] Add loading animations / skeleton states
- [ ] Add transition animations between views
- [ ] Add error handling UI (connection lost, investigation failed)
- [ ] Add Tutus branding/logo
- [ ] Responsive layout (works on standard laptop screen)
- [ ] Accessibility: keyboard navigation, ARIA labels, focus management

### Task 4.4: Demo Reliability
- [ ] Add retry logic to Playwright operations (element not found, timeout)
- [ ] Add timeouts to each phase (prevent infinite hangs)
- [ ] Handle Vault response delays gracefully
- [ ] Ensure investigation produces consistent results across runs
- [ ] Reset Vault payout account before each investigation (or use unique test values)

---

## Implementation Order (Critical Path)

```
Task 0.1 → 0.2 (scaffolding must come first)
     ↓
Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5 (Vault, sequential dependencies)
     ↓
Task 2.1 → 2.2 (server infra + Playwright, can start once Vault API exists)
     ↓
Task 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 2.9 → 2.10 (pipeline phases, sequential)
     ↓
Task 2.11 (replay, after finding generation works)

Task 3.1 → 3.2 (UI setup, can start in parallel with Phase 2)
     ↓
Task 3.5 → 3.3 → 3.4 (WebSocket first, then views that consume it)
     ↓
Task 3.6 (types, can be done early or as needed)

Task 4.1 → 4.2 → 4.3 → 4.4 (integration last)
```

---

## Effort Estimates

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 0: Scaffolding | 0.1 - 0.2 | 1 hour |
| Phase 1: Vault | 1.1 - 1.5 | 4 hours |
| Phase 2: Tutus Server | 2.1 - 2.11 | 6 hours |
| Phase 3: Tutus UI | 3.1 - 3.6 | 4 hours |
| Phase 4: Integration | 4.1 - 4.4 | 3 hours |
| **Total** | | **~18 hours** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Playwright flakiness | Generous timeouts, retry wrappers, waitForSelector before actions |
| Exploration missing the payout page | Wordlist probing supplements link-following discovery |
| WebSocket message ordering | Sequence numbers on events, UI handles out-of-order gracefully |
| SQLite locking during concurrent access | Single investigation at a time (queue model) |
| Port conflicts | Configurable ports via env vars with sensible defaults |
