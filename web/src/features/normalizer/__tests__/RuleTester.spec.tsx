/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RuleTester from '../RuleTester';
import { testNormalizer } from '../../../api/normalizer';

vi.mock('../../../api/normalizer', () => ({
  testNormalizer: vi.fn(),
}));

const mockedTest = vi.mocked(testNormalizer);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RuleTester', () => {
  it('calls API and shows result', async () => {
    mockedTest.mockResolvedValue({
      ok: true,
      data: { merchant: 'Uber', categoryHint: 'transport:rideshare', matchedRuleId: 'rule-1' },
    });
    const onMatch = vi.fn();

    render(<RuleTester onMatch={onMatch} />);

    await userEvent.type(screen.getByLabelText('Beschreibung / Verwendungszweck'), 'UBER BV F123');
    await userEvent.type(screen.getByLabelText('Gegenpartei (optional)'), 'Uber BV');
    await userEvent.click(screen.getByText('Test ausführen'));

    await waitFor(() => expect(mockedTest).toHaveBeenCalledTimes(1));
    expect(mockedTest.mock.calls[0][0]).toEqual({
      text: 'UBER BV F123',
      counterparty: 'Uber BV',
    });
    await waitFor(() => expect(onMatch).toHaveBeenCalledWith('rule-1'));
    expect(await screen.findByText('Uber')).toBeTruthy();
    expect(screen.getByText(/transport:rideshare/)).toBeTruthy();
  });

  it('handles no match results', async () => {
    mockedTest.mockResolvedValue({
      ok: true,
      data: { merchant: undefined, categoryHint: undefined, matchedRuleId: undefined },
    });
    const onMatch = vi.fn();

    render(<RuleTester onMatch={onMatch} />);

    await userEvent.type(screen.getByLabelText('Beschreibung / Verwendungszweck'), 'REWE Markt');
    await userEvent.click(screen.getByText('Test ausführen'));

    await waitFor(() => expect(mockedTest).toHaveBeenCalledTimes(1));
    expect(onMatch).toHaveBeenCalledWith(null);
    const ruleInfo = screen.getByText(/Regel-ID:/);
    expect(ruleInfo.textContent).toContain('—');
  });

  it('shows inline error when API fails', async () => {
    mockedTest.mockResolvedValue({ ok: false, error: 'API down' });

    render(<RuleTester />);

    await userEvent.type(screen.getByLabelText('Beschreibung / Verwendungszweck'), 'Sample');
    await userEvent.click(screen.getByText('Test ausführen'));

    expect(await screen.findByText('API down')).toBeTruthy();
  });

  it('validates empty input', async () => {
    render(<RuleTester />);

    await userEvent.click(screen.getByText('Test ausführen'));
    expect(await screen.findByText(/Bitte gib mindestens eine Beschreibung ein/)).toBeTruthy();
  });
});


