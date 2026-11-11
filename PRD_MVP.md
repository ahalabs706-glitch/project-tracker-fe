# FRONTEND PRD
# ProjectFlow – Project & Contract Management System

**Document Type:** Product Requirements Document  
**Product:** ProjectFlow  
**Component:** Frontend Application  
**Version:** 1.0  
**Scope:** MVP  
**Technology:** Vite, React, TypeScript  
**Architecture:** Feature-Based Frontend Architecture

---

## 1. Product Overview

### 1.1 Background

ProjectFlow is an enterprise application for project and contract monitoring.

The frontend provides an intuitive interface for employees, Project Managers, Contract Managers, Finance teams, and Executives to monitor project execution, contract expiration, and budget utilization.

### 1.2 Main Objectives

The frontend must:

- Provide a centralized project monitoring dashboard.
- Make contract expiration information easy to identify.
- Allow Project Managers to monitor project timelines and tasks.
- Allow Finance to track budget and expenditures.
- Provide actionable alerts and notifications.
- Support management reporting.
- Deliver a consistent and responsive user experience.

### 1.3 Target Users

| Role | Primary Activities |
|---|---|
| Super Admin | Full application administration |
| Admin | User and department management |
| Executive | Monitor dashboard and reports |
| Project Manager | Manage projects, tasks, milestones |
| Project Member | Update assigned tasks |
| Finance | Monitor budget and transactions |
| Contract Manager | Manage contracts and renewals |
| Viewer | View authorized information |

The UI must adapt to backend permissions.

Hiding a menu or button is not a substitute for backend authorization.

---

## 2. Technology Stack

| Component | Technology |
|---|---|
| Build Tool | Vite |
| UI Framework | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Routing | React Router |
| Server State | TanStack Query |
| Client State | Zustand |
| API Client | Axios |
| Form Handling | React Hook Form |
| Validation | Zod |
| Charts | Recharts |
| Icons | Lucide React |
| Date Utilities | date-fns |
| Timeline | Calendar / Gantt-compatible library |
| Testing | Vitest + React Testing Library |
| E2E Testing | Playwright |

Use stable and compatible package versions.

---

## 3. UI/UX Design Requirements

### 3.1 Design Direction

Design a professional enterprise SaaS application.

References:

- Linear
- Jira
- Monday.com
- Asana
- ClickUp

Design characteristics:

- Minimalist interface.
- Clear information hierarchy.
- Consistent spacing.
- Professional typography.
- Responsive layout.
- Accessible color contrast.
- Reusable design components.
- Light mode as default.
- Dark mode can be added as a later enhancement.

### 3.2 Suggested Colors

| Purpose | Color |
|---|---|
| Primary | Navy / Indigo |
| Secondary | Slate |
| Background | Light Gray |
| Success | Green |
| Warning | Amber |
| Danger | Red |
| Information | Blue |

Status colors must remain consistent across all modules.

### 3.3 Main Application Layout

#### Sidebar

Menu structure:

```text
Dashboard

PROJECT MANAGEMENT
  Projects
  My Tasks
  Milestones

CONTRACT MANAGEMENT
  Contracts
  Expiring Contracts

FINANCIAL
  Budget Overview
  Transactions

REPORTS
  Project Reports
  Contract Reports
  Budget Reports

SYSTEM
  Notifications
  User Management
  Department Management
  Settings
```

Menu visibility must be based on authenticated user permissions.

#### Top Navigation

Components:

- Breadcrumb.
- Global search.
- Notification icon.
- Unread notification count.
- User profile.
- User menu.
- Logout.

---

## 4. Authentication

### 4.1 Login Page

Fields:

- Email.
- Password.

Actions:

- Sign in.
- Forgot password.

Features:

- Form validation.
- Loading indicator.
- Error message.
- Invalid credentials feedback.
- Session initialization.

### 4.2 Session Management

Implement:

- Protected routes.
- Access token handling.
- Refresh token handling.
- Automatic session renewal.
- Logout.
- Session expiration handling.

Authentication integration:

- Access token returned by backend.
- Refresh token managed through Secure, HttpOnly cookie.
- Axios interceptor attaches access token to protected requests.
- Refresh endpoint uses credentials.
- Handle refresh failure by ending the session and redirecting to login.

Do not store refresh tokens in localStorage or sessionStorage.

### 4.3 Route Protection

Unauthorized users must not access restricted pages.

Provide:

- Authentication guard.
- Role-aware navigation.
- Permission-aware action controls.
- Access denied page.
- Not found page.

---

## 5. Dashboard

**Priority:** Critical

The dashboard is the primary management monitoring interface.

### 5.1 KPI Cards

Project KPIs:

- Total Projects.
- Active Projects.
- Completed Projects.
- Delayed Projects.
- Projects At Risk.

Contract KPIs:

- Active Contracts.
- Expiring Soon.
- Expired Contracts.
- Renewal Required.

Budget KPIs:

- Total Approved Budget.
- Total Committed Cost.
- Total Actual Expenditure.
- Budget Utilization.

### 5.2 Dashboard Charts

Required visualizations:

1. Project Status Distribution.
2. Project Completion Overview.
3. Budget vs Actual Expenditure.
4. Budget Utilization.
5. Contract Expiration Overview.

### 5.3 Dashboard Tables

**Critical Alerts**

Show:

- Alert type.
- Related project or contract.
- Severity.
- Responsible person.
- Due date.
- Action link.

**Upcoming Contract Expirations**

Show:

- Contract number.
- Contract name.
- Vendor.
- Owner.
- End date.
- Days remaining.
- Status.

**Upcoming Milestones**

Show:

- Project.
- Milestone.
- Planned date.
- Owner.
- Status.

**Overdue Tasks**

Show:

- Task.
- Project.
- Assignee.
- Due date.
- Days overdue.

### 5.4 Filters

- Date range.
- Department.
- Project Manager.
- Project status.

Dashboard information must come from backend aggregation endpoints.

---

## 6. Project Management

**Priority:** Critical

### 6.1 Project List Page

Display:

| Field | Description |
|---|---|
| Project Code | Unique project identifier |
| Project Name | Project name |
| Project Manager | Assigned manager |
| Department | Responsible department |
| Start Date | Project start |
| Target End Date | Target completion |
| Approved Budget | Approved financial allocation |
| Progress | Completion percentage |
| Status | Current project status |

Features:

- Search.
- Filter.
- Sort.
- Pagination.
- Create project.
- Edit project.
- View details.
- Archive project.
- Export CSV.

### 6.2 Create Project Form

Fields:

- Project Name.
- Description.
- Category.
- Department.
- Project Owner.
- Project Manager.
- Start Date.
- Target End Date.
- Approved Budget.
- Currency.
- Priority.
- Initial Status.

Validation:

- Project name is required.
- Department is required.
- Project Manager is required.
- Target End Date cannot precede Start Date.
- Budget cannot be negative.
- Currency must use a valid ISO 4217 code.

### 6.3 Project Detail Page

Create these sections:

**Overview**

- Project information.
- Owner.
- Project Manager.
- Department.
- Status.
- Progress.
- Approved Budget.
- Timeline summary.

**Tasks**

- Task list.
- Task assignments.
- Task status.
- Progress.

**Milestones**

- Milestone list.
- Planned dates.
- Actual dates.
- Completion status.

**Contracts**

- Related contracts.
- Contract status.
- Contract expiration.

**Budget**

- Approved Budget.
- Committed Cost.
- Actual Cost.
- Budget Utilization.

**Activity**

- Recent project activities.
- Status changes.
- Important updates.

---

## 7. Task Management

**Priority:** Critical

### 7.1 My Tasks Page

Display tasks assigned to the authenticated user.

Fields:

- Task Name.
- Project.
- Priority.
- Status.
- Start Date.
- Due Date.
- Progress.

Filters:

- Status.
- Priority.
- Project.
- Overdue.

### 7.2 Task Operations

Users with appropriate permissions can:

- Create tasks.
- Edit tasks.
- Assign tasks.
- Update status.
- Update progress.
- View task details.

Task statuses:

- Backlog.
- To Do.
- In Progress.
- In Review.
- Blocked.
- Done.
- Cancelled.

Overdue tasks must have a visible indicator.

### 7.3 Task Detail

Display:

- Task title.
- Description.
- Project.
- Assigned user.
- Priority.
- Status.
- Planned dates.
- Actual dates.
- Progress.

---

## 8. Milestone Management

**Priority:** Critical

Features:

- Milestone list.
- Create milestone.
- Edit milestone.
- Assign milestone owner.
- Update milestone status.
- Mark milestone as completed.
- Identify delayed milestones.

Display:

- Milestone name.
- Project.
- Planned date.
- Actual date.
- Owner.
- Status.
- Delay indicator.

A milestone should clearly distinguish between planned and actual completion dates.

---

## 9. Contract Management

**Priority:** Critical

This module is designed to prevent contracts from being overlooked.

### 9.1 Contract List Page

Display:

- Contract Number.
- Contract Name.
- Vendor.
- Contract Owner.
- Department.
- Related Project.
- Start Date.
- End Date.
- Contract Value.
- Days Remaining.
- Status.

Features:

- Search by contract number.
- Search by contract name.
- Filter by department.
- Filter by owner.
- Filter by status.
- Filter by expiration period.
- Pagination.
- Create contract.
- Edit contract.
- View contract details.

### 9.2 Contract Registration Form

Fields:

- Contract Number.
- Contract Name.
- Contract Type.
- Vendor.
- Contract Owner.
- Department.
- Related Project.
- Start Date.
- Effective Date.
- End Date.
- Contract Value.
- Currency.
- Renewal Type.
- Renewal Notice Period.
- Description.
- Document Attachments.

Validation:

- Contract number is required.
- Contract name is required.
- Contract owner is required.
- Vendor is required.
- End date cannot precede start date.
- Contract value cannot be negative.
- Effective date must be valid within the contract period.
- Attachments must follow backend file restrictions.

### 9.3 Contract Detail Page

Sections:

**General Information**

- Contract information.
- Vendor.
- Contract owner.
- Department.
- Related project.

**Contract Period**

- Start date.
- Effective date.
- End date.
- Remaining days.

**Financial Information**

- Contract value.
- Currency.

**Renewal History**

- Previous contract.
- Renewal date.
- New contract reference.
- Renewal status.

**Documents**

- Contract files.
- Download document.
- Upload document.

**Activity**

- Contract creation.
- Updates.
- Renewal actions.

### 9.4 Expiration Monitoring

Create an expiration monitoring dashboard.

Categories:

- More than 90 days.
- 60–90 days.
- 30–59 days.
- 14–29 days.
- 1–13 days.
- Expired.

Use consistent status indicators:

- Green: Normal.
- Blue: Early Warning.
- Amber: Warning.
- Orange: High Priority.
- Red: Critical / Expired.

Show the remaining days prominently.

Users must be able to navigate directly from an alert to the contract detail page.

The frontend must use the backend-provided expiration classification as the authoritative value.

### 9.5 Contract Renewal

Allow authorized users to:

- Initiate renewal.
- View previous contract information.
- Register the renewal reference.
- View renewal history.

Renewal must not overwrite the original contract record.

---

## 10. Budget Management

**Priority:** Critical

### 10.1 Budget Overview

Display:

- Total Approved Budget.
- Total Planned Budget.
- Total Committed Cost.
- Total Actual Expenditure.
- Forecast Cost.
- Remaining Budget.
- Budget Variance.
- Budget Utilization.

### 10.2 Budget Visualizations

Charts:

- Approved vs Actual.
- Approved vs Forecast.
- Budget by Category.
- Monthly Expenditure.

### 10.3 Budget Category

Display:

- Category.
- Planned Budget.
- Approved Budget.
- Committed Cost.
- Actual Cost.
- Remaining Budget.

### 10.4 Financial Transactions

Features:

- List transactions.
- Add commitment.
- Add expense.
- View transaction details.
- Filter by transaction type.
- Filter by date.
- Filter by status.
- Search transaction number.

Transaction types:

- COMMITMENT.
- EXPENSE.

Transaction statuses:

- DRAFT.
- POSTED.
- CANCELLED.

### 10.5 Budget Status

Display:

| Utilization | Status |
|---|---|
| Below 80% | Normal |
| 80–89.99% | Warning |
| 90–100% | Critical |
| Above 100% | Over Budget |

All financial totals and authoritative calculations must come from backend responses.

---

## 11. Notification Center

**Priority:** High

Features:

- Notification dropdown.
- Notification list.
- Unread count.
- Mark as read.
- Mark all as read.
- Navigate to related entity.

Notification categories:

- Contract expiration.
- Overdue task.
- Delayed milestone.
- Budget threshold.
- Project update.

Each notification must include:

- Title.
- Message.
- Event type.
- Created date.
- Read status.
- Related entity.

---

## 12. User & Department Management

**Priority:** High

Admin interfaces:

### User Management

- User list.
- Create user.
- Edit user.
- Activate/deactivate user.
- Assign role.
- Assign department.
- View user details.

### Department Management

- Department list.
- Create department.
- Edit department.
- Activate/deactivate department.

Only authorized users can access these screens.

---

## 13. Reporting

**Priority:** High

MVP reports:

### Project Report

- Project list.
- Status.
- Manager.
- Department.
- Completion.
- Target end date.

### Contract Expiration Report

- Contract number.
- Contract name.
- Owner.
- Vendor.
- End date.
- Remaining days.
- Status.

### Budget Report

- Project.
- Approved Budget.
- Committed Cost.
- Actual Cost.
- Forecast Cost.
- Variance.

Features:

- Date filters.
- Department filters.
- Project filters.
- Export CSV.
- Print-friendly layout.

---

## 14. API Integration

**Priority:** Critical

The frontend must consume the shared Go REST API.

Base URL:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

API integration structure:

```text
src/
├── api/
│   ├── client.ts
│   ├── auth.api.ts
│   ├── users.api.ts
│   ├── departments.api.ts
│   ├── projects.api.ts
│   ├── contracts.api.ts
│   ├── tasks.api.ts
│   ├── milestones.api.ts
│   ├── budgets.api.ts
│   ├── notifications.api.ts
│   ├── dashboard.api.ts
│   └── reports.api.ts
```

### API Integration Rules

- Use Axios for HTTP communication.
- Use TanStack Query for server state.
- Use Zustand for client-only global state.
- Use React Hook Form for forms.
- Use Zod for validation.
- Use centralized error handling.
- Use query invalidation after successful mutations.
- Follow backend pagination and filtering contracts.
- Do not duplicate backend calculations.

### API Type Definitions

Maintain shared TypeScript interfaces for:

- User.
- Role.
- Department.
- Project.
- Contract.
- Contract Renewal.
- Task.
- Milestone.
- Budget.
- Budget Transaction.
- Notification.
- Dashboard Summary.

These types must follow the shared API Contract.

---

## 15. Frontend Architecture

Recommended structure:

```text
projectflow-frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── shared/
│   │   ├── charts/
│   │   └── tables/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── departments/
│   │   ├── projects/
│   │   ├── contracts/
│   │   ├── tasks/
│   │   ├── milestones/
│   │   ├── budgets/
│   │   ├── notifications/
│   │   └── reports/
│   │
│   ├── hooks/
│   ├── stores/
│   ├── schemas/
│   ├── types/
│   ├── utils/
│   ├── styles/
│   └── main.tsx
│
├── .env.example
├── Dockerfile
├── package.json
├── vite.config.ts
└── README.md
```

Each feature should contain its own components, hooks, API functions, types, and schemas where appropriate.

---

## 16. UX Requirements

Every data-driven page must support:

- Loading state.
- Empty state.
- Error state.
- Success feedback.
- Form validation.
- Confirmation dialog.
- Pagination where appropriate.
- Responsive design.

Additional rules:

- Show confirmation before destructive operations.
- Disable submit buttons during API requests.
- Prevent duplicate form submissions.
- Show clear error messages.
- Preserve form data after recoverable errors.
- Use skeleton loaders for major data sections.
- Provide accessible labels and keyboard navigation.

---

## 17. Route Structure

Recommended route hierarchy:

```text
/login
/forgot-password

/dashboard

/projects
/projects/new
/projects/:id
/projects/:id/edit
/projects/:id/tasks
/projects/:id/milestones
/projects/:id/budget

/my-tasks
/tasks/:id

/milestones

/contracts
/contracts/new
/contracts/:id
/contracts/:id/edit
/contracts/expiring

/budgets
/budgets/transactions

/notifications

/reports/projects
/reports/contracts
/reports/budgets

/admin/users
/admin/departments

/settings
/403
/404
```

Routes must be protected according to user authentication and permissions.

---

## 18. Testing Requirements

### Unit Tests

- Utility functions.
- Form validation.
- Date formatting.
- Status display.
- Permission-based rendering.

### Component Tests

- Login form.
- Project form.
- Contract form.
- Budget transaction form.
- Notification component.
- Data tables.

### Integration Tests

- Authentication.
- Project CRUD.
- Contract CRUD.
- Task updates.
- Budget transactions.
- Notification actions.

### End-to-End Tests

Critical user journeys:

1. Login and access dashboard.
2. Create a project.
3. Register a contract.
4. View an expiring contract.
5. Create and update tasks.
6. Register a budget transaction.
7. View project financial summary.
8. Access reports.

---

## 19. Development Phases

| Phase | Scope |
|---|---|
| FE-01 | Vite, React, TypeScript setup |
| FE-02 | Design system and layout |
| FE-03 | Authentication and route protection |
| FE-04 | Dashboard |
| FE-05 | Project Management |
| FE-06 | Task and Milestone Management |
| FE-07 | Contract Management |
| FE-08 | Budget Management |
| FE-09 | Notifications |
| FE-10 | User and Department Management |
| FE-11 | Reporting |
| FE-12 | Testing and production build |

---

## 20. Acceptance Criteria

Frontend MVP is accepted when:

- All required pages are implemented.
- Authentication integrates with the backend.
- Protected routes work correctly.
- Navigation follows user permissions.
- Project CRUD works.
- Contract CRUD and expiration monitoring work.
- Task and milestone operations work.
- Budget information and transactions are displayed correctly.
- Dashboard data comes from backend APIs.
- Notifications can be viewed and marked as read.
- Reports can be filtered and exported.
- All data-driven pages have loading, empty, and error states.
- No production page depends on hardcoded mock data.
- The application builds successfully for production.
- Critical user journeys pass automated tests.

---

## 21. Out of Scope

The following are excluded from MVP:

- Advanced interactive Gantt chart.
- Task dependency visualization.
- Drag-and-drop scheduling.
- Multi-level approval workflows.
- Advanced risk management.
- Resource management.
- AI-powered analytics.
- Contract OCR.
- Advanced workflow automation.
- Enterprise SSO.

The frontend architecture should remain extensible for these future capabilities.

---

**End of Frontend PRD**