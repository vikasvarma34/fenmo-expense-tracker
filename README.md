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
- Multi-currency expense capture
- Currency-aware totals grouped by visible currency
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

3. Run the initial expenses table SQL in Supabase, then run `db/2026-04-21-add-currency-code.sql`.

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
- `currency_code`
- `category`
- `description`
- `expense_date`
- `created_at`

Money is stored as integer cents in the original transaction currency to avoid floating point issues.

## API Notes

### `POST /api/expenses`

Expected payload:

```json
{
  "amount": "24.99",
  "currencyCode": "USD",
  "category": "Dining",
  "description": "Team lunch",
  "date": "2026-04-21",
  "idempotencyKey": "uuid"
}
```

Behavior:

- Validates required fields
- Converts `amount` to integer cents before insert
- Stores the original `currency_code`
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
- `src/lib/expense-options.js`: supported currencies and category defaults
- `src/lib/supabase/server.js`: server-only Supabase client
- `db/2026-04-21-add-currency-code.sql`: schema update for multi-currency support

## Decisions and Tradeoffs

- Kept the app as a single-page workflow to stay focused on the required assessment scope.
- Used Route Handlers instead of a separate backend service because the repo plan calls for a single-repo Next.js app.
- Used the Supabase service role key only on the server and never in client code.
- Used built-in expense categories inspired by common budgeting app patterns while still allowing custom categories.
- Totals are grouped by currency instead of silently converting currencies, which avoids misleading math without introducing exchange-rate dependencies.

## Verification

Verified locally with:

```bash
npm run lint
npm run build
```
