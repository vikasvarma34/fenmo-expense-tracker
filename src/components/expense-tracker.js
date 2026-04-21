"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  APP_CURRENCY_CODE,
  APP_CURRENCY_LOCALE,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/lib/expense-options";

const CUSTOM_CATEGORY_VALUE = "__custom__";
const PENDING_SUBMIT_STORAGE_KEY = "fenmo.pending-expense-submit";
const ITEMS_PER_PAGE = 10;

const INITIAL_FORM_STATE = {
  amount: "",
  category: DEFAULT_EXPENSE_CATEGORIES[0],
  customCategory: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
};

function formatCurrency(amountCents) {
  return new Intl.NumberFormat(APP_CURRENCY_LOCALE, {
    style: "currency",
    currency: APP_CURRENCY_CODE,
  }).format(amountCents / 100);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function formatEditableAmount(amountCents) {
  const amount = amountCents / 100;

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function EditIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m15 5 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M18.6 2.9a2 2 0 1 1 2.8 2.8L9.4 17.7 5 19l1.3-4.4L18.6 2.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function DeleteIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M10 11v5M14 11v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SpinnerIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function buildCategoryOptions(expenses) {
  const mergedCategories = new Set(DEFAULT_EXPENSE_CATEGORIES);
  const customCategories = new Set();

  for (const expense of expenses) {
    if (expense.category) {
      if (DEFAULT_EXPENSE_CATEGORIES.includes(expense.category)) {
        mergedCategories.add(expense.category);
      } else {
        customCategories.add(expense.category);
      }
    }
  }

  return [
    ...Array.from(mergedCategories),
    ...Array.from(customCategories).sort((left, right) =>
      left.localeCompare(right),
    ),
  ];
}

function mergeCategoryOptions(currentCategories, expenses) {
  return buildCategoryOptions([
    ...currentCategories.map((category) => ({ category })),
    ...expenses,
  ]);
}

function getSubmittedCategory(values) {
  return values.category === CUSTOM_CATEGORY_VALUE
    ? values.customCategory.trim()
    : values.category;
}

function buildFormValuesFromExpense(expense) {
  const isCustomCategory = !DEFAULT_EXPENSE_CATEGORIES.includes(expense.category);

  return {
    amount: formatEditableAmount(expense.amount_cents),
    category: isCustomCategory ? CUSTOM_CATEGORY_VALUE : expense.category,
    customCategory: isCustomCategory ? expense.category : "",
    description: expense.description || "",
    date: expense.expense_date,
  };
}

function validateExpenseForm(values) {
  const errors = {};
  const rawAmount = values.amount.trim();
  const amountValue = Number(rawAmount);
  const submittedCategory = getSubmittedCategory(values);
  const today = new Date().toISOString().slice(0, 10);

  if (!rawAmount) {
    errors.amount = "Please enter an amount.";
  } else if (!Number.isFinite(amountValue)) {
    errors.amount = "Please enter a valid amount (for example, 24.99).";
  } else if (amountValue <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  if (!submittedCategory) {
    errors.category = "Please choose a category.";
  }

  if (values.category === CUSTOM_CATEGORY_VALUE && !values.customCategory.trim()) {
    errors.customCategory = "Please enter a custom category.";
  }

  if (!values.date) {
    errors.date = "Please select a date.";
  } else if (values.date > today) {
    errors.date = "Date cannot be in the future.";
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

function readPendingSubmit() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(PENDING_SUBMIT_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    window.localStorage.removeItem(PENDING_SUBMIT_STORAGE_KEY);
    return null;
  }
}

function writePendingSubmit(pendingSubmit) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PENDING_SUBMIT_STORAGE_KEY,
    JSON.stringify(pendingSubmit),
  );
}

function clearPendingSubmitStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_SUBMIT_STORAGE_KEY);
}

function isNetworkLikeErrorMessage(message) {
  const normalizedMessage = message.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  return (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("internet connection") ||
    normalizedMessage.includes("offline")
  );
}

export default function ExpenseTracker() {
  const today = new Date().toISOString().slice(0, 10);
  const [formValues, setFormValues] = useState(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingNotice, setPendingNotice] = useState("");
  const [listActionError, setListActionError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalExpensesCents, setTotalExpensesCents] = useState(0);
  const hasRestoredPendingSubmitRef = useRef(false);
  const editFormSectionRef = useRef(null);
  const amountInputRef = useRef(null);

  function getFriendlyLoadError(error) {
    if (error instanceof Error) {
      if (isNetworkLikeErrorMessage(error.message)) {
        return "Could not load expenses. Check your connection and try again.";
      }

      if (error.message) {
        return error.message;
      }
    }

    return "Could not load expenses right now. Please try again.";
  }

  function getFriendlySubmitError(error) {
    if (error instanceof Error) {
      if (isNetworkLikeErrorMessage(error.message)) {
        return "Could not save your expense due to a network issue. Check your connection and try again.";
      }

      if (error.message) {
        return "Something went wrong while saving your expense. Please try again.";
      }
    }

    return "Something went wrong while saving your expense. Please try again.";
  }

  function getFriendlyRowActionError(error, action) {
    if (error instanceof Error) {
      if (isNetworkLikeErrorMessage(error.message)) {
        return `Could not ${action} the expense. Check your connection and try again.`;
      }

      if (error.message) {
        return error.message;
      }
    }

    return `Could not ${action} the expense right now. Please try again.`;
  }

  useEffect(() => {
    if (hasRestoredPendingSubmitRef.current) {
      return;
    }

    hasRestoredPendingSubmitRef.current = true;

    const restoredPendingSubmit = readPendingSubmit();

    if (!restoredPendingSubmit) {
      return;
    }

    startTransition(() => {
      setPendingSubmit(restoredPendingSubmit);
      setFormValues(restoredPendingSubmit.formValues);
      setPendingNotice(
        "A previous expense submission is pending. Save again to retry safely.",
      );
    });
  }, []);

  useEffect(() => {
    async function loadExpenses() {
      setIsLoadingExpenses(true);
      setLoadError("");
      setListActionError("");

      try {
        const response = await fetch(buildExpensesUrl(selectedCategory, sortOrder));
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load expenses.");
        }

        const nextExpenses = payload.expenses ?? [];
        setExpenses(nextExpenses);
        setTotalExpensesCents(payload.totalExpensesCents ?? 0);
        setCategoryOptions((currentCategories) =>
          selectedCategory
            ? mergeCategoryOptions(currentCategories, nextExpenses)
            : buildCategoryOptions(nextExpenses),
        );
      } catch (error) {
        setLoadError(getFriendlyLoadError(error));
      } finally {
        setIsLoadingExpenses(false);
        setHasLoadedOnce(true);
      }
    }

    void loadExpenses();
  }, [reloadToken, selectedCategory, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(expenses.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const currentPageExpenses = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return expenses.slice(start, start + ITEMS_PER_PAGE);
  }, [expenses, safeCurrentPage]);

  const isInitialExpensesLoad = !hasLoadedOnce && isLoadingExpenses;

  function updateFormValue(event) {
    const { name, value } = event.target;

    if (pendingSubmit) {
      setPendingSubmit(null);
      clearPendingSubmitStorage();
    }

    setPendingNotice("");
    setListActionError("");
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
      ...(name === "category" && value !== CUSTOM_CATEGORY_VALUE
        ? { customCategory: "" }
        : {}),
    }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[name]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[name];

      if (name === "category" && value !== CUSTOM_CATEGORY_VALUE) {
        delete nextErrors.customCategory;
      }

      return nextErrors;
    });
    if (name === "amount") {
      setFieldErrors((currentErrors) => {
        if (!currentErrors.amount) {
          return currentErrors;
        }

        const nextErrors = { ...currentErrors };
        delete nextErrors.amount;
        return nextErrors;
      });
    }
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
    setPendingNotice("");
    setListActionError("");

    const requestPayload = {
      amount: formValues.amount,
      category: getSubmittedCategory(formValues),
      description: formValues.description,
      date: formValues.date,
    };

    if (editingExpenseId) {
      try {
        const response = await fetch(`/api/expenses/${editingExpenseId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
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

          throw new Error(
            payload.error || "Could not update the expense right now. Please try again.",
          );
        }

        setEditingExpenseId(null);
        setFormValues(INITIAL_FORM_STATE);
        setFieldErrors({});
        setSuccessMessage("Expense updated.");
        setReloadToken((currentValue) => currentValue + 1);
      } catch (error) {
        setSubmitError(getFriendlySubmitError(error));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const nextPendingSubmit = pendingSubmit || {
      idempotencyKey: crypto.randomUUID(),
      formValues: {
        ...formValues,
        category: formValues.category,
        customCategory: formValues.customCategory,
      },
      requestPayload,
    };

    setPendingSubmit(nextPendingSubmit);
    writePendingSubmit(nextPendingSubmit);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...nextPendingSubmit.requestPayload,
          idempotencyKey: nextPendingSubmit.idempotencyKey,
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

        if (response.status >= 400 && response.status < 500) {
          setPendingSubmit(null);
          clearPendingSubmitStorage();
        }

        throw new Error(payload.error || "Failed to save expense.");
      }

      setPendingSubmit(null);
      clearPendingSubmitStorage();
      setFormValues(INITIAL_FORM_STATE);
      setFieldErrors({});
      setSuccessMessage("Expense saved.");
      setReloadToken((currentValue) => currentValue + 1);
    } catch (error) {
      setSubmitError(getFriendlySubmitError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearEditingState() {
    setEditingExpenseId(null);
    setFieldErrors({});
    setSubmitError("");
    setSuccessMessage("");
    setPendingNotice("");
    setFormValues(INITIAL_FORM_STATE);
  }

  function handleEditExpense(expense) {
    setPendingSubmit(null);
    clearPendingSubmitStorage();
    setPendingNotice("");
    setSubmitError("");
    setSuccessMessage("");
    setListActionError("");
    setFieldErrors({});
    setEditingExpenseId(expense.id);
    setFormValues(buildFormValuesFromExpense(expense));
    editFormSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => {
      amountInputRef.current?.focus({ preventScroll: true });
    }, 250);
  }

  async function handleDeleteExpense(expense) {
    const confirmed = window.confirm(
      `Delete this expense for ${formatCurrency(expense.amount_cents)}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingExpenseId(expense.id);
    setListActionError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Could not delete the expense right now. Please try again.",
        );
      }

      if (editingExpenseId === expense.id) {
        clearEditingState();
      }

      if (selectedCategory === expense.category) {
        setSelectedCategory("");
      }

      setReloadToken((currentValue) => currentValue + 1);
    } catch (error) {
      setListActionError(getFriendlyRowActionError(error, "delete"));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function handleChangeSelectedCategory(value) {
    setSelectedCategory(value);
    setCurrentPage(1);
  }

  function handleChangeSortOrder(value) {
    setSortOrder(value);
    setCurrentPage(1);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm shadow-slate-200/70 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-500">Fenmo</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Expenses
              </h1>
              <p className="text-sm text-slate-600">
                Track spending and review recent entries.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                Total expenses
              </p>
              <div className="mt-2 text-2xl font-semibold">
                {isInitialExpensesLoad ? (
                  <span className="block h-8 w-28 animate-pulse rounded-md bg-white/15" />
                ) : (
                  formatCurrency(totalExpensesCents)
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
          <section
            ref={editFormSectionRef}
            className="self-start rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70"
          >
            <div className="mb-6 space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">
                {editingExpenseId ? "Edit expense" : "Add expense"}
              </h2>
              <p className="text-sm text-slate-600">
                {editingExpenseId
                  ? "Update the details and save your changes."
                  : "Enter the amount, category, and date."}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Amount
                </span>
                <input
                  ref={amountInputRef}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  value={formValues.amount}
                  onChange={updateFormValue}
                  placeholder="1000"
                />
                {fieldErrors.amount ? (
                  <p className="text-sm text-rose-600">{fieldErrors.amount}</p>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Category
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  name="category"
                  value={formValues.category}
                  onChange={updateFormValue}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value={CUSTOM_CATEGORY_VALUE}>Custom category</option>
                </select>
                {fieldErrors.category ? (
                  <p className="text-sm text-rose-600">{fieldErrors.category}</p>
                ) : null}
              </label>

              {formValues.category === CUSTOM_CATEGORY_VALUE ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Custom category
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                    name="customCategory"
                    type="text"
                    value={formValues.customCategory}
                    onChange={updateFormValue}
                    placeholder="Pet care"
                  />
                  {fieldErrors.customCategory ? (
                    <p className="text-sm text-rose-600">
                      {fieldErrors.customCategory}
                    </p>
                  ) : null}
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Description (optional)
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  name="description"
                  value={formValues.description}
                  onChange={updateFormValue}
                  placeholder="Lunch, rent, cab fare"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Date</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  name="date"
                  type="date"
                  value={formValues.date}
                  max={today}
                  onChange={updateFormValue}
                />
                {fieldErrors.date ? (
                  <p className="text-sm text-rose-600">{fieldErrors.date}</p>
                ) : null}
              </label>

              {pendingNotice ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {pendingNotice}
                </p>
              ) : null}
              {submitError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <button
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? editingExpenseId
                    ? "Saving changes..."
                    : "Saving expense..."
                  : editingExpenseId
                    ? "Update expense"
                    : "Save expense"}
              </button>
              {editingExpenseId ? (
                <button
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  type="button"
                  onClick={clearEditingState}
                  disabled={isSubmitting}
                >
                  Cancel editing
                </button>
              ) : null}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-950">
                  Recent expenses
                </h2>
                <p className="text-sm text-slate-600">
                  Filter and sort the current list.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Category
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                    value={selectedCategory}
                    onChange={(event) =>
                      handleChangeSelectedCategory(event.target.value)
                    }
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map((category) => (
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                    value={sortOrder}
                    onChange={(event) => handleChangeSortOrder(event.target.value)}
                  >
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="amount_desc">Amount - High to Low</option>
                    <option value="amount_asc">Amount - Low to High</option>
                  </select>
                </label>
              </div>
            </div>

            {loadError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p>{loadError}</p>
                <button
                  className="mt-2 text-sm font-medium text-rose-800 underline decoration-rose-300 underline-offset-2"
                  onClick={() => setReloadToken((currentValue) => currentValue + 1)}
                  type="button"
                >
                  Retry loading expenses
                </button>
              </div>
            ) : null}
            {listActionError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {listActionError}
              </div>
            ) : null}

            <div className="mt-5 sm:hidden">
              {isLoadingExpenses ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`mobile-loading-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                      <div className="mt-3 h-4 w-20 animate-pulse rounded bg-slate-100" />
                      <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : expenses.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-700">
                      No expenses to show.
                    </p>
                    <p className="text-sm text-slate-500">
                      Try a different filter or add a new expense.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentPageExpenses.map((expense) => {
                    const isDeletingRow = deletingExpenseId === expense.id;
                    const isEditingRow = editingExpenseId === expense.id;

                    return (
                      <article
                        key={expense.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {expense.category}
                            </span>
                            <p className="text-sm text-slate-500">
                              {formatDate(expense.expense_date)}
                            </p>
                          </div>
                          <p className="text-base font-semibold text-slate-950">
                            {formatCurrency(expense.amount_cents)}
                          </p>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {expense.description || "—"}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                              isEditingRow
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                            type="button"
                            onClick={() => handleEditExpense(expense)}
                            disabled={isDeletingRow || isSubmitting}
                            aria-label={
                              isEditingRow ? "Editing this expense" : "Edit expense"
                            }
                            title={isEditingRow ? "Editing" : "Edit"}
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => handleDeleteExpense(expense)}
                            disabled={isDeletingRow || isSubmitting}
                            aria-label={isDeletingRow ? "Deleting expense" : "Delete expense"}
                            title={isDeletingRow ? "Deleting..." : "Delete"}
                          >
                            {isDeletingRow ? <SpinnerIcon /> : <DeleteIcon />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50/80 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
                        Date
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
                        Category
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em]">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {isLoadingExpenses ? (
                      isInitialExpensesLoad ? (
                        Array.from({ length: 4 }).map((_, index) => (
                          <tr key={`loading-row-${index}`}>
                            <td className="px-5 py-4">
                              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-5 py-4">
                              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-5 py-4">
                              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                            </td>
                          <td className="px-5 py-4">
                              <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-5 py-4">
                              <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-5 py-8 text-center text-slate-500"
                            colSpan={5}
                          >
                            Refreshing expenses...
                          </td>
                        </tr>
                      )
                    ) : loadError && expenses.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-10 text-center text-slate-500"
                          colSpan={5}
                        >
                          Unable to load expenses right now.
                        </td>
                      </tr>
                    ) : expenses.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-12 text-center"
                          colSpan={5}
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-slate-700">
                              No expenses to show.
                            </p>
                            <p className="text-sm text-slate-500">
                              Try a different filter or add a new expense.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentPageExpenses.map((expense) => (
                        <tr
                          key={expense.id}
                          className="align-top transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 text-slate-600">
                            {formatDate(expense.expense_date)}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {expense.description || "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(expense.amount_cents)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                                  editingExpenseId === expense.id
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 hover:bg-slate-50"
                                }`}
                                type="button"
                                onClick={() => handleEditExpense(expense)}
                                disabled={
                                  deletingExpenseId === expense.id || isSubmitting
                                }
                                aria-label={
                                  editingExpenseId === expense.id
                                    ? "Editing this expense"
                                    : "Edit expense"
                                }
                                title={
                                  editingExpenseId === expense.id ? "Editing" : "Edit"
                                }
                              >
                                <EditIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                type="button"
                                onClick={() => handleDeleteExpense(expense)}
                                disabled={
                                  deletingExpenseId === expense.id || isSubmitting
                                }
                                aria-label={
                                  deletingExpenseId === expense.id
                                    ? "Deleting expense"
                                    : "Delete expense"
                                }
                                title={
                                  deletingExpenseId === expense.id
                                    ? "Deleting..."
                                    : "Delete"
                                }
                              >
                                {deletingExpenseId === expense.id ? (
                                  <SpinnerIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <DeleteIcon className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!isLoadingExpenses && expenses.length > ITEMS_PER_PAGE ? (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row">
                <p>
                  Page {safeCurrentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, Math.min(page, totalPages) - 1),
                      )
                    }
                    disabled={safeCurrentPage === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, Math.min(page, totalPages) + 1),
                      )
                    }
                    disabled={safeCurrentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
