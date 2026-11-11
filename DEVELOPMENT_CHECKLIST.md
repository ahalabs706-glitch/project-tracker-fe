# ProjectFlow Frontend Development Checklist

This plan follows the frontend phases in [PRD_MVP.md](./PRD_MVP.md). Work is delivered one phase at a time; a phase is checked only after its implementation and validation pass.

## FE-01 — Frontend foundation

- [x] Scaffold the application with Vite, React, and TypeScript.
- [x] Add the frontend package scripts and baseline lint/build configuration.
- [x] Configure the development server to use port `5173`.
- [x] Add the local API base URL to `.env.example` without committing secrets.
- [x] Add a lightweight ProjectFlow foundation screen and document the roadmap.
- [x] Validate dependency installation, lint, and production build.

## FE-02 — Design system and application layout

- [x] Define shared typography, color, spacing, status, and responsive design tokens.
- [x] Build reusable accessible controls, empty states, live-region feedback, native dialogs, data tables, and labeled form primitives.
- [x] Implement the responsive sidebar, top navigation, breadcrumbs, search field, profile menu, and mobile navigation.
- [x] Add permission-filtered navigation and a consistent application shell; backend authorization remains authoritative.

## FE-03 — Authentication and route protection

- [x] Implement the login form with client validation and API error feedback.
- [x] Add the shared Axios client, typed API envelopes, and centralized error handling.
- [x] Implement in-memory access-token handling and refresh through the HttpOnly cookie; never persist refresh tokens in browser storage.
- [x] Add session initialization, automatic refresh, logout, protected routes, and permission guards.
- [x] Verify request origin/credentials behavior against the backend authentication API.

## FE-04 — Dashboard

- [x] Connect dashboard KPIs, project status, contract alerts, timeline, and budget summaries to backend APIs.
- [x] Add supported date/department/status filters, loading, empty, retryable error, and refresh states.
- [x] Ensure dashboard values come from backend aggregates and never from production mock data.

## FE-05 — Project management

- [x] Implement project list, search, status/priority/department filters, sorting, pagination, and permission-aware actions.
- [x] Implement project create/edit forms and project detail overview.
- [x] Add team assignment, status/progress updates, archive, and backend-calculated budget summary.
- [x] Cover client validation, server authorization feedback, loading, empty, and retryable error states.

## FE-06 — Task and milestone management

- [x] Implement the user's task list and task detail/update flows.
- [x] Implement project milestone list/detail and supported status/progress operations.
- [x] Display overdue and upcoming states using backend results and the configured business timezone.
- [x] Add appropriate form validation and recoverable error handling.

## FE-07 — Contract management

- [x] Implement contract list, search, filters, pagination, and expiration classifications.
- [x] Implement contract create/edit and detail views with renewal history.
- [x] Add expiration monitoring and renewal flows supported by the API.
- [x] Keep contract document upload out of the UI until the backend upload endpoint is implemented.
- [ ] Verify authenticated list, detail, create/edit validation, and renewal flows against the local backend.

## FE-08 — Budget management

- [x] Implement project budget overview and category allocations.
- [x] Display actual, committed, forecast, remaining, variance, and utilization from backend calculations.
- [x] Implement transaction list, filters, create, post, cancel, and correction flows as authorized.
- [x] Preserve decimal-string amounts and currency boundaries; do not calculate authoritative totals in the browser.
- [ ] Verify authenticated budget summary, allocation, and transaction workflows against the local backend.

## FE-09 — Notifications

- [x] Implement notification center, unread count, pagination, and supported read/mark-read actions.
- [x] Link notifications only to related resources the signed-in user is permitted to access.
- [x] Add empty/loading/error states and prevent duplicate read actions while a request is pending.
- [ ] Verify authenticated notification listing and read actions against the local backend.

## FE-10 — User and department management

- [x] Implement permission-protected user and department lists with search and pagination.
- [x] Implement user create/edit, activation status, role assignment, and department assignment.
- [x] Implement department create/edit and activation status.
- [x] Surface backend validation and conflict errors without discarding form input.
- [ ] Verify authenticated user/department workflows against the local backend.

## FE-11 — Reporting

- [x] Confirm report endpoints and response shapes against the shared API contract and backend route registry.
- [x] Keep reporting UI and exports disabled while the backend endpoints are unavailable; do not fabricate report data.
- [ ] Implement project, contract-expiration, and budget reports with supported filters.
- [ ] Add CSV export and print-friendly output using server data.

## FE-12 — Testing and production build

- [x] Add unit and component tests for API URL utilities, permission gates, notification states, and login validation.
- [x] Add API contract tests and Playwright coverage for login validation and mobile responsiveness.
- [x] Verify responsive behavior, accessible permission handling, and notification loading/empty/error/retry states.
- [x] Validate production API configuration, production build/container image, and deployment documentation.
- [x] Confirm no production route depends on hardcoded mock data.

## MVP acceptance

- [ ] Required frontend routes and workflows are implemented against the shared API contract.
- [ ] Authentication and backend-enforced permissions are reflected in route and action behavior.
- [ ] Dashboard, projects, tasks, milestones, contracts, budgets, notifications, and administration use live API data.
- [ ] Reports are enabled only when reporting endpoints are available.
- [ ] Data-driven pages provide loading, empty, error, and success feedback.
- [ ] Critical user journeys pass automated tests and the production build succeeds.

**Current stage:** FE-12 automated coverage and production build complete. Authenticated smoke tests for FE-07 through FE-10 remain pending. Report screens and exports are deferred because the shared API contract marks them planned and neither backend route registration nor OpenAPI exposes report endpoints.
