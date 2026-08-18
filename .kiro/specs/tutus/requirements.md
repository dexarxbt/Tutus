# Tutus - Requirements Specification

## Project Overview

Tutus is an AI-powered security investigation agent that autonomously discovers the most dangerous action an authenticated user can actually perform in a target web application. It provides a complete local demonstration environment consisting of a vulnerable SaaS application (Vault) and the investigation agent itself (Tutus).

**Core Question Tutus Answers:** "What is the most dangerous thing this particular user can actually do?"

---

## Functional Requirements

### FR-1: Target Application (Vault)

#### FR-1.1: Application Structure
- MUST be a realistic SaaS application with the following modules:
  - Authentication (login/logout)
  - Dashboard (overview metrics, recent activity)
  - Team Management (view/invite/remove members)
  - Billing (invoices, payment methods, payout account)
  - Settings (organization profile, preferences)
  - API (REST endpoints mirroring UI capabilities)

#### FR-1.2: Role-Based Access Control
- MUST implement two roles:
  - **ADMIN**: Full access to all application features
  - **EMPLOYEE**: Limited access appropriate for a standard team member
- MUST enforce role checks on the server side for all protected actions
- MUST present UI elements conditionally based on role (hide admin-only navigation from employees)

#### FR-1.3: Intentional Authorization Flaw
- The application MUST contain exactly one real, exploitable authorization flaw:
  - **Flaw**: An EMPLOYEE can successfully change the organization's payout account
  - **Mechanism**: The server-side endpoint for updating payout account MUST accept requests from EMPLOYEE-role users despite the action being intended for ADMIN only
  - **UI Behavior**: The payout account management UI MUST be hidden from employees in navigation, but the endpoint must remain accessible via direct HTTP request or direct URL navigation
- This MUST be a real working application behavior, not a simulated or fake finding

#### FR-1.4: Seed Data
- MUST provide pre-configured user accounts:
  - Admin user with known credentials
  - Employee user with known credentials
- MUST provide realistic seed data (team members, invoices, organization details)

---

### FR-2: Investigation Agent (Tutus)

#### FR-2.1: User Interface - Input
- MUST accept:
  - Target application URL
  - User credentials (username/password)
- MUST provide a single "FIND" button to initiate investigation
- MUST NOT require any additional configuration for basic operation

#### FR-2.2: Investigation Pipeline
The agent MUST execute the following phases autonomously and in sequence:

1. **Authentication**: Log into the target application using provided credentials
2. **Application Exploration**: Navigate the application, discover pages, map the sitemap
3. **Action Discovery**: Identify all actionable elements (buttons, forms, links, API endpoints)
4. **Risk Analysis**: Prioritize discovered actions by potential impact (financial > data > configuration)
5. **Verification**: Attempt high-risk actions and observe results
6. **Evidence Collection**: Capture screenshots, network requests/responses, DOM state
7. **Finding Generation**: Produce structured security finding

#### FR-2.3: Investigation Constraints
- MUST NOT be hard-coded to navigate directly to any specific page
- MUST discover the vulnerability through genuine exploration
- MUST authenticate like a real user (via the login form)
- MUST handle exploration failures gracefully (404s, permission denied, etc.)

#### FR-2.4: Real-Time Progress
- MUST display real-time progress through each investigation phase
- MUST show the current phase name and status
- MUST display live activity feed (pages visited, actions discovered, tests performed)
- MUST indicate completion of each phase visually

#### FR-2.5: Finding Report
The generated finding MUST include:
- **Severity**: Critical / High / Medium / Low rating
- **Confidence**: Percentage or High/Medium/Low
- **Actor**: The authenticated user/role that can perform the action
- **Expected Privilege**: The role that should be required
- **Actual Privilege**: The role that was sufficient
- **Impact**: Description of business impact
- **Reproduction Steps**: Ordered list of steps to reproduce
- **Evidence**:
  - Screenshots (before/after state change)
  - Network request (method, URL, headers, body)
  - Network response (status, body)
- **Timestamp**: When the finding was confirmed

#### FR-2.6: Replay Capability
- MUST support replaying the recorded reproduction steps using real browser automation
- Replay MUST execute the exact sequence of actions that produced the finding
- Replay MUST show live browser activity during execution
- Replay MUST confirm whether the vulnerability is still present

---

### FR-3: User Interface (Tutus Frontend)

#### FR-3.1: Visual Design
- MUST have a polished, modern security-product aesthetic
- MUST use a dark theme appropriate for security tooling
- MUST use clear typography and spacing

#### FR-3.2: Primary Flow
The UI MUST present the following sequential experience:
1. Target input form (URL + credentials)
2. Investigation progress (phase-by-phase with live updates)
3. Finding display (structured report with evidence)
4. Replay control (button to re-execute the finding)

#### FR-3.3: Live Investigation View
- MUST show phase progression (Authentication > Exploration > Discovery > Analysis > Verification > Evidence > Finding)
- MUST show activity log with timestamps
- MUST show discovered pages/actions count
- SHOULD show a live browser view or screenshots of current state

---

## Non-Functional Requirements

### NFR-1: Local Execution
- The entire system MUST run locally without paid external services
- MUST NOT require API keys for cloud AI services
- MUST use a local LLM or deterministic decision engine for the MVP

### NFR-2: Technology Stack
- MUST use modern TypeScript throughout
- MUST use Playwright for browser automation
- Architecture MUST be simple enough to implement and test reliably in a hackathon timeframe

### NFR-3: Developer Experience
- MUST be startable with a single command (or minimal commands)
- MUST include clear setup instructions
- MUST work on Windows, macOS, and Linux

### NFR-4: Performance
- Full investigation SHOULD complete within 2 minutes
- UI MUST remain responsive during investigation
- Real-time updates MUST have less than 1 second latency

### NFR-5: Reliability
- Investigation MUST produce consistent results on repeated runs
- The agent MUST handle network delays and page load times gracefully
- The agent MUST recover from transient errors (element not found, timeout) with retries

---

## Acceptance Criteria

### AC-1: End-to-End Flow
Given Vault is running with seed data,
When a user provides the employee credentials and clicks FIND,
Then Tutus authenticates, explores, discovers, and reports "Employee can change payout account" as the primary finding.

### AC-2: Genuine Discovery
The investigation log MUST show that Tutus:
- Visited multiple pages (not just the payout page)
- Discovered multiple actions across the application
- Ranked actions by risk before testing them
- Did NOT navigate directly to the vulnerability

### AC-3: Evidence Quality
The finding MUST include:
- At least one screenshot showing the successful state change
- The exact HTTP request that performed the unauthorized action
- The HTTP response confirming success
- Clear before/after evidence of the payout account change

### AC-4: Replay
When the user clicks Replay,
The system MUST re-execute the reproduction steps in a real browser,
And confirm the vulnerability is still exploitable.

### AC-5: No External Dependencies
The system MUST run completely offline after initial npm install,
With no calls to external AI APIs or cloud services during operation.

---

## Out of Scope (MVP)

- Multiple user testing (only one user per investigation)
- Custom vulnerability injection
- CI/CD integration
- PDF/export of findings
- Multi-application scanning
- Authentication methods beyond username/password
- Session management testing
- Rate limiting or DoS testing
