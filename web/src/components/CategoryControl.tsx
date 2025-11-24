import { useEffect, useMemo, useState } from 'react';
import { getCategoryMeta, CATEGORY_OPTIONS } from '../lib/categories';

type FingerprintInput = {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  counterpartName?: string | null;
  accountIban?: string | null;
};

type Props = {
  id?: string;
  fingerprintInput?: FingerprintInput;
  category?: string | null;
  categorySource?: string | null;
  rawText?: string | null;
  merchant?: string | null;
  onApplied?: (resolvedId: string, next: string | null) => void;
};

function formatFingerprintPayload(input: FingerprintInput): string {
  const norm = (value?: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const account = (input.accountIban ?? '').replace(/\s+/g, '').toUpperCase();
  return [
    input.bookingDate ?? '',
    input.valueDate ?? '',
    String(input.amountCents ?? 0),
    (input.currency ?? 'EUR').toUpperCase(),
    norm(input.purpose),
    norm(input.counterpartName),
    account,
  ].join('|');
}

async function computeFingerprintHex(input: FingerprintInput): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(formatFingerprintPayload(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export default function CategoryControl(props: Props) {
  const { id, fingerprintInput, category, categorySource, rawText, merchant, onApplied } = props;
  const [value, setValue] = useState<string>(category ?? '');
  const [busy, setBusy] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | undefined>(id);

  useEffect(() => {
    setValue(category ?? '');
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    const assign = async () => {
      if (id) {
        setResolvedId(id);
        return;
      }
      if (!fingerprintInput) {
        setResolvedId(undefined);
        return;
      }
      const hex = await computeFingerprintHex(fingerprintInput);
      if (!cancelled) setResolvedId(hex);
    };
    void assign();
    return () => {
      cancelled = true;
    };
  }, [id, fingerprintInput]);

  const whyText = useMemo(() => {
    const lines: string[] = [];
    if (categorySource) lines.push(`Quelle: ${categorySource}`);
    if (merchant) lines.push(`Händler: ${merchant}`);
    if (rawText) lines.push(`Text: ${rawText}`);
    return lines.join('\n') || 'Keine zusätzlichen Details';
  }, [categorySource, merchant, rawText]);

  const handleApply = async (next: string) => {
    if (!resolvedId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: resolvedId, category: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message ?? 'Kategorie konnte nicht gesetzt werden.');
      }
      setValue(next);
      onApplied?.(resolvedId, next);
    } catch (error: any) {
      alert(error?.message ?? 'Kategorie konnte nicht gesetzt werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (!resolvedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/overrides/${encodeURIComponent(resolvedId)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message ?? 'Kategorie konnte nicht gelöscht werden.');
      }
      setValue('');
      onApplied?.(resolvedId, null);
    } catch (error: any) {
      alert(error?.message ?? 'Kategorie konnte nicht gelöscht werden.');
    } finally {
      setBusy(false);
    }
  };

  // Sort categories alphabetically, keeping "Sonstiges" at the bottom
  const sortedOptions = useMemo(() => {
    if (!CATEGORY_OPTIONS) return [];

    const pinnedIds = new Set<string>([
      // Optionally pin certain categories at the top
      // 'groceries', 'rent', 'income_salary',
    ]);

    const pinned = CATEGORY_OPTIONS.filter(o => pinnedIds.has(o.id));
    const rest = CATEGORY_OPTIONS.filter(o => !pinnedIds.has(o.id));

    rest.sort((a, b) => {
      const metaA = getCategoryMeta(a.id);
      const metaB = getCategoryMeta(b.id);
      return metaA.label.localeCompare(metaB.label, 'de', { sensitivity: 'base' });
    });

    // Keep "Sonstiges" (id: 'other') at the very bottom
    const withoutOther = rest.filter(o => o.id !== 'other');
    const otherOption = rest.find(o => o.id === 'other');

    return otherOption
      ? [...pinned, ...withoutOther, otherOption]
      : [...pinned, ...rest];
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={event => handleApply(event.target.value)}
          disabled={!resolvedId || busy}
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-300 dark:focus:ring-indigo-500/30"
        >
          <option value="" disabled>
            — Kategorie wählen —
          </option>
          {sortedOptions.map(option => {
            const meta = getCategoryMeta(option.id);
            return (
              <option key={option.id} value={option.id}>
                {meta.label}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={handleClear}
          disabled={!value || !resolvedId || busy}
          className="text-xs font-medium text-slate-500 underline transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:text-slate-100"
        >
          Zurücksetzen
        </button>
        <span title={whyText} className="text-xs text-slate-400 dark:text-slate-500">
          Warum?
        </span>
      </div>
    </div>
  );
}


