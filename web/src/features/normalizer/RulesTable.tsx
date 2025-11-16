import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listNormalizationRules,
  updateNormalizationRule,
  deleteNormalizationRules,
  createNormalizationRule,
  type NormalizationRule,
  type RuleMatcher,
} from '../../api/normalizer';
import { toast } from '../../lib/toast';
import RuleFormDialog from './RuleFormDialog';

type TableState = 'idle' | 'loading' | 'error';

type RulesTableProps = {
  highlightRuleId?: string | null;
};

const sortRules = (rules: NormalizationRule[]): NormalizationRule[] =>
  [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.localeCompare(b.createdAt);
  });

const matcherLabels: Record<RuleMatcher, string> = {
  contains: 'Enthält',
  startsWith: 'Beginnt mit',
  equals: 'Exakt gleich',
  regex: 'Regex',
};

export const RulesTable: React.FC<RulesTableProps> = ({ highlightRuleId }) => {
  const [state, setState] = useState<TableState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<NormalizationRule[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reordering, setReordering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingRule, setEditingRule] = useState<NormalizationRule | null>(null);
  const [flashRuleId, setFlashRuleId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setState('loading');
    const response = await listNormalizationRules();
    if (!response.ok) {
      setError(response.error);
      setState('error');
      return;
    }
    setRules(sortRules(response.data));
    setSelected([]);
    setState('idle');
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const allSelected = useMemo(
    () => rules.length > 0 && selected.length === rules.length,
    [rules, selected],
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(rules.map(rule => rule.id));
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id],
    );
  };

  const persistPriorities = async (
    nextRules: NormalizationRule[],
    previousRules: NormalizationRule[],
  ) => {
    const updates = nextRules
      .map((rule, index) => {
        const desiredPriority = index + 1;
        if (rule.priority === desiredPriority) {
          return null;
        }
        return { id: rule.id, priority: desiredPriority };
      })
      .filter((entry): entry is { id: string; priority: number } => Boolean(entry));

    if (!updates.length) {
      setRules(nextRules);
      return;
    }

    setReordering(true);
    const results = await Promise.all(
      updates.map(async update => {
        const response = await updateNormalizationRule(update.id, { priority: update.priority });
        return { update, response };
      }),
    );
    const failed = results.find(item => !item.response.ok);

    if (failed) {
      toast('Reihenfolge konnte nicht gespeichert werden.', 'error');
      setRules(previousRules);
    } else {
      setRules(nextRules.map((rule, index) => ({ ...rule, priority: index + 1 })));
      toast('Reihenfolge aktualisiert.', 'info');
    }

    setReordering(false);
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rules.length) return;

    const previous = rules;
    const reordered = [...rules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    setRules(reordered);
    void persistPriorities(reordered, previous);
  };

  const handleDelete = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(ids.length === 1 ? 'Regel löschen?' : 'Ausgewählte Regeln löschen?')) return;

    const previous = rules;
    setDeleting(true);
    setRules(current => current.filter(rule => !ids.includes(rule.id)));
    setSelected(current => current.filter(id => !ids.includes(id)));

    const response = await deleteNormalizationRules(ids);
    if (!response.ok) {
      toast(response.error, 'error');
      setRules(previous);
    } else {
      toast(
        ids.length === 1 ? 'Regel gelöscht.' : `${response.data} Regeln gelöscht.`,
        'success',
      );
    }
    setDeleting(false);
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingRule(null);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: NormalizationRule) => {
    setDialogMode('edit');
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const nextPriority = useMemo(() => {
    if (!rules.length) return 100;
    return Math.max(...rules.map(rule => rule.priority)) + 10;
  }, [rules]);

  const handleDialogSubmit = async (formValues: {
    matcher: RuleMatcher;
    pattern: string;
    normalizeTo: string;
    priority: number;
    is_active: boolean;
    categoryHint?: string | null;
    notes?: string | null;
  }) => {
    if (dialogMode === 'create') {
      const response = await createNormalizationRule(formValues);
      if (!response.ok) {
        toast(response.error, 'error');
        return response;
      }
      setRules(prev => sortRules([...prev, response.data]));
      toast('Regel erstellt.', 'success');
      closeDialog();
      return response;
    }

    if (!editingRule) {
      return { ok: false as const, error: 'Keine Regel zum Bearbeiten ausgewählt.' };
    }

    const response = await updateNormalizationRule(editingRule.id, formValues);
    if (!response.ok) {
      toast(response.error, 'error');
      return response;
    }
    setRules(prev =>
      sortRules(prev.map(rule => (rule.id === response.data.id ? response.data : rule))),
    );
    toast('Regel aktualisiert.', 'success');
    closeDialog();
    return response;
  };

  useEffect(() => {
    if (!highlightRuleId) {
      return;
    }
    setFlashRuleId(highlightRuleId);
    const timer = window.setTimeout(() => {
      setFlashRuleId(null);
    }, 5000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightRuleId]);

  const renderBody = () => {
    if (state === 'loading') {
      return (
        <div className="rounded-xl border border-slate-200/70 bg-white/60 p-8 text-sm text-slate-500 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
          Lade Regeln …
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error ?? 'Regeln konnten nicht geladen werden.'}
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
            onClick={() => fetchRules()}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }

    if (!rules.length) {
      return (
        <div className="rounded-xl border border-slate-200/70 bg-white/60 p-8 text-sm text-slate-500 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
          <p>Noch keine Normalizer-Regeln vorhanden. Lege eine neue Regel an, um Händler zu vereinheitlichen.</p>
          <button
            type="button"
            onClick={openCreateDialog}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Neue Regel anlegen
          </button>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white/70 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
        <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
            <tr>
              <th scope="col" className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Alle Regeln auswählen"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th scope="col" className="w-16 px-3 py-3 text-left">
                Prio
              </th>
              <th scope="col" className="w-28 px-3 py-3 text-left">
                Matcher
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Pattern
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Normalisiert zu
              </th>
              <th scope="col" className="px-3 py-3 text-left">
                Kategorie-Hinweis
              </th>
              <th scope="col" className="w-20 px-3 py-3 text-left">
                Aktiv
              </th>
              <th scope="col" className="w-36 px-3 py-3 text-left">
                Aktualisiert
              </th>
              <th scope="col" className="w-32 px-3 py-3 text-left">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rules.map((rule, index) => {
              const selectedRow = selected.includes(rule.id);
              const isHighlighted = flashRuleId === rule.id;
              const rowClass = [
                selectedRow ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : '',
                isHighlighted ? 'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <tr key={rule.id} className={rowClass || undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRow}
                      onChange={() => toggleRowSelection(rule.id)}
                      aria-label="Regel auswählen"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-300">
                    {rule.priority}
                  </td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{rule.matcher}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                    {rule.pattern}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {rule.normalizeTo}
                  </td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                    {rule.categoryHint ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        rule.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {rule.is_active ? 'Ja' : 'Nein'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500">
                    {new Date(rule.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveRule(index, -1)}
                        disabled={index === 0 || reordering}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        aria-label="Nach oben verschieben"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRule(index, 1)}
                        disabled={index === rules.length - 1 || reordering}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        aria-label="Nach unten verschieben"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(rule)}
                        className="rounded-md border border-transparent px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete([rule.id])}
                        className="rounded-md border border-transparent px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          <span>{rules.length} Regeln</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDelete(selected)}
            disabled={!selected.length || deleting}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 dark:border-slate-700 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Ausgewählte löschen
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Neue Regel
          </button>
        </div>
      </div>
      {renderBody()}
      <RuleFormDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={
          dialogMode === 'edit' && editingRule
            ? editingRule
            : {
                id: 'new',
                matcher: 'contains',
                pattern: '',
                normalizeTo: '',
                priority: nextPriority,
                is_active: true,
                categoryHint: null,
                notes: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
        }
        onClose={closeDialog}
        onSubmit={handleDialogSubmit}
        matcherLabels={matcherLabels}
        existingRules={rules}
      />
    </div>
  );
};

export default RulesTable;

