# Tutus - Minimum Vertical Slice

## Purpose

This document defines the smallest possible implementation that proves the entire Tutus concept works end-to-end. If this slice works, the remaining work is expansion and polish — not architectural risk.

---

## The Slice

**One sentence**: Tutus authenticates into Vault as an employee, explores the app, discovers the payout action, attempts it, confirms it works, and displays the finding in the UI with evidence.

---

## What's IN the Slice

### Vault (Minimal)

| Component | Scope |
|-----------|-------|
| Database | SQLite with users + organizations tables only |
| Auth | Login endpoint + session middleware |
| Pages | Login, Dashboard, Billing/Payout (3 pages total) |
| Routes | POST /api/auth/login, GET /api/dashboard, GET /api/billing/payout, PUT /api/billing/payout |
| Flaw | PUT /api/billing/payout missing requireAdmin |
| UI | Login form, dashboard with nav links, payout form |
| Roles | Admin + Employee (2 seed users) |

That's it. No team management, no settings, no API keys, no invoices. Just enough to have a login, a dashboard with links, and the vulnerable endpoint.

### Tutus Server (Minimal)

| Component | Scope |
|-----------|-------|
| Express + WS | Server entry, one REST endpoint, WebSocket broadcaster |
| Playwright | Launch, navigate, fill form, click, screenshot, network intercept |
| Auth phase | Find login form, fill credentials, submit, verify redirect |
| Explore phase | Get nav links from dashboard, visit each, record pages |
| Discover phase | Find forms on each page, extract action/method/fields |
| Analyze phase | Score actions with simplified heuristic (just financial + write keywords) |
| Verify phase | Attempt top-ranked action, observe HTTP response |
| Evidence phase | Screenshot + captured request/response |
| Finding phase | Generate structured Finding object |

No replay in the slice. No wordlist probing. Simplified scoring (2 factors instead of 6).

### Tutus UI (Minimal)

| Component | Scope |
|-----------|-------|
| TargetForm | URL + credentials + FIND button |
| PhaseTracker | Simple text showing current phase |
| ActivityFeed | Scrolling list of WS messages |
| FindingReport | Render the Finding object with evidence |

No animations, no replay button, no polished design. Functional dark-themed layout with Tailwind defaults.

---

## What's NOT in the Slice

- Team management pages/routes
- Settings pages/routes
- API key management
- Invoices/payment methods
- Wordlist probing exploration
- Risk scoring with full 6-factor weights
- Replay capability
- UI polish (animations, transitions, branding)
- Multiple findings
- Error recovery/retries
- Startup orchestration script

---

## Success Criteria for the Slice

The slice is proven when this sequence completes:

```
1. npm run dev starts Vault (:4000) and Tutus server (:3000) and UI (:5173)
2. Open browser to localhost:5173
3. Enter: URL=http://localhost:4000, user=employee@acme.com, pass=employee123
4. Click FIND
5. Watch phases progress in real-time (7 phases complete)
6. See finding displayed:
   - Title: "Employee can change payout account"
   - Severity: Critical
   - Actor: employee@acme.com (employee)
   - Expected: admin
   - Actual: employee
   - Evidence: screenshot + PUT request + 200 response
```

If those 6 steps work, the concept is proven.

---

## Implementation Order for the Slice

This is the most efficient build sequence to reach a working slice:

```
Step 1: Scaffolding (30 min)
  - Root package.json with workspaces
  - Package.json for vault, server, ui
  - tsconfig files
  - Basic dev scripts with concurrently

Step 2: Vault API only (45 min)
  - SQLite schema (users + orgs)
  - Seed data (2 users, 1 org)
  - Auth middleware (session-based)
  - Login route
  - Dashboard route (returns JSON)
  - Payout GET/PUT routes (PUT missing admin check)
  - Verify with curl: employee can PUT payout

Step 3: Vault UI (45 min)
  - EJS templates: login, dashboard, payout
  - Login form that POSTs to /api/auth/login
  - Dashboard with sidebar nav (links to /billing/payout)
  - Payout page with form to update account
  - Hide payout link from employee nav (but page still accessible)

Step 4: Playwright Controller (30 min)
  - Launch browser
  - Navigate, fill form, click, screenshot
  - Network interception (capture API calls)
  - Close browser

Step 5: Investigation Pipeline (2 hours)
  - Orchestrator skeleton (state machine)
  - Auth phase: detect login form, fill, submit, verify
  - Explore phase: extract nav links, visit each
  - Discover phase: find forms on each page
  - Analyze phase: score by keywords (financial + write = high)
  - Verify phase: submit top form, check response
  - Evidence phase: screenshot + request/response capture
  - Finding phase: assemble Finding object

Step 6: Server API + WebSocket (30 min)
  - POST /api/investigate → start pipeline
  - WebSocket broadcasting at each phase transition
  - Send finding when complete

Step 7: Frontend (1 hour)
  - Vite + React + Tailwind setup
  - TargetForm component
  - WebSocket hook
  - PhaseTracker (text-based)
  - ActivityFeed (message list)
  - FindingReport (structured display with evidence)

Step 8: Wire & Test (30 min)
  - Start all three services
  - Run through the flow manually
  - Fix any integration issues
  - Confirm finding displays correctly
```

**Total estimated time for working slice: ~6.5 hours**

---

## After the Slice Works

Once the slice is proven, expand in this priority order:

1. **Add remaining Vault pages** (team, settings, keys, invoices) — makes exploration more realistic
2. **Full risk scoring engine** — 6-factor weighted system
3. **Wordlist probing** — ensures payout page is found even without nav link
4. **UI polish** — animations, proper phase stepper, evidence tabs, dark theme refinement
5. **Replay capability** — re-execute reproduction steps in headed browser
6. **Error handling & retries** — robust Playwright operations
7. **Branding** — logo, typography, final visual design

---

## Risk Assessment for the Slice

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Playwright can't detect Vault's login form | Low | High | Use standard input names (email, password), add data-testid attributes |
| Exploration doesn't find payout page | Medium | High | In slice, payout IS in the nav (just hidden for employee). Link exists in HTML, just CSS-hidden |
| Employee session doesn't carry to API call | Low | Medium | Use same browser context; cookies persist across navigation |
| WebSocket messages lost/misordered | Low | Low | Messages are additive; UI handles them regardless of order |
| Form submission fails silently | Low | Medium | Check HTTP status AND response body; screenshot captures visible state |

### Critical Design Choice for the Slice

**The payout link is CSS-hidden from employee navigation, NOT removed from the DOM.**

This is crucial: the exploration phase discovers links by reading `<a>` elements from the page, regardless of CSS visibility. By hiding the link with CSS (`display: none` based on role class) rather than server-side omitting it, we ensure the explorer finds it through standard DOM traversal. This is also how many real-world authorization flaws work — the UI "hides" things but the links/endpoints remain accessible.

Alternative: If we want to make discovery harder (more realistic), we can remove the link entirely from employee HTML and rely on the wordlist prober to find `/billing/payout`. But for the slice, CSS-hiding is simpler and guarantees discovery works.

---

## Definition of Done (Slice)

- [ ] `npm install` at root installs all dependencies
- [ ] `npm run dev` starts all three services
- [ ] Vault login works for both admin and employee
- [ ] Vault payout endpoint accepts PUT from employee (the flaw)
- [ ] Tutus accepts target URL + credentials via UI
- [ ] Investigation runs all 7 phases without crashing
- [ ] WebSocket delivers real-time phase updates to UI
- [ ] Finding is generated with correct severity, actor, privilege info
- [ ] Finding includes at least one screenshot
- [ ] Finding includes the PUT request/response as evidence
- [ ] UI displays the complete finding
