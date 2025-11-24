import React, { useState, useEffect, useRef } from 'react';
import { fetchReimbursementGroups, markPassThrough, ignoreReimbursementGroup, saveReimbursementAllocations, fetchCategories, type ReimbursementGroup, type CategoryMeta } from '../../api/reviewApi';
import { formatCurrency, formatDate } from '../../lib/format';
import ReimbursementLinkDialog from './ReimbursementLinkDialog';
import { evaluateQuietly } from '../../lib/achievements/evaluateQuietly';

interface ReimbursementsReviewCardProps {
  focusedGroupId?: string | null;
  resolvedGroupIds?: Set<string>;
  onResolvedGroupIdsChange?: (ids: Set<string>) => void;
}

// Helper functions for euro↔cents conversion
const parseEuroInputToCents = (value: string): number | null => {
  if (!value.trim()) return null;

  // Allow both comma and dot as decimal separators
  const normalized = value.replace(/\s/g, '').replace(',', '.');

  // Must be a positive number
  const num = Number(normalized);
  if (!isFinite(num) || num < 0) return null;

  // Convert to cents, rounded
  return Math.round(num * 100);
};

const formatCentsToEuroInput = (cents: number | null | undefined): string => {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ','); // match German pattern
};

// Helper function for suggestion logic
interface SuggestedAllocation {
  expenseId: string;
  amountCents: number;
}

function getSuggestedAllocationsForInflow(
  group: ReimbursementGroup,
  inflow: ReimbursementGroup['inflows'][number]
): SuggestedAllocation[] {
  // If there are no expenses, or inflow is non-positive, bail out.
  if (group.outflows.length === 0 || inflow.amountCents <= 0) {
    return [];
  }

  // If there are existing allocations for this inflow, return [] – we don't show a suggestion once the user has done something.
  const existingAllocations = group.allocations?.filter(a => a.inflowTransactionId === String(inflow.id)) ?? [];
  if (existingAllocations.length > 0) {
    return [];
  }

  // Greedily allocate the inflow to expenses in chronological order until exhausted.
  const suggestions: SuggestedAllocation[] = [];
  let remainingInflow = Math.abs(inflow.amountCents);

  // Sort expenses by booking date (oldest first)
  const sortedExpenses = [...group.outflows].sort((a, b) => 
    new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
  );

  for (const expense of sortedExpenses) {
    if (remainingInflow <= 0) break;

    const maxForExpense = Math.abs(expense.amountCents);
    const suggested = Math.min(maxForExpense, remainingInflow);

    if (suggested > 0) {
      suggestions.push({
        expenseId: String(expense.id),
        amountCents: suggested,
      });
      remainingInflow -= suggested;
    }
  }

  // If the list is empty or total suggested < 0.5€ (< 50 cents), return [].
  const totalSuggested = suggestions.reduce((sum, s) => sum + s.amountCents, 0);
  if (suggestions.length === 0 || totalSuggested < 50) {
    return [];
  }

  return suggestions;
}

// Helper functions for group classification
function isMixedDirection(group: ReimbursementGroup): boolean {
  return group.inflows.length > 0 && group.outflows.length > 0;
}

function getConfidenceLevel(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (confidence === undefined) return 'low';
  if (confidence >= 85) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

function isAmbiguousMixedGroup(group: ReimbursementGroup): boolean {
  return isMixedDirection(group) && getConfidenceLevel(group.confidence) === 'low';
}

function isSimpleInflowOnlyGroup(group: ReimbursementGroup): boolean {
  return group.inflows.length === 1 && group.outflows.length === 0;
}

interface CounterpartySummary {
  name: string;
  netImpactCents: number; // positive = you paid / are owed, negative = you received / you owe less
}

function computeCounterpartySummaries(groups: ReimbursementGroup[]): CounterpartySummary[] {
  const summaryMap = new Map<string, number>();

  for (const group of groups) {
    if (group.netImpactCents === undefined || group.netImpactCents === null) {
      continue;
    }

    const counterpartName = group.counterpartName || 'Unbekannter Kontakt';
    const current = summaryMap.get(counterpartName) || 0;
    summaryMap.set(counterpartName, current + group.netImpactCents);
  }

  // Convert to array and sort by absolute netImpactCents descending
  const summaries: CounterpartySummary[] = Array.from(summaryMap.entries()).map(([name, netImpactCents]) => ({
    name,
    netImpactCents,
  }));

  return summaries.sort((a, b) => Math.abs(b.netImpactCents) - Math.abs(a.netImpactCents));
}

export const ReimbursementsReviewCard: React.FC<ReimbursementsReviewCardProps> = ({ 
  focusedGroupId = null,
  resolvedGroupIds: externalResolvedGroupIds,
  onResolvedGroupIdsChange
}) => {
  const [groups, setGroups] = useState<ReimbursementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingGroupIds, setSubmittingGroupIds] = useState<Set<string>>(() => new Set());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [complexDecisions, setComplexDecisions] = useState<Record<string, 'refund' | 'separate'>>({});
  const [showDetailsForGroup, setShowDetailsForGroup] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string | null>>({});
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const categoryDropdownRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Use external resolvedGroupIds if provided, otherwise use internal state
  const [internalResolvedGroupIds, setInternalResolvedGroupIds] = useState<Set<string>>(new Set());
  const resolvedGroupIds = externalResolvedGroupIds ?? internalResolvedGroupIds;
  
  const updateResolvedGroupIds = (updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(resolvedGroupIds);
    if (onResolvedGroupIdsChange) {
      onResolvedGroupIdsChange(next);
    } else {
      setInternalResolvedGroupIds(next);
    }
  };

  // Allocation editor state
  const [allocationEditor, setAllocationEditor] = useState<{
    groupId: string;
    inflowId: number;
  } | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<Record<string, number>>({});
  const [allocationInputRaw, setAllocationInputRaw] = useState<Record<string, string>>({});
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);

  // Helper functions for managing submitting state
  const addSubmittingGroup = (groupId: string) => {
    setSubmittingGroupIds(prev => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  };

  const removeSubmittingGroup = (groupId: string) => {
    setSubmittingGroupIds(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  };

  const isGroupSubmitting = (groupId: string) => submittingGroupIds.has(groupId);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReimbursementGroups();
      setGroups(data);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Laden der Erstattungen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
    void fetchCategories().then(setCategories).catch(() => {
      // Silently fail - categories are optional
      setCategories([]);
    });
  }, []);

  // Initialize expense categories when groups change
  useEffect(() => {
    const initialCategories: Record<string, string | null> = {};
    for (const group of groups) {
      for (const exp of group.outflows) {
        initialCategories[String(exp.id)] = exp.category;
      }
    }
    setExpenseCategories(prev => ({ ...prev, ...initialCategories }));
  }, [groups]);

  // Auto-open dialog and expand focused group when groups are loaded
  useEffect(() => {
    if (focusedGroupId && groups.length > 0) {
      const matchingGroup = groups.find(g => g.groupId === focusedGroupId);
      if (matchingGroup) {
        setActiveGroupId(focusedGroupId);
        // Auto-expand the focused group
        setExpandedGroups(prev => new Set([...prev, focusedGroupId]));
      }
    }
  }, [focusedGroupId, groups]);

  // Scroll focused group into view
  useEffect(() => {
    if (focusedGroupId) {
      const ref = groupRefs.current.get(focusedGroupId);
      if (ref) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [focusedGroupId, groups]);

  const handleMarkPassThrough = async (group: ReimbursementGroup) => {
    // Show confirmation for ambiguous mixed groups
    if (isAmbiguousMixedGroup(group)) {
      const confirmed = window.confirm(
        'Dieses Muster ist nur schwach erkannt und enthält eingehende und ausgehende Zahlungen. Bist du sicher, dass du alle Buchungen als durchlaufende Posten markieren möchtest?'
      );
      if (!confirmed) {
        return;
      }
    }

    const allIds = [...group.inflows.map(tx => tx.id), ...group.outflows.map(tx => tx.id)];
    
    addSubmittingGroup(group.groupId);
    
    try {
      await markPassThrough(allIds);
      // Mark as resolved and collapse
      updateResolvedGroupIds(prev => {
        const next = new Set(prev);
        next.add(group.groupId);
        return next;
      });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(group.groupId);
        return next;
      });
      // Trigger achievement evaluation in background
      void evaluateQuietly();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Markieren als durchlaufende Posten');
      // Show error for a few seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      removeSubmittingGroup(group.groupId);
    }
  };

  const handleIgnoreGroup = async (group: ReimbursementGroup, showConfirm = true) => {
    if (showConfirm) {
    const confirmed = window.confirm(
        'Diese Buchungen werden nicht als Erstattung behandelt. Beide bleiben als normale Buchungen in deinen Auswertungen. Fortfahren?'
    );
    if (!confirmed) {
      return;
      }
    }

    addSubmittingGroup(group.groupId);
    
    try {
      await ignoreReimbursementGroup(group.groupId);
      // Mark as resolved and collapse
      updateResolvedGroupIds(prev => {
        const next = new Set(prev);
        next.add(group.groupId);
        return next;
      });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(group.groupId);
        return next;
      });
      // Trigger achievement evaluation in background
      void evaluateQuietly();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Ignorieren der Gruppe');
      // Show error for a few seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      removeSubmittingGroup(group.groupId);
    }
  };

  // Handler for dialog callbacks
  const handleMarkPassThroughFromDialog = async (group: ReimbursementGroup) => {
    // Show confirmation for ambiguous mixed groups
    if (isAmbiguousMixedGroup(group)) {
      const confirmed = window.confirm(
        'Dieses Muster ist nur schwach erkannt und enthält eingehende und ausgehende Zahlungen. Bist du sicher, dass du alle Buchungen als durchlaufende Posten markieren möchtest?'
      );
      if (!confirmed) {
        return;
      }
    }

    const allIds = [...group.inflows.map(tx => tx.id), ...group.outflows.map(tx => tx.id)];
    
    addSubmittingGroup(group.groupId);
    
    try {
      await markPassThrough(allIds);
      // Mark as resolved and collapse
      updateResolvedGroupIds(prev => {
        const next = new Set(prev);
        next.add(group.groupId);
        return next;
      });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(group.groupId);
        return next;
      });
      setActiveGroupId(null);
      // Trigger achievement evaluation in background
      void evaluateQuietly();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Markieren als durchlaufende Posten');
      setTimeout(() => setError(null), 5000);
    } finally {
      removeSubmittingGroup(group.groupId);
    }
  };

  const handleIgnoreFromDialog = async (group: ReimbursementGroup) => {
    addSubmittingGroup(group.groupId);
    
    try {
      await ignoreReimbursementGroup(group.groupId);
      // Mark as resolved and collapse
      updateResolvedGroupIds(prev => {
        const next = new Set(prev);
        next.add(group.groupId);
        return next;
      });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(group.groupId);
        return next;
      });
      setActiveGroupId(null);
      // Trigger achievement evaluation in background
      void evaluateQuietly();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Ignorieren der Gruppe');
      setTimeout(() => setError(null), 5000);
    } finally {
      removeSubmittingGroup(group.groupId);
    }
  };

  const handleAllocationsSavedFromDialog = async () => {
    // Refresh groups to show updated allocations
    await loadGroups();
  };

  const formatDateShort = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        // Also hide details when collapsing
        setShowDetailsForGroup(prevDetails => {
          const nextDetails = new Set(prevDetails);
          nextDetails.delete(groupId);
          return nextDetails;
        });
      } else {
        next.add(groupId);
        // Initialize decision to 'refund' when expanding
        setComplexDecisions(prev => {
          if (!(groupId in prev)) {
            return { ...prev, [groupId]: 'refund' };
          }
          return prev;
        });
      }
      return next;
    });
  };

  const toggleDetails = (groupId: string) => {
    setShowDetailsForGroup(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Category helpers
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

  const getCategoryLabel = (categoryId: string | null): string => {
    if (!categoryId) return 'Kategorie wählen';
    const category = categories.find(c => c.id === categoryId);
    return category?.labelDe || categoryId;
  };

  const getCategoryColor = (categoryId: string | null): string => {
    if (!categoryId) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
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

  // Allocation helper functions
  const computeAllocationTotals = (draft: Record<string, number>, inflowAmountCents: number) => {
    const totalAllocatedCents = Object.values(draft).reduce((sum, v) => sum + (v ?? 0), 0);
    const remainingCents = inflowAmountCents - totalAllocatedCents;
    const isOverAllocated = remainingCents < -50; // less than -50 cents
    return { totalAllocatedCents, remainingCents, isOverAllocated };
  };

  // Handler to open allocation wizard
  const handleOpenAllocationWizard = (groupId: string, inflowId: number, suggestions?: SuggestedAllocation[]) => {
    setAllocationEditor({ groupId, inflowId });
    
    const group = groups.find(g => g.groupId === groupId);
    if (!group) return;

    const inflow = group.inflows.find(inf => inf.id === inflowId);
    if (!inflow) return;

    // Initialize from existing allocations or suggestions
    const existingAllocations = group.allocations?.filter(a => a.inflowTransactionId === String(inflowId)) ?? [];
    const nextDraft: Record<string, number> = {};
    const nextRaw: Record<string, string> = {};

    if (suggestions && suggestions.length > 0) {
      // Use suggestions
      for (const sugg of suggestions) {
        nextDraft[sugg.expenseId] = sugg.amountCents;
        nextRaw[sugg.expenseId] = formatCentsToEuroInput(sugg.amountCents);
      }
    } else if (existingAllocations.length > 0) {
      // Use existing allocations
      for (const alloc of existingAllocations) {
        nextDraft[alloc.expenseTransactionId] = alloc.allocatedAmountCents;
        nextRaw[alloc.expenseTransactionId] = formatCentsToEuroInput(alloc.allocatedAmountCents);
      }
    }

    setAllocationDraft(nextDraft);
    setAllocationInputRaw(nextRaw);
  };

  // Handler to close allocation wizard without saving
  const handleCloseAllocationWizard = () => {
    setAllocationEditor(null);
    // Optionally clear drafts if you don't want to keep them
  };

  // Handler to save allocations
  const handleSaveAllocations = async () => {
    if (!allocationEditor || isSavingAllocation) return;

    const group = groups.find(g => g.groupId === allocationEditor.groupId);
    if (!group) return;

    const inflow = group.inflows.find(inf => inf.id === allocationEditor.inflowId);
    if (!inflow) return;

    const { isOverAllocated } = computeAllocationTotals(allocationDraft, inflow.amountCents);
    if (isOverAllocated) return; // Don't save if over-allocated

    setIsSavingAllocation(true);
    try {
      const allocations = Object.entries(allocationDraft)
        .filter(([, amount]) => amount && amount > 0)
        .map(([expenseId, amount]) => ({
          expenseTransactionId: expenseId,
          allocatedAmountCents: amount,
        }));

      await saveReimbursementAllocations(group.groupId, String(inflow.id), allocations);
      
      // Mark as resolved and collapse
      updateResolvedGroupIds(prev => {
        const next = new Set(prev);
        next.add(group.groupId);
        return next;
      });
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(group.groupId);
        return next;
      });
      
      // Refresh groups to show updated allocations
      await loadGroups();
      
      // Close wizard and ensure Level-1 decision is set to reimbursement
      setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'refund' }));
      setAllocationEditor(null);
      // Trigger achievement evaluation in background
      void evaluateQuietly();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern der Verknüpfung');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSavingAllocation(false);
    }
  };

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

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getConfidenceBadge = (confidence: number) => {
    const level = getConfidenceLevel(confidence);
    if (level === 'high') {
      return {
        label: 'Hohe Sicherheit',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/40',
      };
    } else if (level === 'medium') {
      return {
        label: 'Unsicher – bitte prüfen',
        className: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/40',
      };
    } else {
      return {
        label: 'Niedrige Sicherheit',
        className: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/40',
      };
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 sm:p-5 lg:p-6">
        <div className="text-sm text-slate-600 dark:text-slate-400">Lade Erstattungen…</div>
      </div>
    );
  }

  if (error && groups.length === 0) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 sm:p-5 lg:p-6">
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</div>
        <button
          onClick={loadGroups}
          className="rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-nf-primary hover:shadow-glow-primary"
        >
          Erneut laden
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm shadow-elevated dark:shadow-elevated p-4 sm:p-5 lg:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Erstattungen & Durchlaufende Posten</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Gruppierte Rückzahlungen und mögliche durchlaufende Posten.
        </p>
      </div>

      {/* Progress Strip */}
      {(() => {
        const totalGroups = groups.length;
        const openGroups = groups.filter(g => !resolvedGroupIds.has(g.groupId));
        const openCount = openGroups.length;
        const completedCount = totalGroups - openCount;
        const completionRatio = totalGroups > 0 ? completedCount / totalGroups : 0;

        if (totalGroups > 0) {
          return (
            <div className="mb-4 rounded-3xl border border-nf-primary/30 bg-nf-primary-soft backdrop-blur-sm px-3.5 py-3 text-xs text-nf-text-main shadow-elevated dark:shadow-elevated">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">💸</span>
                  <span className="font-medium tracking-tight">Erstattungen prüfen</span>
                </div>
                <div className="text-[0.72rem] font-medium text-slate-600 dark:text-slate-300">
                  {completedCount} erledigt · {openCount} offen
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-nf-primary transition-[width] duration-400 ease-out"
                  style={{ width: `${Math.min(100, Math.round(completionRatio * 100))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[0.7rem] text-slate-600 dark:text-slate-300">
                {openCount > 0
                  ? `Noch ${openCount} Abrechnungen – du bist fast durch. 🙌`
                  : totalGroups > 0
                  ? 'Alles erledigt – super! Neue Erstattungen landen automatisch hier. ✨'
                  : 'Aktuell gibt es hier nichts zu tun. Wenn Erstattungen erkannt werden, landen sie automatisch in diesem Bereich.'}
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* Counterparty Summary */}
      {(() => {
        const summaries = computeCounterpartySummaries(groups);
        const topSummaries = summaries.filter(s => Math.abs(s.netImpactCents) >= 50).slice(0, 3);
        const hasSignificantBalances = topSummaries.length > 0;

        if (!hasSignificantBalances && summaries.length > 0) {
          return (
            <div className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              Aktuell sind deine Erstattungen weitgehend ausgeglichen.
            </div>
          );
        }

        if (!hasSignificantBalances) {
          return null;
        }

        return (
          <div className="mb-4">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
              Wer steht wie bei dir?
            </div>
            <div className="flex flex-wrap gap-2">
              {topSummaries.map((summary) => {
                const absNet = Math.abs(summary.netImpactCents);
                const isPositive = summary.netImpactCents > 0;
                const isBalanced = absNet < 50;

                let text: string;
                let colorClass: string;

                if (isBalanced) {
                  text = `${summary.name}: ausgeglichen`;
                  colorClass = 'text-slate-600 dark:text-slate-300';
                } else if (isPositive) {
                  text = `${summary.name}: +${formatCurrency(summary.netImpactCents / 100)} (du trägst mehr)`;
                  colorClass = 'text-amber-700 dark:text-amber-300';
                } else {
                  text = `${summary.name}: –${formatCurrency(absNet / 100)} (sie trägt mehr)`;
                  colorClass = 'text-emerald-700 dark:text-emerald-300';
                }

                return (
                  <span
                    key={summary.name}
                    className={`inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-xs ${colorClass}`}
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {(() => {
        const openGroups = groups.filter(g => !resolvedGroupIds.has(g.groupId));
        const resolvedGroups = groups.filter(g => resolvedGroupIds.has(g.groupId));

        if (groups.length === 0) {
          return (
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Derzeit keine offenen Erstattungs-Gruppen.
            </div>
          );
        }

        const renderGroup = (group: ReimbursementGroup) => {
            const isSubmitting = isGroupSubmitting(group.groupId);
            const allIds = [...group.inflows.map(tx => tx.id), ...group.outflows.map(tx => tx.id)];
            const isFocused = focusedGroupId === group.groupId;

            const isExpanded = expandedGroups.has(group.groupId);
            const highConfidence = group.confidence !== undefined && group.confidence >= 60;

            return (
              <div
                key={group.groupId}
                ref={(el) => {
                  if (el) {
                    groupRefs.current.set(group.groupId, el);
                  } else {
                    groupRefs.current.delete(group.groupId);
                  }
                }}
                id={`reimbursement-group-${group.groupId}`}
                className={`rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-3 md:px-4 md:py-4 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-2xl dark:shadow-elevated ${
                  isFocused || isExpanded
                    ? 'border-nf-primary/40 ring-1 ring-nf-primary/20'
                    : 'border-nf-border-subtle hover:border-nf-primary/40'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  {/* Left: avatar + title + summary + chips */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-nf-primary text-xs font-semibold text-white flex-shrink-0">
                      {getInitials(group.counterpartName || 'Unbekannter Kontakt')}
                      </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      {/* Counterpart name + confidence pill */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-50">
                          {group.counterpartName || 'Unbekannter Kontakt'}
                        </span>
                      {group.confidence !== undefined && (
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${getConfidenceBadge(group.confidence).className}`}
                          title={`Konfidenz: ${group.confidence}%`}
                        >
                          {getConfidenceBadge(group.confidence).label}
                          <span className="text-[10px] opacity-75">({group.confidence}%)</span>
                        </span>
                      )}
                    </div>
                      
                      {/* Short summary text */}
                      {group.netImpactCents !== undefined && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {Math.abs(group.netImpactCents) > 50 ? (
                            group.netImpactCents > 0 ? (
                              <>Netto-Auswirkung: Du hast in dieser Gruppe effektiv {formatCurrency(group.netImpactCents / 100)} ausgegeben.</>
                            ) : (
                              <>Netto-Auswirkung: Du hast in dieser Gruppe effektiv {formatCurrency(Math.abs(group.netImpactCents) / 100)} erhalten.</>
                            )
                          ) : (
                            <>Netto-Auswirkung: Diese Gruppe ist praktisch ausgeglichen.</>
                          )}
                        </p>
                      )}

                      {/* Chips row */}
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5">
                          {group.txCount} Buchung{group.txCount !== 1 ? 'en' : ''}
                        </span>
                        {group.totalOutflowCents > 0 && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5">
                            Ausgänge: {formatCurrency(-group.totalOutflowCents / 100)}
                          </span>
                        )}
                        {group.totalInflowCents > 0 && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5">
                            Eingänge: {formatCurrency(group.totalInflowCents / 100)}
                          </span>
                        )}
                        {group.netImpactCents !== undefined && Math.abs(group.netImpactCents) > 50 && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                            group.netImpactCents > 0
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                          }`}>
                            Netto: {formatCurrency(Math.abs(group.netImpactCents) / 100)}
                          </span>
                        )}
                    </div>

                    {/* Ambiguous mixed group warning */}
                    {isAmbiguousMixedGroup(group) && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                        ⚠️ Dieses Muster ist unsicher – vermutlich sind hier mehrere unabhängige Zahlungen vermischt.
                      </p>
                    )}
                    {/* Focus hint */}
                    {isFocused && (
                      <p className="mt-1 text-xs font-medium text-sky-600 dark:text-sky-300">
                        Ausgewählt von der Buchungsliste
                      </p>
                        )}
                      </div>
                  </div>

                  {/* Right: primary CTA + details link */}
                  <div className="mt-2 flex flex-row items-center justify-between gap-2 md:mt-0 md:flex-col md:items-end">
                    <button
                      onClick={() => toggleExpanded(group.groupId)}
                      disabled={isSubmitting}
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                        isSubmitting
                          ? 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300 cursor-default'
                          : highConfidence
                          ? 'bg-nf-primary text-white hover:bg-nf-primary hover:shadow-glow-primary'
                          : 'bg-slate-900 text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                      }`}
                    >
                      {expandedGroups.has(group.groupId) ? 'Weniger' : 'Details anzeigen'}
                    </button>
                  </div>
                </div>

                {/* Expanded view for complex groups */}
                {expandedGroups.has(group.groupId) && !isSimpleInflowOnlyGroup(group) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    {/* Story Header */}
                    <div className="mt-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-3 py-3 md:px-4 md:py-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="text-sm md:text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                          Abrechnung mit {group.counterpartName || 'dieser Person'}
                      </h3>
                        {group.primaryCategoryLabel && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 px-2 py-0.5 text-[11px]">
                            {group.primaryCategoryLabel}
                          </span>
                        )}
                      </div>
                      {group.netImpactCents !== undefined && Math.abs(group.netImpactCents) > 50 ? (
                        group.netImpactCents > 0 ? (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Du hast insgesamt {formatCurrency(group.totalOutflowCents / 100)} ausgegeben und{' '}
                            {formatCurrency(group.totalInflowCents / 100)} zurückbekommen.{' '}
                            <span className="font-semibold">
                              Aktuell trägst du etwa {formatCurrency(group.netImpactCents / 100)} € selbst.
                                </span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Du hast insgesamt {formatCurrency(group.totalOutflowCents / 100)} ausgegeben und{' '}
                            {formatCurrency(group.totalInflowCents / 100)} zurückbekommen.{' '}
                            <span className="font-semibold">
                              Aktuell hast du netto etwa {formatCurrency(Math.abs(group.netImpactCents) / 100)} € zurückbekommen.
                            </span>
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Du hast insgesamt {formatCurrency(group.totalOutflowCents / 100)} ausgegeben und{' '}
                          {formatCurrency(group.totalInflowCents / 100)} zurückbekommen. Diese Gruppe ist praktisch ausgeglichen.
                          </p>
                        )}
                      </div>

                    {/* Level-1 Decision Card */}
                    <div className="mt-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-3 md:px-4 md:py-4 space-y-3 shadow-elevated dark:shadow-elevated">
                      {/* Step label + title */}
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Schritt 1 von 2
                          </p>
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-50">
                            Wie soll das in deinen Auswertungen erscheinen?
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                      {/* Option 1: Als Erstattung verknüpfen */}
                      <button
                        type="button"
                        onClick={() => setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'refund' }))}
                        disabled={isSubmitting}
                          className={`w-full flex items-start gap-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2 text-left transition-all duration-200 ease-out hover:-translate-y-[1px] ${
                          (complexDecisions[group.groupId] ?? 'refund') === 'refund'
                              ? 'border-nf-primary/50 bg-nf-primary-soft'
                              : 'hover:border-nf-primary/40'
                        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                          <span className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border flex-shrink-0 ${
                            (complexDecisions[group.groupId] ?? 'refund') === 'refund'
                              ? 'border-nf-primary bg-nf-primary'
                              : 'border-nf-border-subtle bg-nf-bg-card'
                          }`}>
                            {(complexDecisions[group.groupId] ?? 'refund') === 'refund' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="inline-flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-50">
                              Als Erstattung verknüpfen
                            </span>
                            {(group.confidence === undefined || group.confidence >= 60) && (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Empfohlen
                              </span>
                                      )}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-600 dark:text-slate-400">
                            Die Rückzahlung wird mit der Ausgabe verrechnet. In deinen Auswertungen siehst du später nur die Netto-Kosten.
                            </span>
                          </span>
                      </button>

                      {/* Option 2: Getrennt behandeln */}
                                  <button
                                    type="button"
                        onClick={() => setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'separate' }))}
                        disabled={isSubmitting}
                          className={`w-full flex items-start gap-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2 text-left transition-all duration-200 ease-out hover:-translate-y-[1px] ${
                          complexDecisions[group.groupId] === 'separate'
                              ? 'border-nf-primary/50 bg-nf-primary-soft'
                              : 'hover:border-nf-primary/40'
                        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                          <span className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border flex-shrink-0 ${
                            complexDecisions[group.groupId] === 'separate'
                              ? 'border-nf-primary bg-nf-primary'
                              : 'border-nf-border-subtle bg-nf-bg-card'
                          }`}>
                            {complexDecisions[group.groupId] === 'separate' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="text-xs font-medium text-slate-900 dark:text-slate-50">
                            Getrennt behandeln
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-600 dark:text-slate-400">
                              Beide Buchungen bleiben eigenständig. Du siehst eine Ausgabe und eine Einnahme (Erstattung) in deinen Auswertungen.
                            </span>
                          </span>
                      </button>
                                        </div>

                    {/* Ambiguous / low-confidence hint */}
                      {group.confidence !== undefined && (
                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                          {group.confidence < 50 ? (
                        <p>Hinweis: Dieses Muster ist unsicher – schau kurz, ob es wirklich eine Erstattung ist. Du kannst es später jederzeit ändern.</p>
                      ) : (
                        <p>Du kannst diese Entscheidung später jederzeit rückgängig machen.</p>
                                          )}
                                        </div>
                      )}

                      {/* Details & Anteile anpassen button */}
                      {(complexDecisions[group.groupId] ?? 'refund') === 'refund' && group.inflows.length > 0 && (
                        <div className="mt-2">
                                          <button
                                            type="button"
                            onClick={() => {
                              const firstInflow = group.inflows[0];
                              handleOpenAllocationWizard(group.groupId, firstInflow.id);
                            }}
                            disabled={isSubmitting || isSavingAllocation}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Details & Anteile anpassen…
                                          </button>
                        </div>
                      )}
                    </div>

                    {/* Nimbus suggestion bar */}
                    {group.inflows.length > 0 && group.outflows.length > 0 && (() => {
                      const firstInflow = group.inflows[0];
                      if (!firstInflow) return null;
                      const suggestions = getSuggestedAllocationsForInflow(group, firstInflow);
                      const existingAllocations = group.allocations?.filter(a => a.inflowTransactionId === String(firstInflow.id)) ?? [];
                      const shouldShowSuggestion = suggestions.length > 0 && existingAllocations.length === 0 && (complexDecisions[group.groupId] ?? 'refund') === 'refund';

                      return shouldShowSuggestion ? (
                        <div className="mt-3 rounded-3xl border border-nf-primary/30 bg-nf-primary-soft backdrop-blur-sm px-3 py-3 md:px-4 md:py-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                                💡 Nimbus-Vorschlag
                              </p>
                              <p className="text-xs text-slate-700 dark:text-slate-100">
                                Wir würden diese Erstattung hauptsächlich auf{' '}
                                {suggestions.slice(0, 2).map(s => {
                                  const expense = group.outflows.find(e => String(e.id) === s.expenseId);
                                  return expense ? formatCurrency(Math.abs(expense.amountCents) / 100) : '';
                                }).filter(Boolean).join(' und ')}{' '}
                                verteilen.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <button
                                type="button"
                                onClick={async () => {
                                  setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'refund' }));
                                  try {
                                    setIsSavingAllocation(true);
                                    const allocations = suggestions.map(s => ({
                                      expenseTransactionId: s.expenseId,
                                      allocatedAmountCents: s.amountCents,
                                    }));
                                    await saveReimbursementAllocations(group.groupId, String(firstInflow.id), allocations);
                                    // Mark as resolved and collapse
                                    updateResolvedGroupIds(prev => {
                                      const next = new Set(prev);
                                      next.add(group.groupId);
                                      return next;
                                    });
                                    setExpandedGroups(prev => {
                                      const next = new Set(prev);
                                      next.delete(group.groupId);
                                      return next;
                                    });
                                    await loadGroups();
                                    // Trigger achievement evaluation in background
                                    void evaluateQuietly();
                                  } catch (err: any) {
                                    setError(err?.message || 'Fehler beim Speichern der Verknüpfung');
                                    setTimeout(() => setError(null), 5000);
                                  } finally {
                                    setIsSavingAllocation(false);
                                  }
                                }}
                                disabled={isSubmitting || isSavingAllocation}
                                className="inline-flex items-center rounded-full bg-nf-primary text-white px-3 py-1.5 hover:bg-nf-primary hover:shadow-glow-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Zahlung verknüpfen
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'refund' }));
                                  handleOpenAllocationWizard(group.groupId, firstInflow.id, suggestions);
                                }}
                                disabled={isSubmitting || isSavingAllocation}
                                className="inline-flex items-center rounded-full border border-nf-primary/50 text-nf-text-main px-3 py-1.5 hover:bg-nf-primary-soft transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Fein anpassen
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-[11px] text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                            onClick={() => {
                              setComplexDecisions(prev => ({ ...prev, [group.groupId]: 'separate' }));
                            }}
                            disabled={isSubmitting || isSavingAllocation}
                          >
                            Kein Zusammenhang
                          </button>
                        </div>
                      ) : null;
                    })()}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 mb-4">
                                          <button
                                            type="button"
                                            onClick={async () => {
                            const decision = complexDecisions[group.groupId] ?? 'refund';
                            if (decision === 'refund') {
                              await handleMarkPassThrough(group);
                              setExpandedGroups(prev => {
                                const next = new Set(prev);
                                next.delete(group.groupId);
                                return next;
                              });
                            } else {
                              await handleIgnoreGroup(group, true);
                              setExpandedGroups(prev => {
                                const next = new Set(prev);
                                next.delete(group.groupId);
                                return next;
                              });
                            }
                          }}
                          disabled={isSubmitting}
                          className="rounded-md bg-nf-primary px-4 py-2 text-sm font-medium text-white hover:bg-nf-primary hover:shadow-glow-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {isSubmitting ? 'Wird gespeichert…' : 'Speichern'}
                                          </button>
                                        </div>

                    {/* Level 2: Wizard or Two-column details */}
                    {allocationEditor && allocationEditor.groupId === group.groupId ? (() => {
                      const currentInflow = group.inflows.find(inf => inf.id === allocationEditor.inflowId);
                      if (!currentInflow) return null;

                      const { totalAllocatedCents, remainingCents, isOverAllocated } = computeAllocationTotals(
                        allocationDraft,
                        currentInflow.amountCents
                      );

                      return (
                        <div className="mt-3 rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-3 md:px-4 md:py-4 space-y-3 shadow-elevated dark:shadow-elevated">
                          {/* Wizard Header */}
                          <div>
                            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                              Zahlung verknüpfen
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Verteile diese Erstattung auf deine Ausgaben. Nimbus rechnet für dich mit.
                            </p>
                                      </div>

                          {/* Inflow chip */}
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs dark:border-emerald-800 dark:bg-emerald-900/30">
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">
                              {formatDateShort(currentInflow.bookingDate)}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
                              {currentInflow.purpose || 'Unbekannt'}
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              +{formatCurrency(currentInflow.amountCents / 100)}
                            </span>
                          </div>

                          {/* Summary stripe */}
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 px-3 py-2 text-[11px] flex flex-wrap gap-3 justify-between">
                        <div>
                              <div className="text-slate-600 dark:text-slate-400">Erstattung:</div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(currentInflow.amountCents / 100)}
                          </div>
                            </div>
                            <div>
                              <div className="text-slate-600 dark:text-slate-400">Davon verteilt:</div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(totalAllocatedCents / 100)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-600 dark:text-slate-400">Übrig:</div>
                              <div className={`font-semibold ${isOverAllocated ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                {formatCurrency(remainingCents / 100)}
                              </div>
                            </div>
                          </div>

                            {/* Expense rows */}
                            <div className="space-y-3 mb-4">
                              {group.outflows.map(exp => {
                                const expenseId = String(exp.id);
                                const categoryId = expenseCategories[expenseId] ?? exp.category;
                                const isEditing = categoryEditingId === expenseId;
                                const allocationValue = allocationDraft[expenseId] ?? 0;
                                const rawValue = allocationInputRaw[expenseId] ?? '';

                                // Compute max allocatable
                                const expenseAmount = Math.abs(exp.amountCents);
                                // Available = what's left in inflow + what's already allocated to this expense
                                const availableForThisExpense = Math.max(0, remainingCents + allocationValue);
                                const maxAllocatable = Math.min(expenseAmount, availableForThisExpense);

                                return (
                                  <div
                                    key={exp.id}
                                    className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-3 py-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                                  >
                                      <div className="flex-1 min-w-0">
                                        {/* Category pill */}
                                        <div className="mb-2 relative inline-block">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCategoryEditingId(isEditing ? null : expenseId);
                                            }}
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition ${getCategoryColor(categoryId)}`}
                                          >
                                            {getCategoryLabel(categoryId)}
                                          </button>
                                          
                                          {isEditing && (
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

                                        {/* Date and purpose */}
                                        <div className="text-xs font-medium text-slate-800 dark:text-slate-100 mb-1">
                                          {formatDateShort(exp.bookingDate)} · {exp.purpose || 'Unbekannt'}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Ursprünglich: {formatCurrency(expenseAmount / 100)}
                                        </div>
                                      </div>

                                      {/* Allocation control */}
                                      <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            placeholder="0,00"
                                            value={rawValue}
                                            onChange={(e) => {
                                              const newRaw = e.target.value;
                                              setAllocationInputRaw(prev => ({ ...prev, [expenseId]: newRaw }));
                                              const parsed = parseEuroInputToCents(newRaw);
                                              if (parsed !== null) {
                                                setAllocationDraft(prev => ({ ...prev, [expenseId]: parsed }));
                                              } else if (newRaw === '') {
                                                setAllocationDraft(prev => {
                                                  const next = { ...prev };
                                                  delete next[expenseId];
                                                  return next;
                                                });
                                              }
                                            }}
                                            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                          />
                                          <span className="text-xs text-slate-600 dark:text-slate-400">€</span>
                                        </div>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newValue = Math.round(maxAllocatable / 2);
                                              setAllocationDraft(prev => ({ ...prev, [expenseId]: newValue }));
                                              setAllocationInputRaw(prev => ({ ...prev, [expenseId]: formatCentsToEuroInput(newValue) }));
                                            }}
                                            disabled={maxAllocatable <= 0}
                                            className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                          >
                                            50 %
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newValue = maxAllocatable;
                                              setAllocationDraft(prev => ({ ...prev, [expenseId]: newValue }));
                                              setAllocationInputRaw(prev => ({ ...prev, [expenseId]: formatCentsToEuroInput(newValue) }));
                                            }}
                                            disabled={maxAllocatable <= 0}
                                            className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                          >
                                            100 %
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setAllocationDraft(prev => {
                                                const next = { ...prev };
                                                delete next[expenseId];
                                                return next;
                                              });
                                              setAllocationInputRaw(prev => {
                                                const next = { ...prev };
                                                delete next[expenseId];
                                                return next;
                                              });
                                            }}
                                            className="rounded px-2 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 transition"
                                          >
                                            Löschen
                                          </button>
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                          Dein Anteil aus dieser Erstattung
                                        </div>
                                      </div>
                                    </div>
                                );
                              })}
                            </div>

                            {/* Completion hint */}
                            <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                              {!isOverAllocated && remainingCents >= 0 && remainingCents <= 50 ? (
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                  ✅ Diese Erstattung ist sauber verteilt.
                                </p>
                              ) : isOverAllocated ? (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  ⚠️ Du hast mehr verteilt als mit dieser Erstattung zurückgezahlt wurde. Bitte passe die Beträge an.
                                </p>
                              ) : (
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Du kannst auch nur einen Teil der Erstattung zuordnen – der Rest bleibt allgemeine Einnahme.
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={handleCloseAllocationWizard}
                                disabled={isSavingAllocation}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                Zurück zur Übersicht
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveAllocations}
                                disabled={isSavingAllocation || isOverAllocated}
                                className="rounded-md bg-nf-primary px-4 py-2 text-sm font-medium text-white hover:bg-nf-primary hover:shadow-glow-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                              >
                                {isSavingAllocation ? 'Wird gespeichert…' : 'Abrechnung übernehmen'}
                              </button>
                            </div>
                          </div>
                      );
                    })() : (
                      /* Show two-column layout */
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {/* Deine Ausgaben */}
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
                                    className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-3 py-2 space-y-1"
                                      >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                                            {formatDateShort(exp.bookingDate)} · {exp.purpose || 'Unbekannt'}
                                          </div>
                                        </div>
                                          <div className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                                            –{formatCurrency(Math.abs(exp.amountCents) / 100)}
                                      </div>
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
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Erstattungen & Rückzahlungen */}
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                Erstattungen & Rückzahlungen
                              </div>
                              <div className="space-y-2">
                                {group.inflows.map(inflow => (
                                  <div
                                    key={inflow.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-3 py-2"
                                  >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                                        {formatDateShort(inflow.bookingDate)} · {inflow.purpose || 'Unbekannt'}
                                      </div>
                                    </div>
                                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                      +{formatCurrency(inflow.amountCents / 100)}
                                  </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                        </div>
                      </div>
                    )}
                        </div>
                )}
                                        </div>
                                      );
        };

        return (
          <>
            {/* Open Groups */}
            {openGroups.length > 0 && (
              <div className="space-y-3">
                {openGroups.map(renderGroup)}
              </div>
            )}

            {/* Resolved Groups */}
            {resolvedGroups.length > 0 && (
              <div className="mt-4 rounded-3xl border border-nf-border-subtle bg-nf-bg-card-subtle backdrop-blur-sm px-3 py-2.5 text-xs text-nf-text-muted shadow-elevated dark:shadow-elevated">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✅</span>
                      <span className="font-medium">
                        Erledigte Abrechnungen ({resolvedGroups.length})
                      </span>
                    </div>
                    <span className="text-[0.7rem] text-slate-500 group-open:hidden dark:text-slate-400">
                      Anzeigen
                    </span>
                    <span className="hidden text-[0.7rem] text-slate-500 group-open:inline dark:text-slate-400">
                      Ausblenden
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {resolvedGroups.map(group => (
                      <div
                        key={group.groupId}
                        className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm px-3 py-2 text-[0.72rem] text-nf-text-muted"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {group.counterpartName ?? 'Unbekannte Person'}
                          </span>
                          <span className="font-mono text-[0.7rem] text-slate-500">
                            {group.txCount} Buchungen
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </>
        );
      })()}

      {/* Dialog for linking payments */}
      {activeGroupId && (() => {
        const activeGroup = groups.find(g => g.groupId === activeGroupId);
        if (!activeGroup) return null;

        return (
          <ReimbursementLinkDialog
            group={activeGroup}
            isOpen={!!activeGroupId}
            onClose={() => setActiveGroupId(null)}
            onMarkedAsPassThrough={() => handleMarkPassThroughFromDialog(activeGroup)}
            onIgnoredAsNormal={() => handleIgnoreFromDialog(activeGroup)}
            onAllocationsSaved={handleAllocationsSavedFromDialog}
          />
                  );
                })()}
    </div>
  );
};
