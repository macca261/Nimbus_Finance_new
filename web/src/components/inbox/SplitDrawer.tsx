/**
 * SplitDrawer Component
 * 
 * Bottom drawer for splitting transactions into multiple category allocations.
 * Handles the "PayPal Reimbursement" use case (+€20 Inflow -> Split into multiple contra-expenses).
 * 
 * Uses React Hook Form with useFieldArray for dynamic split rows.
 * Style: "Thin Utility" - minimal borders, focus rings
 */

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

export interface SplitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: number;
    amountCents: number;
    payee?: string | null;
    memo?: string | null;
  };
  onSaved?: () => void;
  isPayPalReimbursement?: boolean;
}

interface SplitFormData {
  splits: Array<{
    categoryId: string;
    amountCents: number;
    memo: string;
  }>;
}

export const SplitDrawer: React.FC<SplitDrawerProps> = ({
  isOpen,
  onClose,
  transaction,
  onSaved,
  isPayPalReimbursement = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<Array<{
    categoryId: string;
    category: string;
    count: number;
    totalAmount: number;
  }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SplitFormData>({
    defaultValues: {
      splits: [
        {
          categoryId: '',
          amountCents: 0,
          memo: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'splits',
  });

  const watchedSplits = watch('splits');
  const totalSplit = watchedSplits.reduce((sum, split) => sum + (split.amountCents || 0), 0);
  const remaining = transaction.amountCents - totalSplit;
  const isBalanced = remaining === 0;

  // Load existing splits when drawer opens
  useEffect(() => {
    if (isOpen && transaction.id) {
      axios
        .get(`/api/splits/${transaction.id}`)
        .then((res) => {
          if (res.data.splits && res.data.splits.length > 0) {
            reset({
              splits: res.data.splits.map((split: any) => ({
                categoryId: split.categoryId || '',
                amountCents: split.amountCents,
                memo: split.memo || '',
              })),
            });
          } else {
            // Initialize with one empty split
            reset({
              splits: [
                {
                  categoryId: '',
                  amountCents: transaction.amountCents,
                  memo: '',
                },
              ],
            });
          }
        })
        .catch(() => {
          // If no splits exist, initialize with full amount (amount in EUR for display)
          reset({
            splits: [
              {
                categoryId: '',
                amountCents: transaction.amountCents, // Will be converted to EUR in input
                memo: '',
              },
            ],
          });
        });

      // Load category suggestions for PayPal reimbursements
      if (isPayPalReimbursement) {
        loadCategorySuggestions();
      }
    }
  }, [isOpen, transaction.id, transaction.amountCents, isPayPalReimbursement, reset]);

  const loadCategorySuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await axios.get('/api/inbox/suggest-categories', {
        params: { amountCents: transaction.amountCents },
      });
      setSuggestedCategories(res.data.suggestions || []);
    } catch (err) {
      console.error('[SplitDrawer] Failed to load suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestCategories = () => {
    if (suggestedCategories.length === 0) return;

    // Pre-fill splits with suggested categories
    const totalAmount = transaction.amountCents / 100;
    const amountPerCategory = totalAmount / suggestedCategories.length;

    reset({
      splits: suggestedCategories.map((suggestion) => ({
        categoryId: suggestion.categoryId,
        amountCents: Math.round(amountPerCategory * 100), // Convert to cents
        memo: '',
      })),
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const handleDistributeRemainder = (index: number) => {
    const currentSplits = watch('splits');
    const currentValue = currentSplits[index]?.amountCents || 0;
    const newValue = currentValue + remaining;
    
    // Update the split at this index using setValue
    const { setValue } = control;
    setValue(`splits.${index}.amountCents`, newValue, { shouldValidate: true });
  };

  const onSubmit = async (data: SplitFormData) => {
    if (!isBalanced) {
      setError('Sum of splits must equal transaction amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Use the new inbox/distribute endpoint
      await axios.post('/api/inbox/distribute', {
        transactionId: transaction.id,
        allocations: data.splits.map((split) => ({
          categoryId: split.categoryId || '',
          amount: split.amountCents / 100, // Convert cents to EUR
        })),
      });

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save splits');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-zinc-900">
              Distribute {formatCurrency(transaction.amountCents)}
            </h2>
            {isPayPalReimbursement && (
              <p className="text-xs text-zinc-500 mt-1">
                PayPal Reimbursement - Split into contra-expenses
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors duration-200"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* PayPal Suggestions */}
            {isPayPalReimbursement && suggestedCategories.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">
                      Suggested Categories
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSuggestCategories}
                    className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors duration-200"
                  >
                    Use Suggestions
                  </button>
                </div>
                <div className="text-xs text-amber-700">
                  Found {suggestedCategories.length} recent expense categories matching this amount
                </div>
              </div>
            )}
            {fields.map((field, index) => {
              const splitAmountCents = watchedSplits[index]?.amountCents || 0;
              const splitAmountEur = splitAmountCents / 100;
              
              return (
                <div
                  key={field.id}
                  className="space-y-2 p-3 border border-zinc-200 rounded-lg bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-zinc-700">
                      Split {index + 1}
                    </label>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors duration-200"
                        aria-label={`Remove split ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Category */}
                  <input
                    type="text"
                    placeholder="Category"
                    {...control.register(`splits.${index}.categoryId`)}
                    className="w-full px-2 py-1.5 text-sm text-zinc-900 bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 rounded transition-all duration-200 outline-none"
                    aria-label={`Category for split ${index + 1}`}
                  />

                  {/* Amount with Distribute Remainder button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...control.register(`splits.${index}.amountCents`, {
                        setValueAs: (value) => {
                          // Convert EUR string to cents
                          const num = parseFloat(value) || 0;
                          return Math.round(num * 100);
                        },
                        required: true,
                      })}
                      defaultValue={splitAmountEur > 0 ? splitAmountEur.toFixed(2) : ''}
                      className="flex-1 px-2 py-1.5 text-sm text-zinc-900 bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 rounded transition-all duration-200 outline-none"
                      aria-label={`Amount for split ${index + 1} in EUR`}
                    />
                    {remaining !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleDistributeRemainder(index)}
                        className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded transition-all duration-200"
                      >
                        Distribute Remainder
                      </button>
                    )}
                  </div>

                  {/* Memo */}
                  <input
                    type="text"
                    placeholder="Memo (optional)"
                    {...control.register(`splits.${index}.memo`)}
                    className="w-full px-2 py-1.5 text-sm text-zinc-500 bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300 rounded transition-all duration-200 outline-none"
                    aria-label={`Memo for split ${index + 1}`}
                  />
                </div>
              );
            })}

            {/* Add Split Button */}
            <button
              type="button"
              onClick={() => append({ categoryId: '', amountCents: 0, memo: '' })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add Split
            </button>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 space-y-3">
          {/* Remaining Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Remaining</span>
            <span
              className={clsx(
                'text-sm font-semibold px-2 py-1 rounded',
                isBalanced
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-red-600 bg-red-50'
              )}
            >
              {formatCurrency(remaining)}
            </span>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={!isBalanced || isSubmitting}
            className={clsx(
              'w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
              isBalanced && !isSubmitting
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Saving...' : 'Save Split'}
          </button>
        </div>
      </div>
    </>
  );
};

