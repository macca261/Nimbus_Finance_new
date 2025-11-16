/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { AdminImports } from '../AdminImports';

vi.mock('../../../layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const toastSpy = vi.fn();
vi.mock('../../../lib/toast', () => ({
  toast: (message: string) => toastSpy(message),
}));

const emitSpy = vi.fn();
vi.mock('../../../lib/dataEvents', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/dataEvents')>(
    '../../../lib/dataEvents',
  );
  return {
    ...actual,
    emitDataMutated: (...args: Parameters<typeof actual.emitDataMutated>) => {
      emitSpy(...args);
      actual.emitDataMutated(...args);
    },
  };
});

describe('AdminImports page', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    toastSpy.mockClear();
    emitSpy.mockClear();
  });

  it('renders list of imports returned by API', async () => {
    const runs = [
      {
        id: 1,
        createdAt: '2025-01-01T10:00:00Z',
        source: 'n26_de',
        rowCount: 5,
        insertedCount: 4,
        profileId: 'n26_de',
        fileName: 'n26.csv',
      },
    ];
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ imports: runs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AdminImports />);

    await waitFor(() => {
      expect(screen.getByText('n26.csv')).toBeTruthy();
    });
    expect(screen.getByText('n26_de')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('deletes selected imports and refetches list', async () => {
    const first = {
      id: 1,
      createdAt: '2025-01-01T10:00:00Z',
      source: 'n26_de',
      rowCount: 5,
      insertedCount: 4,
      profileId: 'n26_de',
      fileName: 'n26.csv',
    };
    const second = {
      id: 2,
      createdAt: '2025-01-02T10:00:00Z',
      source: 'commerzbank_de',
      rowCount: 3,
      insertedCount: 3,
      profileId: 'commerzbank_de',
      fileName: 'commerzbank.csv',
    };

    let getCall = 0;
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/admin/imports') && (!init || init.method === 'GET')) {
        const payload =
          getCall === 0 ? { imports: [first, second] } : { imports: [second] };
        getCall += 1;
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.startsWith('/api/admin/imports') && init?.method === 'DELETE') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, deletedImports: 1, deletedTransactions: 4 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as unknown as typeof fetch;

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminImports />);

    await waitFor(() => {
      expect(screen.getByText('n26.csv')).toBeTruthy();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[1]);
    const deleteButtons = screen.getAllByRole('button', { name: /Ausgewählte löschen/i });
    const deleteButton =
      deleteButtons.find(btn => !(btn as HTMLButtonElement).disabled) ?? deleteButtons[0];
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(emitSpy).toHaveBeenCalled();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/imports', expect.objectContaining({ method: 'DELETE' }));
    expect(toastSpy).toHaveBeenCalled();
    expect(getCall).toBeGreaterThanOrEqual(2);
    confirmSpy.mockRestore();
  });
});


