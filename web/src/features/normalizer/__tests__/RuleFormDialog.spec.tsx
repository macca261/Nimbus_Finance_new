/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi, describe, expect, it } from 'vitest';

import RuleFormDialog, { type RuleFormSubmitValues } from '../RuleFormDialog';
import type { NormalizationRule } from '../../../api/normalizer';

const matcherLabels = {
  contains: 'Enthält',
  startsWith: 'Beginnt mit',
  equals: 'Exakt gleich',
  regex: 'Regex',
} as const;

const baseRule: NormalizationRule = {
  id: 'rule-1',
  matcher: 'contains',
  pattern: 'uber',
  normalizeTo: 'Uber',
  priority: 10,
  is_active: true,
  categoryHint: 'transport:rideshare',
  notes: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

const setup = (override?: Partial<NormalizationRule>, rules: NormalizationRule[] = [baseRule]) => {
  const onSubmit = vi.fn<[], Promise<{ ok: boolean; data?: NormalizationRule; error?: string }>>();
  const onClose = vi.fn();
  const initial = { ...baseRule, ...override };
  render(
    <RuleFormDialog
      open
      mode={override ? 'edit' : 'create'}
      initial={initial}
      matcherLabels={matcherLabels}
      onSubmit={onSubmit}
      onClose={onClose}
      existingRules={rules}
    />,
  );
  return { onSubmit, onClose };
};

afterEach(() => {
  cleanup();
});

describe('RuleFormDialog', () => {
  it('validates regex pattern', async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText('Matcher'), 'regex');
    const patternInput = screen.getByLabelText('Pattern');
    await userEvent.clear(patternInput);
    await userEvent.type(patternInput, '(');
    await userEvent.click(screen.getAllByText('Erstellen')[0]);

    expect(await screen.findByText(/Regex ungültig/i)).toBeTruthy();
  });

  it('requires normalizeTo value', async () => {
    setup();
    const normalizeInput = screen.getByLabelText('Normalisiert zu');
    await userEvent.clear(normalizeInput);
    await userEvent.click(screen.getAllByText('Erstellen')[0]);

    expect(await screen.findByText(/Pflichtfeld/)).toBeTruthy();
  });

  it('submits sanitized values and closes on success', async () => {
    const onSubmit = vi.fn<
      [RuleFormSubmitValues],
      Promise<{ ok: true; data: NormalizationRule }>
    >().mockResolvedValue({ ok: true, data: baseRule });
    const onClose = vi.fn();

    render(
      <RuleFormDialog
        open
        mode="create"
        initial={{ ...baseRule, id: 'new', pattern: '', normalizeTo: '', priority: 5 }}
        matcherLabels={matcherLabels}
        onSubmit={onSubmit}
        onClose={onClose}
        existingRules={[baseRule]}
      />,
    );

    const patternInput = screen.getByLabelText('Pattern');
    await userEvent.clear(patternInput);
    await userEvent.type(patternInput, 'alnatura');
    await userEvent.type(screen.getByLabelText('Normalisiert zu'), 'Alnatura');
    await userEvent.clear(screen.getByLabelText('Priorität'));
    await userEvent.type(screen.getByLabelText('Priorität'), '5');
    await userEvent.click(screen.getAllByText('Erstellen')[0]);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.pattern).toBe('alnatura');
    expect(payload.normalizeTo).toBe('Alnatura');
    expect(payload.priority).toBe(5);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps dialog open on submit error', async () => {
    const onSubmit = vi
      .fn<[RuleFormSubmitValues], Promise<{ ok: false; error: string }>>()
      .mockResolvedValue({ ok: false, error: 'Duplicate rule' });
    const onClose = vi.fn();

    render(
      <RuleFormDialog
        open
        mode="edit"
        initial={baseRule}
        matcherLabels={matcherLabels}
        onSubmit={onSubmit}
        onClose={onClose}
        existingRules={[baseRule]}
      />,
    );

    await userEvent.click(screen.getByText('Speichern'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Duplicate rule/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows conflict warnings for existing rules', async () => {
    const otherRule: NormalizationRule = {
      ...baseRule,
      id: 'rule-2',
      pattern: 'alnatura',
      normalizeTo: 'BioMarkt',
    };
    setup(undefined, [baseRule, otherRule]);

    const patternInput = screen.getByLabelText('Pattern');
    await userEvent.clear(patternInput);
    await userEvent.type(patternInput, 'alnatura');
    const normalizeInput = screen.getByLabelText('Normalisiert zu');
    await userEvent.clear(normalizeInput);
    await userEvent.type(normalizeInput, 'Alnatura');

    expect(
      await screen.findByText(/Pattern wird bereits von Regel rule-2 auf "BioMarkt"/),
    ).toBeTruthy();
  });
});


