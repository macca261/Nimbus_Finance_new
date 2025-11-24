export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'CASH' | 'OTHER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary: boolean;
  isArchived: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  iban?: string | null;
  accountNumber?: string | null;
  isPrimary?: boolean;
}

/**
 * List all accounts (excluding archived by default).
 */
export async function fetchAccounts(options?: { includeArchived?: boolean }): Promise<Account[]> {
  const params = new URLSearchParams();
  if (options?.includeArchived) {
    params.set('includeArchived', 'true');
  }
  
  const res = await fetch(`/api/accounts?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Konten');
  }
  const data = await res.json();
  return data.data ?? [];
}

/**
 * Get a single account by ID.
 */
export async function fetchAccountById(accountId: string): Promise<Account> {
  const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Konto nicht gefunden');
    }
    throw new Error('Fehler beim Laden des Kontos');
  }
  const data = await res.json();
  return data.account;
}

/**
 * Create a new account.
 */
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    throw new Error(error.error || 'Fehler beim Erstellen des Kontos');
  }
  
  const data = await res.json();
  return data.account;
}

/**
 * Update an existing account.
 */
export async function updateAccount(accountId: string, input: UpdateAccountInput): Promise<Account> {
  const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    if (res.status === 404) {
      throw new Error('Konto nicht gefunden');
    }
    throw new Error(error.error || 'Fehler beim Aktualisieren des Kontos');
  }
  
  const data = await res.json();
  return data.account;
}

/**
 * Delete (archive) an account.
 */
export async function deleteAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    if (res.status === 404) {
      throw new Error('Konto nicht gefunden');
    }
    throw new Error(error.error || 'Fehler beim Löschen des Kontos');
  }
}

