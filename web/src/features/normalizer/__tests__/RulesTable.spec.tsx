/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, expect, it } from 'vitest';

import { RulesTable } from '../RulesTable';
import type { NormalizationRule } from '../../../api/normalizer';
import {
  listNormalizationRules,
  deleteNormalizationRules,
  createNormalizationRule,
  updateNormalizationRule,
} from '../../../api/normalizer';

vi.mock('../../../api/normalizer', () => ({
  listNormalizationRules: vi.fn(),
  updateNormalizationRule: vi.fn(),
  deleteNormalizationRules: vi.fn(),
  createNormalizationRule: vi.fn(),
}));

vi.mock('../../../lib/toast', () => ({
  toast: vi.fn(),
}));

const rulesFixture: NormalizationRule[] = [
  {
    id: 'rule-b',
    matcher: 'startsWith',
    pattern: 'rewe',
    normalizeTo: 'REWE',
    priority: 20,
    is_active: true,
    categoryHint: 'groceries',
    notes: null,
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-04T00:00:00.000Z',
  },
  {
    id: 'rule-a',
    matcher: 'contains',
    pattern: 'uber',
    normalizeTo: 'Uber',
    priority: 10,
    is_active: true,
    categoryHint: 'mobility',
    notes: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
];

const mockedList = vi.mocked(listNormalizationRules);
const mockedDelete = vi.mocked(deleteNormalizationRules);
const mockedCreate = vi.mocked(createNormalizationRule);
const mockedUpdate = vi.mocked(updateNormalizationRule);

beforeEach(() => {
  mockedList.mockResolvedValue({ ok: true, data: rulesFixture });
  mockedDelete.mockResolvedValue({ ok: true, data: 1 });
  mockedCreate.mockResolvedValue({
    ok: true,
    data: {
      ...rulesFixture[0],
      id: 'rule-new',
      pattern: 'alnatura',
      normalizeTo: 'Alnatura',
      priority: 30,
    },
  });
  mockedUpdate.mockResolvedValue({
    ok: true,
    data: { ...rulesFixture[0], normalizeTo: 'Uber Updated' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('RulesTable', () => {
  it('renders rules returned from API', async () => {
    render(<RulesTable />);

    expect(mockedList).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Uber')).toBeTruthy();
    expect(screen.getByText('REWE')).toBeTruthy();
  });

  it('opens create dialog and submits new rule', async () => {
    render(<RulesTable />);
    await screen.findAllByText('Uber');

    const createButtons = screen.getAllByRole('button', { name: 'Neue Regel' });
    await userEvent.click(createButtons[0]);
    const patternInput = await screen.findByLabelText('Pattern');
    await userEvent.clear(patternInput);
    await userEvent.type(patternInput, 'alnatura');
    const normalizeInput = screen.getByLabelText('Normalisiert zu');
    await userEvent.clear(normalizeInput);
    await userEvent.type(normalizeInput, 'Alnatura');
    await userEvent.click(screen.getByText('Erstellen'));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledTimes(1);
    });
    expect(mockedCreate.mock.calls[0][0].pattern).toBe('alnatura');
    await waitFor(() => {
      expect(screen.queryByText('Neue Regel anlegen')).toBeNull();
    });
  });

  it('opens edit dialog and submits update', async () => {
    render(<RulesTable />);
    await screen.findAllByText('Uber');

    const editButtons = await screen.findAllByText('Bearbeiten');
    await userEvent.click(editButtons[0]);
    const normalizeInput = await screen.findByLabelText('Normalisiert zu');
    await userEvent.clear(normalizeInput);
    await userEvent.type(normalizeInput, 'Uber Updated');
    await userEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpdate.mock.calls[0][1].normalizeTo).toBe('Uber Updated');
  });

  it('deletes a rule after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RulesTable />);

    const deleteButtons = await screen.findAllByText('Löschen');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledTimes(1);
    });
    confirmSpy.mockRestore();
  });
});



