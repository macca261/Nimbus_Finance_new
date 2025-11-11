/**
 * Mock data for the dashboard
 */

import { formatCurrency } from './format';

export type Category =
  | 'Rent'
  | 'Groceries'
  | 'Dining'
  | 'Transport'
  | 'Subscriptions'
  | 'Shopping'
  | 'Income'
  | 'Other'
  | 'Health'
  | 'Utilities'
  | 'Entertainment'
  | 'Education';

export interface KpiData {
  balance: number; // in euros
  incomeMTD: number; // in euros
  expensesMTD: number; // in euros
  balanceTrend: number[]; // last 6 months balance in euros
  incomeTrend: number[]; // last 6 months income in euros
  expensesTrend: number[]; // last 6 months expenses in euros
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string; // Tailwind color classes
}

export interface SpendingCategory {
  name: Category;
  amount: number; // in euros
  percentage: number;
  color: string; // hex color
}

export interface Subscription {
  id: string;
  vendor: string;
  logo?: string; // URL or path to logo
  nextChargeDate: string; // YYYY-MM-DD
  amount: number; // in euros
  cadence: 'Monthly' | 'Yearly' | 'Weekly';
  status: 'Active' | 'Paused' | 'Cancelled';
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: Category;
  amount: number; // in euros (negative for expenses, positive for income)
  type: 'income' | 'expense';
}

export interface BalanceHistoryPoint {
  date: string; // YYYY-MM-DD
  balance: number; // in euros
}

// ============================================================================
// MOCK DATA
// ============================================================================

export const MOCK_USER_NAME = 'Alex';

export const MOCK_KPI_DATA: KpiData = {
  balance: 12450.80,
  incomeMTD: 3250.0,
  expensesMTD: 1899.2,
  balanceTrend: [10000, 10500, 11000, 11500, 12000, 12450.8],
  incomeTrend: [2800, 3000, 3100, 3050, 3200, 3250],
  expensesTrend: [1500, 1600, 1700, 1650, 1800, 1899.2],
};

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'saved-this-month',
    icon: 'PiggyBank',
    title: `Saved ${formatCurrency(MOCK_KPI_DATA.incomeMTD - MOCK_KPI_DATA.expensesMTD)} this month`,
    description: 'Your net savings for the current month.',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  },
  {
    id: 'under-budget',
    icon: 'Target',
    title: 'Under budget 30%',
    description: 'You are 30% under your monthly spending budget.',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  },
  {
    id: 'no-dining-out',
    icon: 'UtensilsCrossed',
    title: 'No dining out 7d',
    description: "You haven't spent on dining out for a week!",
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  },
];

// Category colors for charts
export const CATEGORY_COLORS: Record<Category, string> = {
  Rent: '#6366f1',
  Groceries: '#10b981',
  Dining: '#f59e0b',
  Transport: '#3b82f6',
  Subscriptions: '#8b5cf6',
  Shopping: '#ec4899',
  Income: '#14b8a6',
  Other: '#6b7280',
  Health: '#ef4444',
  Utilities: '#06b6d4',
  Entertainment: '#f97316',
  Education: '#84cc16',
};

export const MOCK_SPENDING_CATEGORIES: SpendingCategory[] = [
  { name: 'Rent', amount: 850.0, percentage: 44.7, color: CATEGORY_COLORS.Rent },
  { name: 'Shopping', amount: 299.99, percentage: 15.8, color: CATEGORY_COLORS.Shopping },
  { name: 'Dining', amount: 84.4, percentage: 4.4, color: CATEGORY_COLORS.Dining },
  { name: 'Groceries', amount: 78.34, percentage: 4.1, color: CATEGORY_COLORS.Groceries },
  { name: 'Subscriptions', amount: 50.0, percentage: 2.6, color: CATEGORY_COLORS.Subscriptions },
  { name: 'Transport', amount: 30.0, percentage: 1.6, color: CATEGORY_COLORS.Transport },
  { name: 'Other', amount: 48.0, percentage: 2.5, color: CATEGORY_COLORS.Other },
];

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'netflix',
    vendor: 'Netflix',
    nextChargeDate: '2025-01-15',
    amount: 17.99,
    cadence: 'Monthly',
    status: 'Active',
  },
  {
    id: 'spotify',
    vendor: 'Spotify Premium',
    nextChargeDate: '2025-01-18',
    amount: 9.99,
    cadence: 'Monthly',
    status: 'Active',
  },
  {
    id: 'amazon-prime',
    vendor: 'Amazon Prime',
    nextChargeDate: '2025-01-20',
    amount: 8.99,
    cadence: 'Monthly',
    status: 'Active',
  },
  {
    id: 'adobe',
    vendor: 'Adobe Creative Cloud',
    nextChargeDate: '2025-01-25',
    amount: 59.99,
    cadence: 'Monthly',
    status: 'Active',
  },
  {
    id: 'gym',
    vendor: 'Fitness Studio',
    nextChargeDate: '2025-02-01',
    amount: 35.0,
    cadence: 'Monthly',
    status: 'Paused',
  },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', date: '2025-01-10', description: 'REWE Supermarkt', category: 'Groceries', amount: -45.89, type: 'expense' },
  { id: 't2', date: '2025-01-10', description: 'Deutsche Bahn Ticket', category: 'Transport', amount: -12.5, type: 'expense' },
  { id: 't3', date: '2025-01-09', description: 'Starbucks Coffee', category: 'Dining', amount: -5.9, type: 'expense' },
  { id: 't4', date: '2025-01-09', description: 'Gehalt Januar', category: 'Income', amount: 3500.0, type: 'income' },
  { id: 't5', date: '2025-01-08', description: 'IKEA Möbel', category: 'Shopping', amount: -299.99, type: 'expense' },
  { id: 't6', date: '2025-01-08', description: 'Tankstelle Shell', category: 'Transport', amount: -65.0, type: 'expense' },
  { id: 't7', date: '2025-01-07', description: 'Restaurant Bella Vista', category: 'Dining', amount: -78.5, type: 'expense' },
  { id: 't8', date: '2025-01-07', description: 'ALDI Einkauf', category: 'Groceries', amount: -32.45, type: 'expense' },
  { id: 't9', date: '2025-01-06', description: 'Miete Januar', category: 'Rent', amount: -850.0, type: 'expense' },
  { id: 't10', date: '2025-01-06', description: 'Telekom Rechnung', category: 'Utilities', amount: -45.0, type: 'expense' },
  { id: 't11', date: '2025-01-05', description: 'Netflix Subscription', category: 'Subscriptions', amount: -17.99, type: 'expense' },
  { id: 't12', date: '2025-01-04', description: 'Spotify Premium', category: 'Subscriptions', amount: -9.99, type: 'expense' },
  { id: 't13', date: '2025-01-03', description: 'DM Drogerie', category: 'Shopping', amount: -15.5, type: 'expense' },
  { id: 't14', date: '2025-01-02', description: 'Nebenjob Einnahmen', category: 'Income', amount: 500.0, type: 'income' },
  { id: 't15', date: '2025-01-01', description: 'Amazon Prime', category: 'Subscriptions', amount: -8.99, type: 'expense' },
];

export const MOCK_BALANCE_HISTORY: BalanceHistoryPoint[] = [
  { date: '2024-07-01', balance: 8900.0 },
  { date: '2024-08-01', balance: 9200.0 },
  { date: '2024-09-01', balance: 9800.0 },
  { date: '2024-10-01', balance: 10500.0 },
  { date: '2024-11-01', balance: 11200.0 },
  { date: '2024-12-01', balance: 11800.0 },
  { date: '2025-01-01', balance: 12450.8 },
];

export const ALL_CATEGORIES: Category[] = [
  'Rent',
  'Groceries',
  'Dining',
  'Transport',
  'Subscriptions',
  'Shopping',
  'Income',
  'Other',
  'Health',
  'Utilities',
  'Entertainment',
  'Education',
];

