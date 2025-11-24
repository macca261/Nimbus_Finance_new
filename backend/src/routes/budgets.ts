import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { calculateBudgetSummary } from '../services/budgetsService';

const prisma = new PrismaClient();
const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

export const budgetsRouter = Router();

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

// GET /api/budgets?month=YYYY-MM&period=monthly
budgetsRouter.get('/', async (req, res) => {
  try {
    const month = (req.query.month as string) || null;
    const period = (req.query.period as string) || 'monthly';
    
    // Validate period
    if (!['monthly', 'weekly', 'yearly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be monthly, weekly, or yearly' });
    }
    
    let where: any = { period };
    if (month && period === 'monthly') {
      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
      }
      where.periodValue = month;
    }
    
    const budgets = await prisma.budget.findMany({
      where,
      include: {
        allocations: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    const db = getDb(req);
    const summaries = budgets.map((budget) => {
      const summary = calculateBudgetSummary(budget, db);
      // Convert DateTime to ISO strings for frontend
      return {
        ...summary,
        budget: {
          ...summary.budget,
          createdAt: summary.budget.createdAt.toISOString(),
          updatedAt: summary.budget.updatedAt.toISOString(),
        },
        allocations: summary.allocations.map((alloc) => ({
          ...alloc,
          createdAt: alloc.createdAt.toISOString(),
          updatedAt: alloc.updatedAt.toISOString(),
        })),
      };
    });
    
    res.json({ data: summaries });
  } catch (e: any) {
    console.error('[budgets] GET error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load budgets' });
  }
});

// GET /api/budgets/:id
budgetsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        allocations: true,
      },
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const db = getDb(req);
    const summary = calculateBudgetSummary(budget, db);
    
    // Convert DateTime to ISO strings
    res.json({
      data: {
        ...summary,
        budget: {
          ...summary.budget,
          createdAt: summary.budget.createdAt.toISOString(),
          updatedAt: summary.budget.updatedAt.toISOString(),
        },
        allocations: summary.allocations.map((alloc) => ({
          ...alloc,
          createdAt: alloc.createdAt.toISOString(),
          updatedAt: alloc.updatedAt.toISOString(),
        })),
      },
    });
  } catch (e: any) {
    console.error('[budgets] GET :id error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load budget' });
  }
});

// POST /api/budgets
budgetsRouter.post('/', async (req, res) => {
  try {
    const { name, period, periodValue, currency, rolloverEnabled, allocations } = req.body;
    
    if (!name || !period || !periodValue) {
      return res.status(400).json({ error: 'Missing required fields: name, period, periodValue' });
    }
    
    if (!['monthly', 'weekly', 'yearly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be monthly, weekly, or yearly' });
    }
    
    // Validate allocations if provided
    if (allocations && Array.isArray(allocations)) {
      for (const alloc of allocations) {
        if (!alloc.categoryId || typeof alloc.plannedCents !== 'number' || alloc.plannedCents < 0) {
          return res.status(400).json({ error: 'Invalid allocation: categoryId and plannedCents (>= 0) required' });
        }
      }
    }
    
    const budget = await prisma.budget.create({
      data: {
        name,
        period,
        periodValue,
        currency: currency || 'EUR',
        rolloverEnabled: rolloverEnabled || false,
        allocations: {
          create: (allocations || []).map((alloc: any) => ({
            categoryId: alloc.categoryId,
            plannedCents: alloc.plannedCents || 0,
            rolloverFromPrevious: alloc.rolloverFromPrevious || false,
          })),
        },
      },
      include: {
        allocations: true,
      },
    });
    
    const db = getDb(req);
    const summary = calculateBudgetSummary(budget, db);
    
    // Convert DateTime to ISO strings
    res.status(201).json({
      data: {
        ...summary,
        budget: {
          ...summary.budget,
          createdAt: summary.budget.createdAt.toISOString(),
          updatedAt: summary.budget.updatedAt.toISOString(),
        },
        allocations: summary.allocations.map((alloc) => ({
          ...alloc,
          createdAt: alloc.createdAt.toISOString(),
          updatedAt: alloc.updatedAt.toISOString(),
        })),
      },
    });
  } catch (e: any) {
    console.error('[budgets] POST error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create budget' });
  }
});

// PATCH /api/budgets/:id
budgetsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, period, periodValue, currency, rolloverEnabled, allocations } = req.body;
    
    // Update budget
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (period !== undefined) updateData.period = period;
    if (periodValue !== undefined) updateData.periodValue = periodValue;
    if (currency !== undefined) updateData.currency = currency;
    if (rolloverEnabled !== undefined) updateData.rolloverEnabled = rolloverEnabled;
    
    // If allocations are provided, replace all existing ones
    if (allocations !== undefined) {
      // Delete existing allocations
      await prisma.budgetCategoryAllocation.deleteMany({
        where: { budgetId: id },
      });
      
      // Create new allocations
      updateData.allocations = {
        create: allocations.map((alloc: any) => ({
          categoryId: alloc.categoryId,
          plannedCents: alloc.plannedCents || 0,
          rolloverFromPrevious: alloc.rolloverFromPrevious || false,
        })),
      };
    }
    
    const budget = await prisma.budget.update({
      where: { id },
      data: updateData,
      include: {
        allocations: true,
      },
    });
    
    const db = getDb(req);
    const summary = calculateBudgetSummary(budget, db);
    
    // Convert DateTime to ISO strings
    res.json({
      data: {
        ...summary,
        budget: {
          ...summary.budget,
          createdAt: summary.budget.createdAt.toISOString(),
          updatedAt: summary.budget.updatedAt.toISOString(),
        },
        allocations: summary.allocations.map((alloc) => ({
          ...alloc,
          createdAt: alloc.createdAt.toISOString(),
          updatedAt: alloc.updatedAt.toISOString(),
        })),
      },
    });
  } catch (e: any) {
    console.error('[budgets] PATCH error:', e);
    res.status(500).json({ error: e?.message || 'Failed to update budget' });
  }
});

// DELETE /api/budgets/:id
budgetsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.budget.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[budgets] DELETE error:', e);
    res.status(500).json({ error: e?.message || 'Failed to delete budget' });
  }
});

