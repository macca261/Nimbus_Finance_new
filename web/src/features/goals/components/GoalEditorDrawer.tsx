import React, { useState, useEffect } from 'react';
import { createGoal, updateGoal, fetchGoalById } from '../../../api/goalsApi';
import type { CreateGoalInput, UpdateGoalInput } from '../../../types/goals';
import { X } from 'lucide-react';
import { evaluateQuietly } from '../../../lib/achievements/evaluateQuietly';

interface GoalEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  goalId?: string | null;
}

export const GoalEditorDrawer: React.FC<GoalEditorDrawerProps> = ({ open, onClose, goalId }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'savings' | 'debt' | 'net_worth'>('savings');
  const [targetCents, setTargetCents] = useState(0);
  const [currentCents, setCurrentCents] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && goalId) {
      fetchGoalById(goalId)
        .then((progress) => {
          const g = progress.goal;
          setName(g.name);
          setType(g.type);
          setTargetCents(g.targetCents);
          setCurrentCents(g.currentCents);
          setTargetDate(g.targetDate ? g.targetDate.split('T')[0] : '');
          setDescription(g.description || '');
        })
        .catch((err) => {
          setError(err.message);
        });
    } else if (open) {
      setName('');
      setType('savings');
      setTargetCents(0);
      setCurrentCents(0);
      setTargetDate('');
      setDescription('');
      setError(null);
    }
  }, [open, goalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (goalId) {
        const input: UpdateGoalInput = {
          name,
          type,
          targetCents,
          currentCents,
          targetDate: targetDate || null,
          description: description || null,
        };
        await updateGoal(goalId, input);
      } else {
        const input: CreateGoalInput = {
          name,
          type,
          targetCents,
          currentCents,
          targetDate: targetDate || null,
          currency: 'EUR',
          description: description || null,
        };
        await createGoal(input);
      }
      // Trigger achievement evaluation in background
      void evaluateQuietly();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-nf-bg-card shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-nf-border-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-nf-text-main">
              {goalId ? 'Ziel bearbeiten' : 'Neues Ziel'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-nf-text-muted hover:bg-nf-bg-card-subtle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
            {error && (
              <div className="mb-4 rounded-lg border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Typ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                >
                  <option value="savings">Sparen</option>
                  <option value="debt">Schuldenabbau</option>
                  <option value="net_worth">Vermögensaufbau</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Zielbetrag (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetCents / 100}
                  onChange={(e) => setTargetCents(Math.round(parseFloat(e.target.value) * 100))}
                  required
                  min="0"
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Aktueller Betrag (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentCents / 100}
                  onChange={(e) => setCurrentCents(Math.round(parseFloat(e.target.value) * 100))}
                  min="0"
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Zieltermin (optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Beschreibung (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-main hover:bg-nf-bg-card-subtle"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-nf-primary px-4 py-2 text-sm font-medium text-white hover:bg-nf-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

