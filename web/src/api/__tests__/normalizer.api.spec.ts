import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createNormalizationRule,
  deleteNormalizationRules,
  listNormalizationRules,
  testNormalizer,
  updateNormalizationRule,
  type CreateRuleInput,
  type NormalizationRule,
  type NormalizerResult,
} from '../normalizer';

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizer api client', () => {
  it('lists rules', async () => {
    const rules: NormalizationRule[] = [
      {
        id: 'rule-1',
        matcher: 'contains',
        pattern: 'uber',
        normalizeTo: 'Uber',
        priority: 10,
        is_active: true,
        categoryHint: 'mobility',
        notes: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-02',
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ rules }));

    const result = await listNormalizationRules();
    expect(fetchMock).toHaveBeenCalledWith('/api/normalizer/rules', { method: 'GET' });
    expect(result).toEqual({ ok: true, data: rules });
  });

  it('handles list failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Nope' }, { status: 500, statusText: 'Server Error' }),
    );
    const result = await listNormalizationRules();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Nope');
    }
  });

  it('creates rule', async () => {
    const payload: CreateRuleInput = {
      matcher: 'contains',
      pattern: 'rewe',
      normalizeTo: 'REWE',
      priority: 20,
      is_active: true,
    };
    const created: NormalizationRule = {
      id: 'rule-create',
      matcher: payload.matcher,
      pattern: payload.pattern,
      normalizeTo: payload.normalizeTo,
      priority: 20,
      is_active: true,
      categoryHint: null,
      notes: null,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ok: true, rule: created }, { status: 201 }));

    const result = await createNormalizationRule(payload);
    expect(fetchMock).toHaveBeenCalledWith('/api/normalizer/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(result).toEqual({ ok: true, data: created });
  });

  it('handles create failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Duplicate rule' }, { status: 400 }),
    );
    const result = await createNormalizationRule({
      matcher: 'contains',
      pattern: 'test',
      normalizeTo: 'Test',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Duplicate rule');
  });

  it('updates rule', async () => {
    const updated: NormalizationRule = {
      id: 'rule-1',
      matcher: 'contains',
      pattern: 'uber',
      normalizeTo: 'Uber Updated',
      priority: 5,
      is_active: false,
      categoryHint: null,
      notes: null,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-03',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ok: true, rule: updated }));

    const result = await updateNormalizationRule('rule-1', { normalizeTo: 'Uber Updated' });
    expect(fetchMock).toHaveBeenCalledWith('/api/normalizer/rules/rule-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ normalizeTo: 'Uber Updated' }),
    });
    expect(result).toEqual({ ok: true, data: updated });
  });

  it('handles update failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Rule not found' }, { status: 404 }),
    );
    const result = await updateNormalizationRule('missing', { normalizeTo: 'X' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Rule not found');
  });

  it('deletes rules', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ok: true, deleted: 2 }));

    const result = await deleteNormalizationRules(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledWith('/api/normalizer/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['a', 'b'] }),
    });
    expect(result).toEqual({ ok: true, data: 2 });
  });

  it('handles delete failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'ids array required' }, { status: 400 }),
    );
    const result = await deleteNormalizationRules([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ids array required');
  });

  it('tests normalizer', async () => {
    const expected: NormalizerResult = {
      merchant: 'Uber',
      categoryHint: 'mobility',
      matchedRuleId: 'rule-uber',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ok: true, result: expected }));

    const result = await testNormalizer({ text: 'Uber BV Fahrt', counterparty: 'Uber BV' });
    expect(fetchMock).toHaveBeenCalledWith('/api/normalizer/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Uber BV Fahrt', counterparty: 'Uber BV' }),
    });
    expect(result).toEqual({ ok: true, data: expected });
  });

  it('handles tester network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network down'));
    const result = await testNormalizer({ text: 'sample' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Network down');
  });
});


