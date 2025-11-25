/**
 * SidebarSavingsGoals Component
 * 
 * Displays active savings goals in the sidebar with:
 * - Drag-and-drop support for transaction allocation
 * - Hybrid progress visualization
 * - City Builder gamification state
 * 
 * This transforms the sidebar from navigation into a functional
 * "Command Center" for savings management.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useGoals } from '../../hooks/useGoals';
import { AllocationDialog } from './AllocationDialog';
import axios from 'axios';
import { useDndDropContext } from '@/contexts/DndDropContext';
import { SidebarSavingsGoalItem } from './SidebarSavingsGoalItem';

export interface SidebarSavingsGoalsProps {
  onTransactionDropped?: (transactionId: string, goalId: string, transaction: any) => void;
}

export const SidebarSavingsGoals: React.FC<SidebarSavingsGoalsProps> = () => {
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL - BEFORE ANY EARLY RETURNS
  const { goals, isLoading } = useGoals({ isActive: true });
  const { lastDrop, clearDrop } = useDndDropContext();
  const [allocationDialog, setAllocationDialog] = useState<{
    transaction: any;
    goal: any;
  } | null>(null);
  const [hybridStatuses, setHybridStatuses] = useState<Record<string, {
    virtualBalanceCents: number;
    externalBalanceCents: number;
  }>>({});

  // Filter to only savings goals - use useMemo to prevent unnecessary recalculations
  const savingsGoals = useMemo(
    () => goals?.filter(g => g.goal.type === 'savings') || [],
    [goals]
  );

  // Memoize goal IDs for dependency array
  const goalIds = useMemo(
    () => savingsGoals.map(g => g.goal.id).join(','),
    [savingsGoals]
  );

  // Listen for drop events and show allocation dialog
  useEffect(() => {
    if (lastDrop) {
      const goal = savingsGoals.find(g => g.goal.id === lastDrop.goalId);
      if (goal) {
        setAllocationDialog({
          transaction: lastDrop.transaction,
          goal: {
            id: goal.goal.id,
            name: goal.goal.name,
            bucketId: goal.goal.linkedBucketId,
          },
        });
        clearDrop();
      }
    }
  }, [lastDrop, savingsGoals, clearDrop]);

  // Fetch hybrid statuses for all goals
  useEffect(() => {
    const fetchHybridStatuses = async () => {
      const statuses: Record<string, any> = {};
      for (const goalProgress of savingsGoals) {
        try {
          const response = await axios.get(`/api/goals/${goalProgress.goal.id}/hybrid-status`);
          statuses[goalProgress.goal.id] = response.data.data;
        } catch (err) {
          // Goal might not have hybrid status yet, use defaults
          statuses[goalProgress.goal.id] = {
            virtualBalanceCents: 0,
            externalBalanceCents: 0,
          };
        }
      }
      setHybridStatuses(statuses);
    };

    if (savingsGoals.length > 0) {
      fetchHybridStatuses();
    }
  }, [goalIds, savingsGoals.length]);

  // Early returns AFTER all hooks have been called
  if (isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400">
        Lade Ziele...
      </div>
    );
  }

  if (savingsGoals.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400">
        Keine Sparziele aktiv
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-1.5">
      <p className="px-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Sparziele
      </p>
      {savingsGoals.slice(0, 5).map((goalProgress) => {
        const goal = goalProgress.goal;
        
        // Get hybrid status
        const hybridStatus = hybridStatuses[goal.id] || {
          virtualBalanceCents: 0,
          externalBalanceCents: 0,
        };

        return (
          <SidebarSavingsGoalItem
            key={goal.id}
            goalProgress={goalProgress}
            hybridStatus={hybridStatus}
          />
        );
      })}

      {/* Allocation Dialog */}
      {allocationDialog && (
        <AllocationDialog
          isOpen={true}
          onClose={() => setAllocationDialog(null)}
          transaction={allocationDialog.transaction}
          goal={allocationDialog.goal}
          onAllocated={() => {
            // Refresh hybrid statuses after allocation
            const fetchStatus = async () => {
              try {
                const response = await axios.get(`/api/goals/${allocationDialog.goal.id}/hybrid-status`);
                setHybridStatuses(prev => ({
                  ...prev,
                  [allocationDialog.goal.id]: response.data.data,
                }));
              } catch (err) {
                // Ignore errors
              }
            };
            fetchStatus();
          }}
        />
      )}
    </div>
  );
};

