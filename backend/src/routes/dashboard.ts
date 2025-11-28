import { Router } from 'express';

const dashboardRouter = Router();

/**
 * Temporary stub for the dashboard route.
 *
 * The original file was badly corrupted (no imports, no router definition,
 * db/toEuros used without being defined), which caused runtime errors
 * on server startup.
 *
 * This stub keeps the response shape the frontend expects, but returns
 * empty/default values so we can stabilise CSV import & categorisation first.
 */
dashboardRouter.get('/', (_req, res) => {
  res.json({
    lastImport: undefined,
    kpis: {
      currentBalance: 0,
      income30d: 0,
      expenses30d: 0,
      net30d: 0,
    },
    spendingByCategory: [],
    topCategories: [],
    balanceOverTime: [],
    cashflowByMonth: [],
    subscriptions: [],
    potentialTaxRelevant: [],
    achievements: [],
    recentTransactions: [],
    transactionCount: 0,
    uncategorizedCount: 0,
    parserWarnings: [],
  });
});

export default dashboardRouter;
