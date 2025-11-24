import React, { useState, useEffect, useRef } from 'react';
import { saveReimbursementAllocations, type ReimbursementGroup, fetchCategories, type CategoryMeta } from '../../api/reviewApi';
import { formatCurrency, formatDate } from '../../lib/format';

interface ReimbursementLinkDialogProps {
  group: ReimbursementGroup;
  isOpen: boolean;
  onClose: () => void;
  onMarkedAsPassThrough: () => void;
  onIgnoredAsNormal: () => void;
  onAllocationsSaved?: () => void;
}

// Helper functions for euro↔cents conversion
const parseEuroInputToCents = (value: string): number | null => {
  if (!value.trim()) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  if (!isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
};

const formatCentsToEuroInput = (cents: number | null | undefined): string => {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
};

const formatDateShort = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Helper to check if group is simple inflow-only
const isSimpleInflowOnlyGroup = (group: ReimbursementGroup): boolean => {
  return group.inflows.length === 1 && group.outflows.length === 0;
};

type Decision = 'reimbursement' | 'separate';

export default function ReimbursementLinkDialog({
  group,
  isOpen,
  onClose,
  onMarkedAsPassThrough,
  onIgnoredAsNormal,
  onAllocationsSaved,
}: ReimbursementLinkDialogProps) {
  const [decision, setDecision] = useState<Decision>('reimbursement');
  const [showDetails, setShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Categories state
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string | null>>({});
  const categoryDropdownRef = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Allocation editor state
  const [allocationEditor, setAllocationEditor] = useState<{
    groupId: string;
    inflowTransactionId: string;
  } | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<Record<string, number>>({});
  const [allocationInputRaw, setAllocationInputRaw] = useState<Record<string, string>>({});
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  // Fetch categories when dialog opens
  useEffect(() => {
    if (isOpen) {
      void fetchCategories().then(setCategories).catch(() => {
        // Silently fail - categories are optional
        setCategories([]);
      });
      
      // Initialize expense categories from group data
      const initialCategories: Record<string, string | null> = {};
      for (const exp of group.outflows) {
        initialCategories[String(exp.id)] = exp.category;
      }
      setExpenseCategories(initialCategories);
    }
  }, [isOpen, group]);

  // Initialize decision when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDecision('reimbursement'); // Default to reimbursement
      setShowDetails(false);
      setCategoryEditingId(null);
      setAllocationEditor(null);
      setAllocationDraft({});
      setAllocationInputRaw({});
      setAllocationError(null);
    }
  }, [isOpen]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryEditingId) {
        const ref = categoryDropdownRef.current.get(categoryEditingId);
        if (ref && !ref.contains(event.target as Node)) {
          setCategoryEditingId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryEditingId]);

  // Auto-open allocation editor for complex groups when details are shown
  useEffect(() => {
    if (showDetails && !isSimpleInflowOnlyGroup(group) && group.inflows.length > 0 && !allocationEditor) {
      const firstInflow = group.inflows[0];
      setAllocationEditor({ groupId: group.groupId, inflowTransactionId: String(firstInflow.id) });
      
      // Pre-fill from existing allocations
      const existing = group.allocations?.filter(a => a.inflowTransactionId === String(firstInflow.id)) ?? [];
      const nextDraft: Record<string, number> = {};
      const nextRaw: Record<string, string> = {};
      for (const alloc of existing) {
        nextDraft[alloc.expenseTransactionId] = alloc.allocatedAmountCents;
        nextRaw[alloc.expenseTransactionId] = formatCentsToEuroInput(alloc.allocatedAmountCents);
      }
      setAllocationDraft(nextDraft);
      setAllocationInputRaw(nextRaw);
    }
  }, [showDetails, group, allocationEditor]);

  const handleSave = async () => {
    if (decision === 'reimbursement') {
      // Save allocations first if they were edited
      if (allocationEditor && Object.keys(allocationDraft).length > 0) {
        try {
          setIsSavingAllocation(true);
          const payload = Object.entries(allocationDraft).map(([expenseTransactionId, cents]) => ({
            expenseTransactionId,
            allocatedAmountCents: cents,
          }));
          await saveReimbursementAllocations(
            allocationEditor.groupId,
            allocationEditor.inflowTransactionId,
            payload,
          );
          onAllocationsSaved?.();
        } catch (err) {
          setAllocationError(err instanceof Error ? err.message : 'Fehler beim Speichern der Verknüpfung.');
          return;
        } finally {
          setIsSavingAllocation(false);
        }
      }
      
      // Then mark as pass-through
      setIsSubmitting(true);
      try {
        onMarkedAsPassThrough();
        onClose();
      } catch (err) {
        setAllocationError(err instanceof Error ? err.message : 'Fehler beim Markieren als durchlaufende Posten.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Separate booking - show confirmation
      const confirmed = window.confirm(
        'Diese Buchungen werden nicht mehr als Erstattung/ durchlaufender Posten vorgeschlagen. Fortfahren?'
      );
      if (!confirmed) {
        return;
      }
      
      setIsSubmitting(true);
      try {
        onIgnoredAsNormal();
        onClose();
      } catch (err) {
        setAllocationError(err instanceof Error ? err.message : 'Fehler beim Ignorieren der Gruppe.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handler for category change
  const handleCategoryChange = (expenseId: string, categoryId: string | null) => {
    setExpenseCategories(prev => ({
      ...prev,
      [expenseId]: categoryId,
    }));
    setCategoryEditingId(null);
    
    // TODO: Call API to update transaction category
    // await updateTransactionCategory(expenseId, categoryId);
    // For now, just update local state
  };

  // Helper to get category label
  const getCategoryLabel = (categoryId: string | null): string => {
    if (!categoryId) return 'Kategorie wählen';
    const category = categories.find(c => c.id === categoryId);
    return category?.labelDe || categoryId;
  };

  // Helper to get category color (simple hash-based coloring)
  const getCategoryColor = (categoryId: string | null): string => {
    if (!categoryId) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    
    // Simple color mapping based on category ID hash
    const hash = categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ];
    return colors[hash % colors.length];
  };

  // Handler for quick split controls
  const setAllocationForExpense = (
    expenseId: string,
    cents: number | null,
    expenseAmountCents: number,
    inflowAmountCents: number,
  ) => {
    setAllocationDraft(prev => {
      const next = { ...prev };
      const otherAllocatedCents = Object.entries(next)
        .filter(([id]) => id !== expenseId)
        .reduce((sum, [, value]) => sum + (value ?? 0), 0);

      if (cents == null) {
        delete next[expenseId];
        setAllocationInputRaw(prevRaw => {
          const nextRaw = { ...prevRaw };
          delete nextRaw[expenseId];
          return nextRaw;
        });
        return next;
      }

      const maxForThisExpense = Math.max(0, Math.min(expenseAmountCents, inflowAmountCents - otherAllocatedCents));
      const finalCents = Math.max(0, Math.min(cents, maxForThisExpense));

      if (finalCents === 0) {
        delete next[expenseId];
        setAllocationInputRaw(prevRaw => {
          const nextRaw = { ...prevRaw };
          delete nextRaw[expenseId];
          return nextRaw;
        });
      } else {
        next[expenseId] = finalCents;
        setAllocationInputRaw(prevRaw => ({
          ...prevRaw,
          [expenseId]: formatCentsToEuroInput(finalCents),
        }));
      }

      return next;
    });
  };

  if (!isOpen) return null;

  const isSimple = isSimpleInflowOnlyGroup(group);
  const netImpactCents = group.netImpactCents || 0;
  
  // Generate friendly subtitle based on netImpactCents
  const friendlySubtitle = isSimple
    ? netImpactCents < 0
      ? `${group.counterpartName || 'Jemand'} hat dir Geld zurückgezahlt.`
      : `Du hast hier vermutlich für ${group.counterpartName || 'diese Person'} ausgelegt.`
    : netImpactCents < 0
    ? `${group.counterpartName || 'Jemand'} hat dir für "${group.outflows[0]?.purpose || 'diese Ausgaben'}" Geld zurückgezahlt.`
    : `Du hast hier vermutlich für ${group.counterpartName || 'diese Person'} ausgelegt.`;

  // Get current inflow being edited
  const currentInflow = allocationEditor
    ? group.inflows.find(inflow => String(inflow.id) === allocationEditor.inflowTransactionId)
    : null;
  
  const inflowAmountCents = currentInflow ? Math.abs(currentInflow.amountCents) : 0;
  const totalAllocatedCents = Object.values(allocationDraft).reduce((sum, v) => sum + (v ?? 0), 0);
  const remainingCents = inflowAmountCents - totalAllocatedCents;
  const isOverAllocated = remainingCents < 0;
  const isAllocationComplete = Math.abs(remainingCents) <= 50 && !isOverAllocated && totalAllocatedCents > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <div className="p-5 sm:p-6">
          {/* Compact Header */}
          <div className="mb-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Zahlung verknüpfen{!isSimple && ` mit ${group.counterpartName || 'dieser Person'}`}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {friendlySubtitle}
                </p>
              </div>
              {group.primaryCategoryLabel && (
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 whitespace-nowrap">
                  {group.primaryCategoryLabel}
                </span>
              )}
            </div>
            
            {/* Net-cost line */}
            {Math.abs(netImpactCents) > 0 && (
              <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                Deine tatsächlichen Kosten:{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(Math.abs(netImpactCents) / 100)} € netto
                </span>
              </div>
            )}
          </div>

          {/* Level 1 Decision Card (for complex groups) */}
          {!isSimple && (
            <div className="mb-5">
              <div className="space-y-3">
                {/* Option A: Als Erstattung verknüpfen */}
                <button
                  type="button"
                  onClick={() => setDecision('reimbursement')}
                  disabled={isSubmitting}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    decision === 'reimbursement'
                      ? 'border-emerald-500 bg-emerald-50/80 dark:border-emerald-400 dark:bg-emerald-900/30'
                      : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-400/80 dark:hover:bg-emerald-900/20'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {decision === 'reimbursement' ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Als Erstattung verknüpfen
                      </span>
                      {group.confidence !== undefined && group.confidence >= 60 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Empfohlen
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Rückzahlung mit der Ausgabe verrechnen. In deinen Auswertungen siehst du nur die Netto-Kosten.
                    </p>
                  </div>
                </button>

                {/* Option B: Getrennt behandeln */}
                <button
                  type="button"
                  onClick={() => setDecision('separate')}
                  disabled={isSubmitting}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    decision === 'separate'
                      ? 'border-sky-500 bg-sky-50/60 dark:border-sky-400 dark:bg-sky-900/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {decision === 'separate' ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 dark:bg-sky-500">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Getrennt behandeln
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Beide Buchungen bleiben eigenständig. Du siehst eine Ausgabe und eine Einnahme.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* For simple groups, show decision card */}
          {isSimple && (
            <div className="mb-5">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Wie soll das in deinen Auswertungen erscheinen?
              </div>
              
              <div className="space-y-3">
                {/* Option A: Als Erstattung verknüpfen */}
                <button
                  type="button"
                  onClick={() => setDecision('reimbursement')}
                  disabled={isSubmitting}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    decision === 'reimbursement'
                      ? 'border-emerald-500 bg-emerald-50/80 dark:border-emerald-400 dark:bg-emerald-900/30'
                      : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-400/80 dark:hover:bg-emerald-900/20'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {decision === 'reimbursement' ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Als Erstattung verknüpfen
                      </span>
                      {group.confidence !== undefined && group.confidence >= 60 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Empfohlen
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Rückzahlung mit der Ausgabe verrechnen. In deinen Auswertungen siehst du nur die Netto-Kosten.
                    </p>
                  </div>
                </button>

                {/* Option B: Getrennt behandeln */}
                <button
                  type="button"
                  onClick={() => setDecision('separate')}
                  disabled={isSubmitting}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    decision === 'separate'
                      ? 'border-sky-500 bg-sky-50/60 dark:border-sky-400 dark:bg-sky-900/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {decision === 'separate' ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 dark:bg-sky-500">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Getrennt behandeln
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Beide Buchungen bleiben eigenständig. Du siehst eine Ausgabe und eine Einnahme.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* For complex groups: Details toggle and two-column layout */}
          {!isSimple && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                <span>Details & Anteile anzeigen…</span>
                <svg
                  className={`h-5 w-5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDetails && (
                <div className="mt-4 space-y-4">
                  {/* Two-column layout: Was haben wir gefunden? */}
                  <div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">
                      Was wir gefunden haben
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ausgaben */}
                      {group.outflows.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Deine Ausgaben
                          </div>
                          <div className="space-y-2">
                            {group.outflows.map(exp => {
                              const expenseId = String(exp.id);
                              const categoryId = expenseCategories[expenseId] ?? exp.category;
                              const isEditing = categoryEditingId === expenseId;
                              
                              return (
                                <div
                                  key={exp.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:bg-slate-800/60 dark:border-slate-700"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                                      {formatDateShort(exp.bookingDate)} · {exp.purpose || 'Unbekannt'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                                      –{formatCurrency(Math.abs(exp.amountCents) / 100)}
                                    </div>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCategoryEditingId(isEditing ? null : expenseId);
                                        }}
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition ${getCategoryColor(categoryId)}`}
                                      >
                                        {getCategoryLabel(categoryId)}
                                      </button>
                                      
                                      {isEditing && (
                                        <div
                                          ref={(el) => {
                                            if (el) categoryDropdownRef.current.set(expenseId, el);
                                          }}
                                          className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 max-h-48 overflow-y-auto"
                                        >
                                          <div className="py-1">
                                            <button
                                              type="button"
                                              onClick={() => handleCategoryChange(expenseId, null)}
                                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                              Keine Kategorie
                                            </button>
                                            {categories.map(cat => (
                                              <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => handleCategoryChange(expenseId, cat.id)}
                                                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                              >
                                                {cat.labelDe}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Rückzahlung(en) */}
                      <div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Erstattungen & Rückzahlungen
                        </div>
                        <div className="space-y-2">
                          {group.inflows.map(inflow => (
                            <div
                              key={inflow.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:bg-emerald-900/30 dark:border-emerald-800"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                                  {formatDateShort(inflow.bookingDate)} · {inflow.purpose || 'Unbekannt'}
                                </div>
                              </div>
                              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                +{formatCurrency(inflow.amountCents / 100)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                {/* Allocation wizard */}
                {!isSimple && group.inflows.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Zahlung verknüpfen
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Verteile diese Erstattung auf deine Ausgaben. Nimbus rechnet für dich mit.
                      </p>
                    </div>

                    {currentInflow && (
                      <>
                        {/* Top stripe with summary */}
                        <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Erstattung:</span>{' '}
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(inflowAmountCents / 100)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Davon verteilt:</span>{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrency(totalAllocatedCents / 100)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Übrig:</span>{' '}
                              <span className={`font-medium ${isOverAllocated ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {formatCurrency(remainingCents / 100)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {allocationError && (
                          <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
                            {allocationError}
                          </div>
                        )}

                        {isOverAllocated && (
                          <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
                            Du hast mehr verteilt als mit dieser Erstattung zurückgezahlt wurde. Bitte reduziere einen Betrag.
                          </div>
                        )}

                        {/* Expense rows */}
                        <div className="space-y-3">
                          {group.outflows.map(exp => {
                            const expenseId = String(exp.id);
                            const categoryId = expenseCategories[expenseId] ?? exp.category;
                            const isEditingCategory = categoryEditingId === expenseId;
                            
                            return (
                              <div key={exp.id} className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                      {formatDateShort(exp.bookingDate)} · {exp.purpose || 'Unbekannt'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatCurrency(Math.abs(exp.amountCents) / 100)} €
                                      </div>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCategoryEditingId(isEditingCategory ? null : expenseId);
                                          }}
                                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition ${getCategoryColor(categoryId)}`}
                                        >
                                          {getCategoryLabel(categoryId)}
                                        </button>
                                        
                                        {isEditingCategory && (
                                          <div
                                            ref={(el) => {
                                              if (el) categoryDropdownRef.current.set(expenseId, el);
                                            }}
                                            className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 max-h-48 overflow-y-auto"
                                          >
                                            <div className="py-1">
                                              <button
                                                type="button"
                                                onClick={() => handleCategoryChange(expenseId, null)}
                                                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                              >
                                                Keine Kategorie
                                              </button>
                                              {categories.map(cat => (
                                                <button
                                                  key={cat.id}
                                                  type="button"
                                                  onClick={() => handleCategoryChange(expenseId, cat.id)}
                                                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                                >
                                                  {cat.labelDe}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="w-28 flex flex-col gap-1">
                                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                      Dein Anteil aus dieser Erstattung
                                    </span>
                                    <div className="w-full flex items-center gap-1">
                                      <input
                                        type="text"
                                        placeholder="0,00"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                        value={allocationInputRaw[expenseId] ?? ''}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setAllocationInputRaw(prev => ({
                                            ...prev,
                                            [expenseId]: value,
                                          }));
                                        }}
                                        onBlur={() => {
                                          const raw = allocationInputRaw[expenseId] ?? '';
                                          const cents = parseEuroInputToCents(raw);
                                          setAllocationDraft(prev => {
                                            const next = { ...prev };
                                            if (cents == null) {
                                              delete next[expenseId];
                                            } else {
                                              next[expenseId] = cents;
                                            }
                                            return next;
                                          });
                                        }}
                                      />
                                      <span className="text-xs text-slate-400">€</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Quick split controls */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    onClick={() =>
                                      setAllocationForExpense(
                                        expenseId,
                                        Math.round(Math.abs(exp.amountCents) / 2),
                                        Math.abs(exp.amountCents),
                                        inflowAmountCents,
                                      )
                                    }
                                  >
                                    50&nbsp;%
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    onClick={() =>
                                      setAllocationForExpense(
                                        expenseId,
                                        Math.abs(exp.amountCents),
                                        Math.abs(exp.amountCents),
                                        inflowAmountCents,
                                      )
                                    }
                                  >
                                    100&nbsp;%
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-transparent px-2 py-0.5 text-[10px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                                    onClick={() =>
                                      setAllocationForExpense(
                                        expenseId,
                                        null,
                                        Math.abs(exp.amountCents),
                                        inflowAmountCents,
                                      )
                                    }
                                  >
                                    Löschen
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {isAllocationComplete && (
                          <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
                            ✅ Sauber verteilt.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              {isAllocationComplete && decision === 'reimbursement' && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  ✅ Sauber verteilt.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isSavingAllocation}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Abbrechen
              </button>
              {!isSimple && (
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  disabled={isSubmitting || isSavingAllocation}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Details & Anteile anpassen…
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || isSavingAllocation || (decision === 'reimbursement' && isOverAllocated)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isSubmitting || isSavingAllocation
                  ? 'Wird gespeichert…'
                  : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

