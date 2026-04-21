"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const INITIAL_FORM_STATE = {
  amount: "",
  category: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
};

function formatCurrency(amountCents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function validateExpenseForm(values) {
  const errors = {};
  const amountValue = Number(values.amount);

  if (!values.amount || !Number.isFinite(amountValue) || amountValue <= 0) {
    errors.amount = "Enter a valid amount greater than zero.";
  }

  if (!values.category.trim()) {
    errors.category = "Category is required.";
  }

  if (!values.description.trim()) {
    errors.description = "Description is required.";
  }

  if (!values.date) {
    errors.date = "Date is required.";
  }

  return errors;
}

function buildExpensesUrl(category, sort) {
  const searchParams = new URLSearchParams();

  if (category) {
    searchParams.set("category", category);
  }

  if (sort) {
    searchParams.set("sort", sort);
  }

  const queryString = searchParams.toString();

  return queryString ? `/api/expenses?${queryString}` : "/api/expenses";
}

export default function ExpenseTracker() {
  const [formValues, setFormValues] = useState(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [knownCategories, setKnownCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const pendingIdempotencyKeyRef = useRef(null);

  useEffect(() => {
    async function loadExpenses() {
      setIsLoadingExpenses(true);
      setLoadError("");

      try {
        const response = await fetch(buildExpensesUrl(selectedCategory, sortOrder));
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load expenses.");
        }

        const nextExpenses = payload.expenses ?? [];
        setExpenses(nextExpenses);
        setKnownCategories((currentCategories) => {
          const mergedCategories = new Set(currentCategories);

          for (const expense of nextExpenses) {
            mergedCategories.add(expense.category);
          }

          return Array.from(mergedCategories).sort((left, right) =>
            left.localeCompare(right),
          );
        });
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load expenses.",
        );
      } finally {
        setIsLoadingExpenses(false);
      }
    }

    void loadExpenses();
  }, [reloadToken, selectedCategory, sortOrder]);

  const visibleTotalCents = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);
  }, [expenses]);

  function updateFormValue(event) {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[name]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[name];
      return nextErrors;
    });
    setSubmitError("");
    setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextFieldErrors = validateExpenseForm(formValues);

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSuccessMessage("");

    const idempotencyKey =
      pendingIdempotencyKeyRef.current || crypto.randomUUID();
    pendingIdempotencyKeyRef.current = idempotencyKey;

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formValues,
          idempotencyKey,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        if (payload.details) {
          setFieldErrors((currentErrors) => ({
            ...currentErrors,
            ...Object.fromEntries(
              Object.entries(payload.details).map(([key, messages]) => [
                key,
                messages?.[0],
              ]),
            ),
          }));
        }

        throw new Error(payload.error || "Failed to save expense.");
      }

      pendingIdempotencyKeyRef.current = null;
      setFormValues(INITIAL_FORM_STATE);
      setFieldErrors({});
      setSuccessMessage("Expense saved.");
      setReloadToken((currentValue) => currentValue + 1);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save expense.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-3xl bg-slate-900 px-6 py-8 text-white shadow-lg sm:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-300">
            Fenmo Expense Tracker
          </p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Track expenses with a clean, retry-safe workflow.
              </h1>
              <p className="text-sm leading-6 text-slate-300 sm:text-base">
                Add an expense, review recent activity, and filter the current
                list without leaving the page.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-sm text-slate-300">Visible total</p>
              <p className="mt-1 text-3xl font-semibold">
                {formatCurrency(visibleTotalCents)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Add expense
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Amounts are stored safely in cents on the server.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Amount
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formValues.amount}
                  onChange={updateFormValue}
                  placeholder="24.99"
                />
                {fieldErrors.amount ? (
                  <p className="text-sm text-rose-600">{fieldErrors.amount}</p>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Category
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  name="category"
                  type="text"
                  value={formValues.category}
                  onChange={updateFormValue}
                  placeholder="Food"
                />
                {fieldErrors.category ? (
                  <p className="text-sm text-rose-600">{fieldErrors.category}</p>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Description
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  name="description"
                  value={formValues.description}
                  onChange={updateFormValue}
                  placeholder="Team lunch"
                />
                {fieldErrors.description ? (
                  <p className="text-sm text-rose-600">
                    {fieldErrors.description}
                  </p>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Date</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  name="date"
                  type="date"
                  value={formValues.date}
                  onChange={updateFormValue}
                />
                {fieldErrors.date ? (
                  <p className="text-sm text-rose-600">{fieldErrors.date}</p>
                ) : null}
              </label>

              {submitError ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <button
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save expense"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Recent expenses
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sorted newest first by expense date.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Category
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                  >
                    <option value="">All categories</option>
                    {knownCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Sort
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                  >
                    <option value="date_desc">Newest first</option>
                  </select>
                </label>
              </div>
            </div>

            {loadError ? (
              <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loadError}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {isLoadingExpenses ? (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-slate-500"
                          colSpan={4}
                        >
                          Loading expenses...
                        </td>
                      </tr>
                    ) : expenses.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-slate-500"
                          colSpan={4}
                        >
                          No expenses found for the current filter.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((expense) => (
                        <tr key={expense.id} className="align-top">
                          <td className="px-4 py-4 text-slate-700">
                            {formatDate(expense.expense_date)}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {expense.category}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {expense.description}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-slate-900">
                            {formatCurrency(expense.amount_cents)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
