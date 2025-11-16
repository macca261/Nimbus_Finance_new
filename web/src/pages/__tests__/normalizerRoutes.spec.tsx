/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NormalizerAdminPage } from '../admin/NormalizerAdminPage';
import SettingsNormalizer from '../settings/SettingsNormalizer';

vi.mock('../../features/normalizer/RulesTable', () => ({
  __esModule: true,
  default: () => <div data-testid="rules-table">Rules Table</div>,
}));

vi.mock('../../features/normalizer/RuleTester', () => ({
  __esModule: true,
  default: () => <div data-testid="rule-tester">Rule Tester</div>,
}));

vi.mock('../../features/normalizer/PreviewCard', () => ({
  __esModule: true,
  default: () => <div data-testid="preview-card">Preview Card</div>,
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(() => {
  cleanup();
});

describe('Normalizer routes', () => {
  it('renders admin normalizer console', () => {
    renderWithRouter(<NormalizerAdminPage />);
    expect(screen.getByRole('heading', { name: 'Normalizer' })).toBeTruthy();
    expect(screen.getByTestId('rules-table')).toBeTruthy();
    expect(screen.getByTestId('rule-tester')).toBeTruthy();
    expect(screen.queryByText('Settings / Normalizer (Admin)')).toBeNull();
  });

  it('renders settings normalizer alias with breadcrumb and shared console', () => {
    renderWithRouter(<SettingsNormalizer />);
    expect(screen.getByRole('heading', { name: 'Normalizer' })).toBeTruthy();
    expect(screen.getByText(/Settings\s*\/\s*Normalizer \(Admin\)/i)).toBeTruthy();
    expect(
      screen.getByText(/This view reuses the Admin Normalizer console/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Changes here affect the import pipeline/i),
    ).toBeTruthy();
    expect(screen.getByTestId('rules-table')).toBeTruthy();
    expect(screen.getByTestId('rule-tester')).toBeTruthy();
    expect(screen.getByTestId('preview-card')).toBeTruthy();
  });
});


