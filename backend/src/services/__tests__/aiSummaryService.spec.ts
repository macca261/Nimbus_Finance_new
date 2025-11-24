import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getMonthNarrative } from '../aiSummaryService';
import type { MonthSummary } from '../monthSummaryService';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock AI config
vi.mock('../../config/ai', () => ({
  getAiConfig: () => ({
    enabled: true,
    coachEnabled: true,
    provider: 'openai',
    coachModel: 'gpt-4o-mini',
    apiKey: 'test-key',
  }),
}));

describe('aiSummaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env var
    delete process.env.AI_SUMMARY_ENABLED;
  });

  const mockSummary: MonthSummary = {
    period: { start: '2024-01-01', end: '2024-01-31' },
    incomeCents: 300000,
    expenseCents: 50000,
    netCents: 250000,
    changeVsPrevMonthPct: 10.5,
    topCategories: [
      { categoryId: 'groceries', name: 'Lebensmittel & Drogerie', amountCents: 20000, sharePct: 40 },
      { categoryId: 'transport', name: 'ÖPNV & Mobilität', amountCents: 15000, sharePct: 30 },
    ],
    biggestExpense: {
      transactionId: '123',
      displayName: 'REWE Markt',
      amountCents: 5000,
      date: '2024-01-15',
      categoryId: 'groceries',
      categoryName: 'Lebensmittel & Drogerie',
    },
    highlights: [],
  };

  it('returns template narrative when AI is disabled', async () => {
    process.env.AI_SUMMARY_ENABLED = 'false';

    const narrative = await getMonthNarrative(mockSummary, { locale: 'de' });

    expect(narrative).toBeDefined();
    expect(narrative.bullets).toBeDefined();
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('returns template narrative when API key is missing', async () => {
    vi.mock('../../config/ai', () => ({
      getAiConfig: () => ({
        enabled: false,
        coachEnabled: false,
        provider: 'openai',
        coachModel: 'gpt-4o-mini',
        apiKey: null,
      }),
    }));

    // Re-import to get the mocked config
    const { getMonthNarrative: getNarrative } = await import('../aiSummaryService');
    const narrative = await getNarrative(mockSummary, { locale: 'de' });

    expect(narrative).toBeDefined();
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('calls AI API and returns narrative when enabled', async () => {
    process.env.AI_SUMMARY_ENABLED = 'true';

    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                bullets: [
                  'Einnahmen: 3.000,00 €, Ausgaben: 500,00 €',
                  'Netto: +2.500,00 €',
                  'Hauptausgabe: Lebensmittel & Drogerie (200,00 €)',
                ],
              }),
            },
          },
        ],
      },
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    const narrative = await getMonthNarrative(mockSummary, { locale: 'de' });

    expect(mockedAxios.post).toHaveBeenCalled();
    expect(narrative).toBeDefined();
    expect(narrative.bullets.length).toBe(3);
    expect(narrative.bullets[0]).toContain('Einnahmen');
  });

  it('falls back to template when AI returns invalid structure', async () => {
    process.env.AI_SUMMARY_ENABLED = 'true';

    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ invalid: 'structure' }),
            },
          },
        ],
      },
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    const narrative = await getMonthNarrative(mockSummary, { locale: 'de' });

    expect(narrative).toBeDefined();
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3);
    // Should contain template content
    expect(narrative.bullets.some(b => b.includes('Einnahmen'))).toBe(true);
  });

  it('falls back to template when AI request fails', async () => {
    process.env.AI_SUMMARY_ENABLED = 'true';

    mockedAxios.post.mockRejectedValue(new Error('API error'));

    const narrative = await getMonthNarrative(mockSummary, { locale: 'de' });

    expect(narrative).toBeDefined();
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('limits bullets to 5 and validates length', async () => {
    process.env.AI_SUMMARY_ENABLED = 'true';

    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                bullets: [
                  'Bullet 1',
                  'Bullet 2',
                  'Bullet 3',
                  'Bullet 4',
                  'Bullet 5',
                  'Bullet 6', // Should be ignored
                  'A'.repeat(150), // Too long, should be ignored
                ],
              }),
            },
          },
        ],
      },
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    const narrative = await getMonthNarrative(mockSummary, { locale: 'de' });

    expect(narrative.bullets.length).toBe(5);
    expect(narrative.bullets.every(b => b.length <= 120)).toBe(true);
  });

  it('generates English template when locale is en', async () => {
    process.env.AI_SUMMARY_ENABLED = 'false';

    const narrative = await getMonthNarrative(mockSummary, { locale: 'en' });

    expect(narrative).toBeDefined();
    expect(narrative.bullets.length).toBeGreaterThanOrEqual(3);
    expect(narrative.bullets.some(b => b.includes('Income') || b.includes('Expenses'))).toBe(true);
  });
});

