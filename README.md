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
- Persistent storage in Supabase
- Predefined categories with support for custom categories
- Reuse saved categories in the form and filter controls
- Single fixed currency workflow in INR
- Date descending sort
- Basic validation, loading states, and error states
- Idempotent expense creation using a database-backed `idempotency_key`

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

3. Run the initial expenses table SQL in Supabase.

4. Run the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Database

The app expects an `expenses` table with these fields:

- `id`
- `idempotency_key`
- `amount_cents`
- `category`
- `description`
- `expense_date`
- `created_at`

Money is stored as integer cents in INR to avoid floating point issues.

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

### `GET /api/expenses`

Supported query params:

- `category`
- `sort=date_desc`

## Project Structure

- `src/app/page.js`: main page entry
- `src/app/api/expenses/route.js`: expense API route handler
- `src/app/icon.svg`: app icon used instead of the starter favicon
- `src/components/expense-tracker.js`: single-page UI
- `src/lib/expense-options.js`: app currency and category defaults
- `src/lib/supabase/server.js`: server-only Supabase client

## Decisions and Tradeoffs

- Kept the app as a single-page workflow to stay focused on the required assessment scope.
- Used Route Handlers instead of a separate backend service because the repo plan calls for a single-repo Next.js app.
- Used the Supabase service role key only on the server and never in client code.
- Used built-in expense categories inspired by common budgeting app patterns while still allowing custom categories.
- Kept the currency fixed to INR to avoid unnecessary schema and UX complexity for this submission.

## Verification

Verified locally with:

```bash
npm run lint
npm run build
```
