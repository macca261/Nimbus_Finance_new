/**
 * useDndTransactionDrop Hook
 * 
 * Custom hook to handle transaction drops on goals.
 * Opens the allocation dialog when a transaction is dropped.
 */

import { useState, useCallback } from 'react';

export interface TransactionDropData {
  transactionId: string;
  goalId: string;
  transaction: {
    id: number;
    publicId?: string;
    amountCents: number;
    payee?: string | null;
    memo?: string | null;
    bookingDate: string;
  };
}

export function useDndTransactionDrop() {
  const [allocationDialog, setAllocationDialog] = useState<TransactionDropData | null>(null);

  const handleDrop = useCallback((transactionId: string, goalId: string, transaction: any) => {
    setAllocationDialog({
      transactionId,
      goalId,
      transaction,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setAllocationDialog(null);
  }, []);

  return {
    allocationDialog,
    handleDrop,
    closeDialog,
  };
}

