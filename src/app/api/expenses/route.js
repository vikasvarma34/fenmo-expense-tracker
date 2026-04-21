import {
  applyCategoryFilterToExpensesQuery,
  applySortToExpensesQuery,
  amountToCents,
  buildExpenseMutation,
  createExpenseWithIdempotency,
  createExpenseSchema,
  json,
  listExpensesQuerySchema,
} from "@/lib/expense-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);
  const query = {
    category: url.searchParams.get("category") || undefined,
    sort: url.searchParams.get("sort") || undefined,
  };
  const parsedQuery = listExpensesQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return json(
      {
        error: "Please choose a valid filter or sort option.",
        details: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  let expensesQuery = supabase.from("expenses").select("*");
  expensesQuery = applyCategoryFilterToExpensesQuery(
    expensesQuery,
    parsedQuery.data.category,
  );
  expensesQuery = applySortToExpensesQuery(expensesQuery, parsedQuery.data.sort);

  const { data: expenses, error } = await expensesQuery;

  if (error) {
    return json(
      { error: "Could not load expenses right now. Please try again." },
      { status: 500 },
    );
  }

  const totalExpensesCents = (expenses ?? []).reduce(
    (sum, expense) => sum + (expense.amount_cents ?? 0),
    0,
  );

  return json({ expenses: expenses ?? [], totalExpensesCents });
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body is invalid." }, { status: 400 });
  }

  const parsedPayload = createExpenseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return json(
      {
        error: "Please review the form fields and try again.",
        details: parsedPayload.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const amountCents = amountToCents(parsedPayload.data.amount);

  if (!amountCents || amountCents <= 0) {
    return json(
      {
        error: "Please enter a valid amount greater than zero.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const expenseToInsert = {
    ...buildExpenseMutation(parsedPayload.data),
    idempotency_key: parsedPayload.data.idempotencyKey,
  };
  const result = await createExpenseWithIdempotency(
    supabase,
    expenseToInsert,
    parsedPayload.data.idempotencyKey,
  );

  if (result.error) {
    return json({ error: result.error }, { status: result.status });
  }

  return json({ expense: result.expense }, { status: result.status });
}
