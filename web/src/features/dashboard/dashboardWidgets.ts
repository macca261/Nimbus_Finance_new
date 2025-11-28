/**
 * Dashboard Widget Registry
 * 
 * Defines the widget system for the Nimbus Finance dashboard.
 * Widgets can be full-width or half-width, and can be reordered via drag & drop.
 */

export type DashboardWidgetId =
  | 'wallet'
  | 'moneyHealth'
  | 'monthSnapshot'
  | 'charts'
  | 'monthGlance'
  | 'coachStory'
  | 'achievements'
  | 'quests';

export type DashboardWidgetSize = 'full' | 'half';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
  hidden?: boolean;
  /* Future: per-widget settings */
}

/**
 * Default widget configuration for new users
 * Order determines initial layout
 */
export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'wallet', size: 'full' },
  { id: 'moneyHealth', size: 'half' },
  { id: 'monthSnapshot', size: 'half' },
  { id: 'charts', size: 'full' },
  { id: 'monthGlance', size: 'half' },
  { id: 'coachStory', size: 'half' },
  { id: 'achievements', size: 'full' },
  { id: 'quests', size: 'full' },
];

/**
 * Widget metadata for display names and descriptions (future use)
 */
export const WIDGET_METADATA: Record<DashboardWidgetId, { name: string; description?: string }> = {
  wallet: { name: 'Wallet Overview', description: 'Current balance and account summary' },
  moneyHealth: { name: 'Money Health', description: 'Overall financial health score' },
  monthSnapshot: { name: 'Dein Monat', description: 'Monthly insights snapshot' },
  charts: { name: 'Charts & Analytics', description: 'Spending trends and category breakdown' },
  monthGlance: { name: 'Month Glance', description: 'Quick monthly summary' },
  coachStory: { name: 'Coach Story', description: 'AI-powered financial insights' },
  achievements: { name: 'Achievements', description: 'Your financial milestones' },
  quests: { name: 'Quests', description: 'Active financial challenges' },
};

