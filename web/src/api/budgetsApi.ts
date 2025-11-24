import type { BudgetSummary, CreateBudgetInput, UpdateBudgetInput } from '../types/budgets';

export async function fetchBudgets(params?: { month?: string; period?: string }): Promise<BudgetSummary[]> {
  const queryParams = new URLSearchParams();
  if (params?.month) queryParams.set('month', params.month);
  if (params?.period) queryParams.set('period', params.period);
  
  const url = `/api/budgets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Budgets');
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchBudgetById(id: string): Promise<BudgetSummary> {
  const res = await fetch(`/api/budgets/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error('Fehler beim Laden des Budgets');
  }
  const json = await res.json();
  return json.data;
}

export async function createBudget(input: CreateBudgetInput): Promise<BudgetSummary> {
  const res = await fetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Fehler beim Erstellen des Budgets' }));
    throw new Error(error.error || 'Fehler beim Erstellen des Budgets');
  }
  const json = await res.json();
  return json.data;
}

export async function updateBudget(id: string, input: UpdateBudgetInput): Promise<BudgetSummary> {
  const res = await fetch(`/api/budgets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Fehler beim Aktualisieren des Budgets' }));
    throw new Error(error.error || 'Fehler beim Aktualisieren des Budgets');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await fetch(`/api/budgets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Fehler beim Löschen des Budgets');
  }
}

