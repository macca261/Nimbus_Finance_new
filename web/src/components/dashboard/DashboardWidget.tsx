/**
 * DashboardWidget - Reusable wrapper for dashboard widgets
 * 
 * Prepares the dashboard for future drag-and-drop functionality by providing
 * a consistent structure and styling for all dashboard widgets.
 * 
 * Uses Nimbus design tokens for consistency with the rest of the dashboard.
 */

import React from 'react';

interface DashboardWidgetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Base widget wrapper with consistent styling for drag-and-drop preparation
 * Matches the dark-mode aesthetic of other dashboard cards
 */
export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  children,
  className = '',
  onClick,
}) => {
  return (
    <div
      className={`
        rounded-xl
        border border-nf-border-subtle
        bg-nf-bg-card
        p-4
        shadow-elevated
        transition-all duration-200 ease-out
        hover:-translate-y-[1px] hover:shadow-xl
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

