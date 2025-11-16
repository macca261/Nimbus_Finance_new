import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NormalizationRule, RuleMatcher } from '../../api/normalizer';
import type { ApiResult } from '../../api/normalizer';

type RuleFormValues = {
  matcher: RuleMatcher;
  pattern: string;
  normalizeTo: string;
  priority: string;
  is_active: boolean;
  categoryHint: string;
  notes: string;
};

type RuleFormErrors = Partial<Record<keyof RuleFormValues | 'form', string>>;

export type RuleFormSubmitValues = {
  matcher: RuleMatcher;
  pattern: string;
  normalizeTo: string;
  priority: number;
  is_active: boolean;
  categoryHint?: string | null;
  notes?: string | null;
};

export interface RuleFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: NormalizationRule;
  matcherLabels: Record<RuleMatcher, string>;
  onSubmit: (values: RuleFormSubmitValues) => Promise<ApiResult<NormalizationRule>>;
  onClose: () => void;
  existingRules: NormalizationRule[];
}

const toFormValues = (rule: NormalizationRule): RuleFormValues => ({
  matcher: rule.matcher,
  pattern: rule.pattern,
  normalizeTo: rule.normalizeTo,
  priority: String(rule.priority ?? 0),
  is_active: Boolean(rule.is_active),
  categoryHint: rule.categoryHint ?? '',
  notes: rule.notes ?? '',
});

const sanitizeValues = (values: RuleFormValues): RuleFormSubmitValues => {
  const priority = Number.parseInt(values.priority, 10);
  return {
    matcher: values.matcher,
    pattern: values.pattern.trim(),
    normalizeTo: values.normalizeTo.trim(),
    priority: Number.isFinite(priority) && priority >= 0 ? priority : 0,
    is_active: values.is_active,
    categoryHint: values.categoryHint.trim() ? values.categoryHint.trim() : null,
    notes: values.notes.trim() ? values.notes.trim() : null,
  };
};

const validate = (values: RuleFormValues): RuleFormErrors => {
  const errors: RuleFormErrors = {};
  const trimmedPattern = values.pattern.trim();

  if (!trimmedPattern) {
    errors.pattern = 'Pattern darf nicht leer sein.';
  } else if (values.matcher !== 'regex' && trimmedPattern.length < 2) {
    errors.pattern = 'Mindestens zwei Zeichen erforderlich.';
  }

  if (values.matcher === 'regex') {
    try {
      // eslint-disable-next-line no-new
      new RegExp(trimmedPattern, 'i');
    } catch (err) {
      errors.pattern = 'Regex ungültig: ' + (err instanceof Error ? err.message : String(err));
    }
  }

  if (!values.normalizeTo.trim()) {
    errors.normalizeTo = 'Pflichtfeld.';
  }

  if (!Number.isFinite(Number.parseInt(values.priority, 10))) {
    errors.priority = 'Priorität muss eine ganze Zahl sein.';
  }

  return errors;
};

const RuleFormDialog: React.FC<RuleFormDialogProps> = ({
  open,
  mode,
  initial,
  matcherLabels,
  onSubmit,
  onClose,
  existingRules,
}) => {
  const [values, setValues] = useState<RuleFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const patternInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValues(toFormValues(initial));
      setErrors({});
      setSubmitting(false);
      setWarnings([]);

      const focusTimer = window.setTimeout(() => {
        patternInputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(focusTimer);
    }
  }, [open, initial]);

  useEffect(() => {
    const trimmedPattern = values.pattern.trim();
    const normalizedPattern = trimmedPattern.toLowerCase();
    const normalizedTarget = values.normalizeTo.trim();
    const currentId = initial.id;
    const nextWarnings: string[] = [];
    let regexWarningAdded = false;

    for (const rule of existingRules) {
      if (!rule || rule.id === currentId) continue;

      if (values.matcher === 'regex') {
        if (rule.matcher === 'regex' && !regexWarningAdded) {
          nextWarnings.push(
            `Es existiert bereits eine Regex-Regel (${rule.id}). Prüfe mögliche Überschneidungen.`,
          );
          regexWarningAdded = true;
        }
        continue;
      }

      if (rule.matcher !== values.matcher) continue;
      const otherPattern = rule.pattern.trim().toLowerCase();
      if (!otherPattern || !normalizedPattern) continue;

      if (otherPattern === normalizedPattern) {
        if (rule.normalizeTo.trim() !== normalizedTarget) {
          nextWarnings.push(
            `Pattern wird bereits von Regel ${rule.id} auf "${rule.normalizeTo}" normalisiert.`,
          );
        } else if (
          (rule.categoryHint ?? '').trim() !== (values.categoryHint ?? '').trim() &&
          (rule.categoryHint || values.categoryHint)
        ) {
          nextWarnings.push(
            `Regel ${rule.id} nutzt dieselbe Normalisierung, aber andere Kategorie-Hinweise.`,
          );
        }
      }
    }

    setWarnings(nextWarnings);
  }, [existingRules, initial.id, values.categoryHint, values.matcher, values.normalizeTo, values.pattern]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !formRef.current) {
      return;
    }

    const focusable = Array.from(
      formRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !active) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const warningId = warnings.length > 0 ? 'rule-form-warnings' : undefined;

  const handleChange =
    (field: keyof RuleFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = event.currentTarget;
      const nextValue =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target.value;

      setValues(prev => ({
        ...prev,
        [field]: nextValue,
      }));
    };

  const title = useMemo(
    () => (mode === 'create' ? 'Neue Regel anlegen' : 'Regel bearbeiten'),
    [mode],
  );

  const submitButtonLabel = mode === 'create' ? 'Erstellen' : 'Speichern';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate(values);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const payload = sanitizeValues(values);
    const result = await onSubmit(payload);
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    onClose();
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-form-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800/70 dark:bg-slate-900">
        <form ref={formRef} onSubmit={handleSubmit}>
          <header className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
            <div>
              <h2 id="rule-form-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Definiere Muster, die Händlernamen vereinheitlichen und optionale Kategorie-Hinweise liefern.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
            >
              Abbrechen
            </button>
          </header>
          <div className="space-y-4 px-6 py-5 text-sm">
            {errors.form ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {errors.form}
              </div>
            ) : null}
          {warnings.length > 0 ? (
            <div
              id={warningId}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <p className="font-medium">Hinweise:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={values.is_active}
                  onChange={handleChange('is_active')}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Aktiv
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="rule-priority">
                  Priorität
                </label>
                <input
                  id="rule-priority"
                  type="number"
                  min={0}
                  value={values.priority}
                  onChange={handleChange('priority')}
                  className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              {errors.priority ? (
                <p className="text-xs text-rose-600 dark:text-rose-300">{errors.priority}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="rule-matcher" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Matcher
                </label>
                <select
                  id="rule-matcher"
                  value={values.matcher}
                  onChange={handleChange('matcher')}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {Object.entries(matcherLabels).map(([matcher, label]) => (
                    <option key={matcher} value={matcher}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="rule-pattern" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Pattern
                </label>
                <input
                  id="rule-pattern"
                  type="text"
                  value={values.pattern}
                  onChange={handleChange('pattern')}
                  ref={patternInputRef}
                  aria-describedby={warningId}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="z. B. uber"
                />
                {errors.pattern ? (
                  <p className="text-xs text-rose-600 dark:text-rose-300">{errors.pattern}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="rule-normalize" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Normalisiert zu
              </label>
              <input
                id="rule-normalize"
                type="text"
                value={values.normalizeTo}
                onChange={handleChange('normalizeTo')}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                placeholder="z. B. Uber"
              />
              {errors.normalizeTo ? (
                <p className="text-xs text-rose-600 dark:text-rose-300">{errors.normalizeTo}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="rule-category" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Kategorie-Hinweis (optional)
                </label>
                <input
                  id="rule-category"
                  type="text"
                  value={values.categoryHint}
                  onChange={handleChange('categoryHint')}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="z. B. transport:rideshare"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="rule-notes" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Notizen (optional)
                </label>
                <textarea
                  id="rule-notes"
                  value={values.notes}
                  onChange={handleChange('notes')}
                  className="h-20 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Interne Hinweise zur Regel."
                />
              </div>
            </div>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-xs dark:border-slate-800/70">
            <p className="text-slate-500 dark:text-slate-400">
              Matcher und Pattern bestimmen die Erkennung. Priorität legt die Reihenfolge fest (niedrigere Werte zuerst).
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-indigo-600 px-4 py-1.5 font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitButtonLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default RuleFormDialog;


