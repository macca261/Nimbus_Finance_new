/**
 * AllocationDialog Component
 * 
 * Modal dialog for allocating a transaction amount to a savings goal.
 * Allows partial allocation (user can specify how much of the transaction
 * to allocate to the goal).
 */

import React, { useState } from 'react';
import { X, Target, Euro } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { createBucketMovement } from '../../api/buckets';
import type { Bucket } from '../../api/buckets';

export interface AllocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: number;
    publicId?: string;
    amountCents: number;
    payee?: string | null;
    memo?: string | null;
    bookingDate: string;
  };
  goal: {
    id: string;
    name: string;
    bucketId?: string | null;
  };
  onAllocated?: () => void;
}

export const AllocationDialog: React.FC<AllocationDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  goal,
  onAllocated,
}) => {
  const [amountCents, setAmountCents] = useState(Math.abs(transaction.amountCents));
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const maxAmount = Math.abs(transaction.amountCents);
  const amountPercent = maxAmount > 0 ? (amountCents / maxAmount) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!goal.bucketId) {
      setError('Ziel hat keinen verknüpften Bucket. Bitte erstelle zuerst einen Bucket für dieses Ziel.');
      return;
    }

    if (amountCents <= 0 || amountCents > maxAmount) {
      setError(`Betrag muss zwischen 0 und ${formatCurrency(maxAmount)} liegen.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createBucketMovement(goal.bucketId, {
        amount_cents: amountCents,
        memo: memo || `Von: ${transaction.payee || 'Transaktion'}`,
        origin_type: 'INCOME',
        origin_id: transaction.publicId || String(transaction.id),
        date: transaction.bookingDate,
      });

      onAllocated?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Fehler beim Zuweisen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullAmount = () => {
    setAmountCents(maxAmount);
  };

  const handleHalfAmount = () => {
    setAmountCents(Math.floor(maxAmount / 2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20 text-green-400">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-white">Zu Ziel zuweisen</h2>
          </div>
          <p className="text-sm text-slate-400">
            Wie viel möchtest du zu <span className="font-medium text-white">{goal.name}</span> zuweisen?
          </p>
        </div>

        {/* Transaction Info */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Transaktion</span>
            <span className="text-sm font-medium text-green-400">
              {formatCurrency(maxAmount)}
            </span>
          </div>
          <p className="text-sm text-white truncate">
            {transaction.payee || transaction.memo || 'Unbekannt'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {new Date(transaction.bookingDate).toLocaleDateString('de-DE')}
          </p>
        </div>

        {/* Amount Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Betrag zuweisen
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="1"
                max={maxAmount}
                step="1"
                value={amountCents}
                onChange={(e) => setAmountCents(Math.max(1, Math.min(maxAmount, parseInt(e.target.value) || 0)))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="0"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                {formatCurrency(amountCents)} ({Math.round(amountPercent)}%)
              </div>
            </div>
            
            {/* Quick Buttons */}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleHalfAmount}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                50%
              </button>
              <button
                type="button"
                onClick={handleFullAmount}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                100%
              </button>
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notiz (optional)
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              placeholder="z.B. Monatliche Sparrate"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amountCents <= 0}
              className="flex-1 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Wird zugewiesen...' : 'Zuweisen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

