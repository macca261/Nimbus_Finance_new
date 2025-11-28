import { useEffect, useState } from 'react';
import {
  DashboardWidgetConfig,
  DEFAULT_DASHBOARD_WIDGETS,
} from '../features/dashboard/dashboardWidgets';

const STORAGE_KEY = 'nimbus_dashboard_layout_v1';

/**
 * Hook for managing dashboard widget layout with localStorage persistence
 * 
 * Handles:
 * - Loading layout from localStorage on mount
 * - Persisting layout changes to localStorage
 * - Reordering widgets via drag & drop
 */
export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load layout from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardWidgetConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate that all widget IDs are valid
          const validWidgets = parsed.filter(w => 
            DEFAULT_DASHBOARD_WIDGETS.some(defaultW => defaultW.id === w.id)
          );
          if (validWidgets.length > 0) {
            setWidgets(validWidgets);
          }
        }
      }
    } catch (err) {
      console.warn('[useDashboardLayout] Failed to load layout from localStorage:', err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Persist layout to localStorage when it changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return; // Don't persist on initial mount
    
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch (err) {
      console.warn('[useDashboardLayout] Failed to save layout to localStorage:', err);
    }
  }, [widgets, isInitialized]);

  /**
   * Reorder widgets by moving an item from one index to another
   */
  const reorder = (fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  /**
   * Reset layout to defaults
   */
  const reset = () => {
    setWidgets(DEFAULT_DASHBOARD_WIDGETS);
  };

  /**
   * Toggle widget visibility
   */
  const toggleWidget = (widgetId: string) => {
    setWidgets(prev =>
      prev.map(w => (w.id === widgetId ? { ...w, hidden: !w.hidden } : w))
    );
  };

  return {
    widgets: widgets.filter(w => !w.hidden), // Only return visible widgets
    allWidgets: widgets, // Include hidden widgets for management
    setWidgets,
    reorder,
    reset,
    toggleWidget,
    isInitialized,
  };
}

