/**
 * DraggableTransactionCard Component
 * 
 * Wraps TransactionCard with drag-and-drop functionality using dnd-kit.
 * Enables dragging transactions to savings goals in the sidebar.
 */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TransactionCard } from './TransactionCard';
import type { DisplayTransaction } from '../../pages/Transactions';

export interface DraggableTransactionCardProps {
  transaction: DisplayTransaction;
  isSelected?: boolean;
  onSelect?: (id: number, checked: boolean) => void;
  onCategoryChange?: (txId: number, nextCategory: string | null) => void;
  onNavigate?: (tx: DisplayTransaction) => void;
  showSubscriptionCandidate?: boolean;
}

export const DraggableTransactionCard: React.FC<DraggableTransactionCardProps> = (props) => {
  const { transaction } = props;
  
  // Only make income transactions draggable
  const isDraggable = (transaction.amountCents ?? 0) > 0;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `transaction-${transaction.id}`,
    data: {
      type: 'transaction',
      transaction: {
        id: transaction.id,
        publicId: transaction.publicId,
        amountCents: transaction.amountCents ?? 0,
        payee: transaction.payee,
        memo: transaction.memo,
        bookingDate: transaction.bookingDate || transaction.bookedAt || new Date().toISOString(),
      },
    },
    disabled: !isDraggable,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  if (!isDraggable) {
    // Non-draggable transactions render normally
    return <TransactionCard {...props} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
    >
      <TransactionCard {...props} />
    </div>
  );
};

