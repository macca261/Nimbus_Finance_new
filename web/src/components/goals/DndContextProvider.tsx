/**
 * DndContextProvider Component
 * 
 * Provides drag-and-drop context for the entire app.
 * Wraps the app with DndContext to enable transaction-to-goal allocation.
 */

import React, { useState, useContext } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Active } from '@dnd-kit/core';
import { DndDropContext } from '@/contexts/DndDropContext';

export interface DndContextProviderProps {
  children: React.ReactNode;
  onTransactionDropped?: (transactionId: string, goalId: string, transaction: any) => void;
}

export const DndContextProvider: React.FC<DndContextProviderProps> = ({
  children,
  onTransactionDropped,
}) => {
  const [active, setActive] = useState<Active | null>(null);
  
  // Safely access drop context (may be undefined if DndDropProvider is not in tree)
  // Using useContext directly allows optional context usage
  const dropContext = useContext(DndDropContext);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActive(event.active);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActive(null);

    if (!over) return;

    // Check if transaction was dropped on a goal
    if (
      active.data.current?.type === 'transaction' &&
      typeof over.id === 'string' &&
      over.id.startsWith('goal-')
    ) {
      const goalId = over.id.replace('goal-', '');
      const transaction = active.data.current.transaction;

      // Notify via callback prop
      onTransactionDropped?.(active.id as string, goalId, transaction);
      
      // Also notify via context for components that need it (if available)
      dropContext?.onDrop({
        transactionId: active.id as string,
        goalId,
        transaction,
      });
    }
  };

  const handleDragCancel = () => {
    setActive(null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay>
        {active && active.data.current?.type === 'transaction' ? (
          <div className="rounded-lg border border-green-500 bg-slate-800 p-3 shadow-lg">
            <div className="text-sm font-medium text-white">
              {active.data.current.transaction.payee || 'Transaktion'}
            </div>
            <div className="text-xs text-green-400">
              {new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
              }).format((active.data.current.transaction.amountCents || 0) / 100)}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

