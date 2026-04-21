# Fenmo Expense Tracker

A single-page expense tracker built for a timed SDE assessment using Next.js App Router and Supabase Postgres.

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Supabase Postgres
- Zod

## Features

- Create expenses through `POST /api/expenses`
- List expenses through `GET /api/expenses`
- Update expenses through `PATCH /api/expenses/[id]`
- Delete expenses through `DELETE /api/expenses/[id]`
- Persistent storage in Supabase
- Predefined categories with support for custom categories
- Reuse saved categories in the form and filter controls
- Single fixed currency workflow in INR
- Inline edit flow with form reuse
- Row-level delete action with confirmation
- Pagination (10 expenses per page)
- Filter-aware total expenses summary
- Sort by newest, oldest, amount high-to-low, and amount low-to-high
- Basic validation, loading states, and error states
- Idempotent expense creation using a database-backed `idempotency_key`
- Refresh-safe retry flow by persisting pending create attempts in `localStorage`
- Mobile-friendly stacked layout with responsive expense cards

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add local environment variables in `.env.local`:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Use a Supabase project that already has the `expenses` table available.

4. Run the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## API Notes

### `POST /api/expenses`

Expected payload:

```json
{
  "amount": "24.99",
  "category": "Dining",
  "description": "Team lunch",
  "date": "2026-04-21",
  "idempotencyKey": "uuid"
}
```

Behavior:

- Validates required fields
- Converts `amount` to integer cents before insert
- Inserts a new row when the idempotency key is new
- Returns the existing row when the same idempotency key is retried
- Supports safe retried submissions with the same idempotency key

### `GET /api/expenses`

Supported query params:

- `category`
- `sort=date_desc | date_asc | amount_desc | amount_asc`

Response includes:

- `expenses`: filtered/sorted list
- `totalExpensesCents`: total for the same filtered list

### `PATCH /api/expenses/[id]`

Updates an existing expense using the same validation rules as create.

### `DELETE /api/expenses/[id]`

Deletes a single expense by id.

## Project Structure

- `src/app/page.js`: main page entry
- `src/app/api/expenses/route.js`: expense API route handler
- `src/app/api/expenses/[id]/route.js`: edit and delete expense route handler
- `src/app/icon.svg`: app icon used instead of the starter favicon
- `src/components/expense-tracker.js`: single-page UI
- `src/lib/expense-api.js`: shared API validation and amount helpers
- `src/lib/expense-options.js`: app currency and category defaults
- `src/lib/supabase/server.js`: server-only Supabase client

## Decisions and Tradeoffs

- Kept the app as a single-page workflow to stay focused on the required assessment scope.
- Used Route Handlers instead of a separate backend service because the repo plan calls for a single-repo Next.js app.
- Used the Supabase service role key only on the server and never in client code.
- Used built-in expense categories inspired by common budgeting app patterns while still allowing custom categories.
- Kept the currency fixed to INR to avoid unnecessary schema and UX complexity for this submission.
- Kept edit and delete flows lightweight by reusing the existing form and adding small row actions instead of introducing modals or extra pages.
- Added a few focused automated tests for idempotency and GET query behavior, while keeping broader test coverage out of scope due to the timebox.

## Intentionally Not Done

- Authentication, because it was not required for this assessment.
- Advanced analytics and charts, to keep the scope focused on correctness and clarity.
- More advanced category management (for example rename/merge rules), beyond simple predefined + custom category support.
- Broad automated test coverage across all flows, due to timebox constraints.

## Verification

Verified locally with:

```bash
npm run lint
npm test
npm run build
```
