# Fenmo Expense Tracker

A minimal full-stack expense tracker built for a timed SDE assessment using Next.js App Router and Supabase Postgres.

## Overview

This project helps a user record and review personal expenses with a simple, correctness-focused workflow.

It supports:
- creating expenses
- viewing saved expenses
- filtering by category
- sorting expenses
- seeing the total for the current visible list

The app was built with production-like behavior in mind, especially around retries, page refreshes, and duplicate submissions.

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Supabase Postgres
- Zod

## Core Features

- Create expenses through `POST /api/expenses`
- List expenses through `GET /api/expenses`
- Update expenses through `PATCH /api/expenses/[id]`
- Delete expenses through `DELETE /api/expenses/[id]`
- Persistent storage in Supabase
- Filter expenses by category
- Sort expenses by date and amount
- Show total for the currently visible filtered list
- Basic validation, loading states, and error states
- Mobile-friendly responsive layout

## Reliability and Data Handling

- Idempotent expense creation using a database-backed `idempotency_key`
- Refresh-safe retry flow by persisting pending create attempts in `localStorage`
- Amounts stored as integer cents to avoid floating-point money issues
- Server-side validation for required fields and invalid values

## Additional UX Choices

- Predefined categories with support for custom categories
- Reuse saved categories in form and filter controls
- Single fixed currency workflow in INR
- Inline edit flow with form reuse
- Row-level delete action with confirmation
- Pagination with 10 expenses per page

## Local Setup

1. Install dependencies:

npm install

2. Add environment variables in `.env.local`:

SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

3. Use a Supabase project that already has the `expenses` table available.

4. Start the development server:

npm run dev

5. Open `http://localhost:3000`

## API Notes

### `POST /api/expenses`

Expected payload:

{
  "amount": "24.99",
  "category": "Dining",
  "description": "Team lunch",
  "date": "2026-04-21",
  "idempotencyKey": "uuid"
}

Behavior:

* validates required fields
* converts amount to integer cents before insert
* creates a new row when the idempotency key is new
* returns the existing row when the same idempotency key is retried

### `GET /api/expenses`

Supported query params:

* `category`
* `sort=date_desc | date_asc | amount_desc | amount_asc`

Response includes:

* `expenses`: filtered and sorted list
* `totalExpensesCents`: total for the same visible list

### `PATCH /api/expenses/[id]`

Updates an existing expense using the same validation rules as create.

### `DELETE /api/expenses/[id]`

Deletes a single expense by id.

## Project Structure

* `src/app/page.js` — main page entry
* `src/app/api/expenses/route.js` — create and list expense APIs
* `src/app/api/expenses/[id]/route.js` — update and delete expense APIs
* `src/components/expense-tracker.js` — main single-page UI
* `src/lib/expense-api.js` — shared validation and amount helpers
* `src/lib/expense-options.js` — category and currency defaults
* `src/lib/supabase/server.js` — server-only Supabase client

## Key Design Decisions

* Kept the app in a single Next.js codebase to reduce complexity and keep the frontend and backend easy to maintain.
* Used Route Handlers instead of a separate backend service to stay within the timebox while preserving a clean full-stack structure.
* Used Supabase for durable persistence instead of an in-memory or local-only store.
* Stored money as integer cents to avoid floating-point issues.
* Used a database-backed `idempotency_key` plus client-side pending-submit persistence to handle retries and refreshes safely.
* Kept the currency fixed to INR to avoid unnecessary schema and UX complexity for this submission.
* Kept edit and delete flows lightweight by reusing the existing page and form instead of introducing extra pages or modal-heavy flows.

## Trade-offs Due to the Timebox

* Focused on correctness, clarity, and safe request handling over broader feature expansion.
* Added a few focused automated tests instead of broader end-to-end coverage.
* Kept the UI simple and clean rather than building advanced analytics or dashboard-style views.
* Used a practical responsive layout without heavily optimizing every mobile table interaction.

## Intentionally Not Done

* Authentication, because it was not required for this assessment.
* Advanced analytics and charts, to keep the scope focused on correctness and clarity.
* More advanced category management, such as rename, merge, or category administration flows.
* Broader automated test coverage across all flows, due to the timebox.

## Verification

Verified locally with:

npm run lint
npm test
npm run build

