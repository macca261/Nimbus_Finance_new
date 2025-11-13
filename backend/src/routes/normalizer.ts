import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import { db } from '../db';
import { clearRulesCache, normalize as runNormalizer } from '../normalizer/engine';
import type { RuleMatcher } from '../normalizer/types';

const MATCHERS: RuleMatcher[] = ['contains', 'regex', 'startsWith', 'equals'];
const MIN_PATTERN_LENGTH = 2;

type RuleRow = {
  id: string;
  is_active: number;
  priority: number;
  matcher: RuleMatcher;
  pattern: string;
  normalizeTo: string;
  categoryHint: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const toApiRule = (row: RuleRow) => ({
  id: row.id,
  is_active: Boolean(row.is_active),
  priority: row.priority,
  matcher: row.matcher,
  pattern: row.pattern,
  normalizeTo: row.normalizeTo,
  categoryHint: row.categoryHint,
  notes: row.notes,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const readRule = (id: string): RuleRow | undefined =>
  db
    .prepare<unknown[], RuleRow>(
      `SELECT id, is_active, priority, matcher, pattern, normalizeTo, categoryHint, notes, createdAt, updatedAt
       FROM normalization_rules
       WHERE id = ?`,
    )
    .get(id);

const hasDuplicate = (matcher: RuleMatcher, pattern: string, normalizeTo: string, excludeId?: string): boolean => {
  if (excludeId) {
    const existing = db
      .prepare<[RuleMatcher, string, string, string], { id: string } | undefined>(
        `SELECT id FROM normalization_rules WHERE matcher = ? AND pattern = ? AND normalizeTo = ? AND id <> ? LIMIT 1`,
      )
      .get(matcher, pattern, normalizeTo, excludeId);
    return Boolean(existing);
  }

  const existing = db
    .prepare<[RuleMatcher, string, string], { id: string } | undefined>(
      `SELECT id FROM normalization_rules WHERE matcher = ? AND pattern = ? AND normalizeTo = ? LIMIT 1`,
    )
    .get(matcher, pattern, normalizeTo);
  return Boolean(existing);
};

const normalizerRouter = Router();

normalizerRouter.get('/rules', (_req, res) => {
  const rows = db
    .prepare<unknown[], RuleRow>(
      `SELECT id, is_active, priority, matcher, pattern, normalizeTo, categoryHint, notes, createdAt, updatedAt
       FROM normalization_rules
       ORDER BY priority ASC, createdAt ASC`,
    )
    .all();

  res.json({
    rules: rows.map(toApiRule),
  });
});

normalizerRouter.post('/rules', (req, res) => {
  try {
    const { matcher, pattern, normalizeTo, priority, isActive, categoryHint, notes } = req.body ?? {};

    if (!MATCHERS.includes(matcher)) {
      return res.status(400).json({ ok: false, code: 'INVALID_MATCHER', message: 'matcher must be one of contains|regex|startsWith|equals' });
    }

    if (typeof pattern !== 'string' || pattern.trim().length < MIN_PATTERN_LENGTH) {
      return res.status(400).json({ ok: false, code: 'INVALID_PATTERN', message: `pattern must be at least ${MIN_PATTERN_LENGTH} characters` });
    }

    if (typeof normalizeTo !== 'string' || !normalizeTo.trim()) {
      return res.status(400).json({ ok: false, code: 'INVALID_NORMALIZE_TO', message: 'normalizeTo must be a non-empty string' });
    }

    const normalizedPattern = pattern.trim();
    const normalizedNormalizeTo = normalizeTo.trim();

    if (hasDuplicate(matcher, normalizedPattern, normalizedNormalizeTo)) {
      return res.status(400).json({ ok: false, code: 'DUPLICATE_RULE', message: 'A rule with the same matcher, pattern and normalizeTo already exists.' });
    }

    const id = randomUUID();
    const nextPriority = Number.isFinite(priority) ? Math.trunc(priority) : 100;
    const nextActive = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : 1;
    const nextCategoryHint = typeof categoryHint === 'string' && categoryHint.trim().length ? categoryHint.trim() : null;
    const nextNotes = typeof notes === 'string' && notes.trim().length ? notes.trim() : null;

    db.prepare(
      `INSERT INTO normalization_rules (id, matcher, pattern, normalizeTo, priority, is_active, categoryHint, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, matcher, normalizedPattern, normalizedNormalizeTo, nextPriority, nextActive, nextCategoryHint, nextNotes);

    clearRulesCache();

    const created = readRule(id);
    res.status(201).json({ ok: true, rule: created ? toApiRule(created) : null });
  } catch (error) {
    console.error('[normalizer] create failed', error);
    res.status(500).json({ ok: false, code: 'INTERNAL', message: 'Failed to create rule' });
  }
});

normalizerRouter.put('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = readRule(id);
    if (!existing) {
      return res.status(404).json({ ok: false, code: 'RULE_NOT_FOUND', message: 'Rule not found.' });
    }

    const { matcher, pattern, normalizeTo, priority, isActive, categoryHint, notes } = req.body ?? {};

    let nextMatcher: RuleMatcher = existing.matcher;
    if (matcher !== undefined) {
      if (!MATCHERS.includes(matcher)) {
        return res.status(400).json({ ok: false, code: 'INVALID_MATCHER', message: 'matcher must be one of contains|regex|startsWith|equals' });
      }
      nextMatcher = matcher;
    }

    let nextPattern = existing.pattern;
    if (pattern !== undefined) {
      if (typeof pattern !== 'string' || pattern.trim().length < MIN_PATTERN_LENGTH) {
        return res.status(400).json({ ok: false, code: 'INVALID_PATTERN', message: `pattern must be at least ${MIN_PATTERN_LENGTH} characters` });
      }
      nextPattern = pattern.trim();
    }

    let nextNormalizeTo = existing.normalizeTo;
    if (normalizeTo !== undefined) {
      if (typeof normalizeTo !== 'string' || !normalizeTo.trim()) {
        return res.status(400).json({ ok: false, code: 'INVALID_NORMALIZE_TO', message: 'normalizeTo must be a non-empty string' });
      }
      nextNormalizeTo = normalizeTo.trim();
    }

    if (hasDuplicate(nextMatcher, nextPattern, nextNormalizeTo, id)) {
      return res.status(400).json({ ok: false, code: 'DUPLICATE_RULE', message: 'A rule with the same matcher, pattern and normalizeTo already exists.' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (nextMatcher !== existing.matcher) {
      fields.push('matcher = ?');
      values.push(nextMatcher);
    }
    if (nextPattern !== existing.pattern) {
      fields.push('pattern = ?');
      values.push(nextPattern);
    }
    if (nextNormalizeTo !== existing.normalizeTo) {
      fields.push('normalizeTo = ?');
      values.push(nextNormalizeTo);
    }
    if (priority !== undefined) {
      if (!Number.isFinite(priority)) {
        return res.status(400).json({ ok: false, code: 'INVALID_PRIORITY', message: 'priority must be a number' });
      }
      fields.push('priority = ?');
      values.push(Math.trunc(priority));
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ ok: false, code: 'INVALID_IS_ACTIVE', message: 'isActive must be a boolean' });
      }
      fields.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    if (categoryHint !== undefined) {
      if (categoryHint === null) {
        fields.push('categoryHint = NULL');
      } else if (typeof categoryHint === 'string') {
        const trimmed = categoryHint.trim();
        fields.push('categoryHint = ?');
        values.push(trimmed.length ? trimmed : null);
      } else {
        return res.status(400).json({ ok: false, code: 'INVALID_CATEGORY_HINT', message: 'categoryHint must be a string or null' });
      }
    }
    if (notes !== undefined) {
      if (notes === null) {
        fields.push('notes = NULL');
      } else if (typeof notes === 'string') {
        const trimmed = notes.trim();
        fields.push('notes = ?');
        values.push(trimmed.length ? trimmed : null);
      } else {
        return res.status(400).json({ ok: false, code: 'INVALID_NOTES', message: 'notes must be a string or null' });
      }
    }

    if (!fields.length) {
      return res.status(400).json({ ok: false, code: 'NO_CHANGES', message: 'No update fields provided.' });
    }

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE normalization_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    clearRulesCache();

    const updated = readRule(id);
    res.json({ ok: true, rule: updated ? toApiRule(updated) : null });
  } catch (error) {
    console.error('[normalizer] update failed', error);
    res.status(500).json({ ok: false, code: 'INTERNAL', message: 'Failed to update rule' });
  }
});

normalizerRouter.delete('/rules', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length) : [];
  if (!ids.length) {
    return res.status(400).json({ ok: false, code: 'INVALID_IDS', message: 'ids array required' });
  }

  const statement = db.prepare(`DELETE FROM normalization_rules WHERE id IN (${ids.map(() => '?').join(',')})`);
  const result = statement.run(...ids);
  clearRulesCache();

  res.json({ ok: true, deleted: result.changes ?? 0 });
});

normalizerRouter.post('/test', (req, res) => {
  const { text, counterparty } = req.body ?? {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, code: 'INVALID_TEXT', message: 'text is required' });
  }

  const result = runNormalizer({ text, counterparty: typeof counterparty === 'string' ? counterparty : undefined });
  res.json({ ok: true, result });
});

export default normalizerRouter;


