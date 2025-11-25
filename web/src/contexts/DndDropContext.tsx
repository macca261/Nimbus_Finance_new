/**
 * DndDropContext
 * 
 * React Context to communicate drag-and-drop events between
 * DndContextProvider and child components like SidebarSavingsGoals.
 * 
 * This context is designed to be reusable for future dashboard layout
 * drag-and-drop features (e.g., rearranging dashboard cards).
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface DropEvent {
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

/**
 * State shape for the DnD drop context.
 * Tracks the last drop event and provides handlers for drop operations.
 */
export interface DndDropState {
  lastDrop: DropEvent | null;
  onDrop: (event: DropEvent) => void;
  clearDrop: () => void;
}

// Internal context (not exported directly)
const DndDropContextInternal = createContext<DndDropState | undefined>(undefined);

/**
 * Exported context for direct useContext access if needed.
 * Prefer using useDndDropContext() hook for better error handling.
 */
export const DndDropContext = DndDropContextInternal;

/**
 * Hook to access the DnD drop context.
 * 
 * @throws {Error} If used outside of DndDropProvider
 * @returns {DndDropState} The drop context state and handlers
 * 
 * @example
 * ```tsx
 * const { lastDrop, onDrop, clearDrop } = useDndDropContext();
 * ```
 */
export function useDndDropContext(): DndDropState {
  const ctx = useContext(DndDropContextInternal);
  if (!ctx) {
    throw new Error('useDndDropContext must be used within DndDropProvider');
  }
  return ctx;
}

/**
 * Legacy hook name for backward compatibility.
 * @deprecated Use useDndDropContext() instead
 */
export function useDndDrop(): DndDropState {
  return useDndDropContext();
}

export interface DndDropProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for DnD drop context.
 * Wraps children to enable drag-and-drop event communication.
 */
export function DndDropProvider({ children }: DndDropProviderProps) {
  const [lastDrop, setLastDrop] = useState<DropEvent | null>(null);

  const onDrop = useCallback((event: DropEvent) => {
    setLastDrop(event);
  }, []);

  const clearDrop = useCallback(() => {
    setLastDrop(null);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<DndDropState>(
    () => ({
      lastDrop,
      onDrop,
      clearDrop,
    }),
    [lastDrop, onDrop, clearDrop]
  );

  return (
    <DndDropContextInternal.Provider value={contextValue}>
      {children}
    </DndDropContextInternal.Provider>
  );
}

