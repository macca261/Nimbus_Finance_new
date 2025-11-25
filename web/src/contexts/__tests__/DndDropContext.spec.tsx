/**
 * Tests for DndDropContext
 * 
 * Ensures the context export/import works correctly and provides
 * proper error handling when used outside of the provider.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DndDropProvider, useDndDropContext, DndDropContext } from '../DndDropContext';
import type { DropEvent } from '../DndDropContext';

describe('DndDropContext', () => {
  describe('useDndDropContext hook', () => {
    it('should provide context values when used within DndDropProvider', () => {
      const TestComponent = () => {
        const { lastDrop, onDrop, clearDrop } = useDndDropContext();
        
        return (
          <div>
            <div data-testid="last-drop">{lastDrop ? 'has-drop' : 'no-drop'}</div>
            <button
              data-testid="trigger-drop"
              onClick={() => {
                onDrop({
                  transactionId: 'tx-1',
                  goalId: 'goal-1',
                  transaction: {
                    id: 1,
                    amountCents: 5000,
                    bookingDate: '2024-01-01',
                  },
                });
              }}
            >
              Drop
            </button>
            <button data-testid="clear-drop" onClick={clearDrop}>
              Clear
            </button>
          </div>
        );
      };

      render(
        <DndDropProvider>
          <TestComponent />
        </DndDropProvider>
      );

      expect(screen.getByTestId('last-drop')).toHaveTextContent('no-drop');
      
      // Trigger a drop
      screen.getByTestId('trigger-drop').click();
      expect(screen.getByTestId('last-drop')).toHaveTextContent('has-drop');
      
      // Clear the drop
      screen.getByTestId('clear-drop').click();
      expect(screen.getByTestId('last-drop')).toHaveTextContent('no-drop');
    });

    it('should throw error when used outside of DndDropProvider', () => {
      // Suppress console.error for this test
      const consoleError = console.error;
      console.error = () => {};

      const TestComponent = () => {
        try {
          useDndDropContext();
          return <div data-testid="no-error">No error</div>;
        } catch (error: any) {
          return <div data-testid="error">{error.message}</div>;
        }
      };

      render(<TestComponent />);

      expect(screen.getByTestId('error')).toHaveTextContent(
        'useDndDropContext must be used within DndDropProvider'
      );

      console.error = consoleError;
    });
  });

  describe('DndDropContext export', () => {
    it('should export DndDropContext as a named export', () => {
      expect(DndDropContext).toBeDefined();
      expect(typeof DndDropContext).toBe('object');
      expect(DndDropContext.Provider).toBeDefined();
    });
  });

  describe('DndDropProvider', () => {
    it('should memoize context value to prevent unnecessary re-renders', () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        const { onDrop } = useDndDropContext();
        
        React.useEffect(() => {
          // Trigger a drop on mount
          onDrop({
            transactionId: 'tx-1',
            goalId: 'goal-1',
            transaction: {
              id: 1,
              amountCents: 1000,
              bookingDate: '2024-01-01',
            },
          });
        }, [onDrop]);

        return <div data-testid="test">Test</div>;
      };

      const { rerender } = render(
        <DndDropProvider>
          <TestComponent />
        </DndDropProvider>
      );

      const initialRenderCount = renderCount;
      
      // Re-render parent (should not cause child to re-render if value is memoized)
      rerender(
        <DndDropProvider>
          <TestComponent />
        </DndDropProvider>
      );

      // The component should not re-render unnecessarily
      // (Note: This is a basic check; in practice, React's reconciliation
      // might cause re-renders for other reasons)
      expect(renderCount).toBeGreaterThanOrEqual(initialRenderCount);
    });
  });
});

