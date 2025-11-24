import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { calculateGoalProgress } from '../services/goalsService';

const prisma = new PrismaClient();
const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

export const goalsRouter = Router();

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

// GET /api/goals
goalsRouter.get('/', async (req, res) => {
  try {
    const isActive = req.query.isActive !== 'false'; // Default to true
    
    const goals = await prisma.goal.findMany({
      where: isActive ? { isActive: true } : undefined,
      orderBy: [
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    
    const db = getDb(req);
    const progress = goals.map((goal) => {
      const prog = calculateGoalProgress(goal, db);
      // Convert DateTime to ISO strings and handle JSON fields
      return {
        ...prog,
        goal: {
          ...prog.goal,
          targetDate: prog.goal.targetDate ? prog.goal.targetDate.toISOString() : null,
          linkedAccountIds: prog.goal.linkedAccountIds ? (prog.goal.linkedAccountIds as any) : null,
          linkedCategoryIds: prog.goal.linkedCategoryIds ? (prog.goal.linkedCategoryIds as any) : null,
          createdAt: prog.goal.createdAt.toISOString(),
          updatedAt: prog.goal.updatedAt.toISOString(),
        },
        projectedCompletionDate: prog.projectedCompletionDate ? prog.projectedCompletionDate.toISOString() : null,
      };
    });
    
    res.json({ data: progress });
  } catch (e: any) {
    console.error('[goals] GET error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load goals' });
  }
});

// GET /api/goals/:id
goalsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const goal = await prisma.goal.findUnique({
      where: { id },
    });
    
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const db = getDb(req);
    const progress = calculateGoalProgress(goal, db);
    
    // Convert DateTime to ISO strings and handle JSON fields
    res.json({
      data: {
        ...progress,
        goal: {
          ...progress.goal,
          targetDate: progress.goal.targetDate ? progress.goal.targetDate.toISOString() : null,
          linkedAccountIds: progress.goal.linkedAccountIds ? (progress.goal.linkedAccountIds as any) : null,
          linkedCategoryIds: progress.goal.linkedCategoryIds ? (progress.goal.linkedCategoryIds as any) : null,
          createdAt: progress.goal.createdAt.toISOString(),
          updatedAt: progress.goal.updatedAt.toISOString(),
        },
        projectedCompletionDate: progress.projectedCompletionDate ? progress.projectedCompletionDate.toISOString() : null,
      },
    });
  } catch (e: any) {
    console.error('[goals] GET :id error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load goal' });
  }
});

// POST /api/goals
goalsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      targetCents,
      currentCents,
      targetDate,
      currency,
      linkedAccountIds,
      linkedCategoryIds,
      description,
      isActive,
    } = req.body;
    
    if (!name || !type || targetCents === undefined) {
      return res.status(400).json({ error: 'Missing required fields: name, type, targetCents' });
    }
    
    if (!['savings', 'debt', 'net_worth'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be savings, debt, or net_worth' });
    }
    
    const goal = await prisma.goal.create({
      data: {
        name,
        type,
        targetCents,
        currentCents: currentCents || 0,
        targetDate: targetDate ? new Date(targetDate) : null,
        currency: currency || 'EUR',
        linkedAccountIds: linkedAccountIds || null,
        linkedCategoryIds: linkedCategoryIds || null,
        description: description || null,
        isActive: isActive !== false,
      },
    });
    
    const db = getDb(req);
    const progress = calculateGoalProgress(goal, db);
    
    // Convert DateTime to ISO strings and handle JSON fields
    res.status(201).json({
      data: {
        ...progress,
        goal: {
          ...progress.goal,
          targetDate: progress.goal.targetDate ? progress.goal.targetDate.toISOString() : null,
          linkedAccountIds: progress.goal.linkedAccountIds ? (progress.goal.linkedAccountIds as any) : null,
          linkedCategoryIds: progress.goal.linkedCategoryIds ? (progress.goal.linkedCategoryIds as any) : null,
          createdAt: progress.goal.createdAt.toISOString(),
          updatedAt: progress.goal.updatedAt.toISOString(),
        },
        projectedCompletionDate: progress.projectedCompletionDate ? progress.projectedCompletionDate.toISOString() : null,
      },
    });
  } catch (e: any) {
    console.error('[goals] POST error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create goal' });
  }
});

// PATCH /api/goals/:id
goalsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      targetCents,
      currentCents,
      targetDate,
      currency,
      linkedAccountIds,
      linkedCategoryIds,
      description,
      isActive,
    } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      if (!['savings', 'debt', 'net_worth'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }
      updateData.type = type;
    }
    if (targetCents !== undefined) updateData.targetCents = targetCents;
    if (currentCents !== undefined) updateData.currentCents = currentCents;
    if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
    if (currency !== undefined) updateData.currency = currency;
    if (linkedAccountIds !== undefined) updateData.linkedAccountIds = linkedAccountIds;
    if (linkedCategoryIds !== undefined) updateData.linkedCategoryIds = linkedCategoryIds;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const goal = await prisma.goal.update({
      where: { id },
      data: updateData,
    });
    
    const db = getDb(req);
    const progress = calculateGoalProgress(goal, db);
    
    // Convert DateTime to ISO strings and handle JSON fields
    res.json({
      data: {
        ...progress,
        goal: {
          ...progress.goal,
          targetDate: progress.goal.targetDate ? progress.goal.targetDate.toISOString() : null,
          linkedAccountIds: progress.goal.linkedAccountIds ? (progress.goal.linkedAccountIds as any) : null,
          linkedCategoryIds: progress.goal.linkedCategoryIds ? (progress.goal.linkedCategoryIds as any) : null,
          createdAt: progress.goal.createdAt.toISOString(),
          updatedAt: progress.goal.updatedAt.toISOString(),
        },
        projectedCompletionDate: progress.projectedCompletionDate ? progress.projectedCompletionDate.toISOString() : null,
      },
    });
  } catch (e: any) {
    console.error('[goals] PATCH error:', e);
    res.status(500).json({ error: e?.message || 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
goalsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.goal.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[goals] DELETE error:', e);
    res.status(500).json({ error: e?.message || 'Failed to delete goal' });
  }
});

