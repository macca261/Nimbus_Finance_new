import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAiCategorySuggestion } from '../aiCategoryService';
import type { NormalizedTransaction } from '../../types/transactions';
import * as aiConfigModule from '../../config/ai';
import * as redactModule from '../../lib/redactTransactionForAi';

// Mock dependencies
vi.mock('../../config/ai');
vi.mock('../../lib/redactTransactionForAi');

// Mock fetch globally
global.fetch = vi.fn();

describe('aiCategoryService', () => {
  const mockTransaction: NormalizedTransaction = {
    id: '1',
    bookingDate: '2024-01-15',
    amountCents: -5000,
    currency: 'EUR',
    direction: 'out',
    rawText: 'Amazon Purchase',
    bankProfile: 'test',
    category: 'other',
    categoryConfidence: 0.5,
    categorySource: 'fallback',
  };

  const mockCategories = [
    { id: 'groceries', label: 'Lebensmittel & Supermarkt' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'dining', label: 'Restaurants' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redactModule.redactTransactionForAi).mockReturnValue({
      description: 'Amazon Purchase',
      amount: -50.0,
      direction: 'out',
      date: '2024-01-15',
    });
  });

  it('returns null when AI is disabled', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: null,
      maxSuggestionsPerHour: 30,
    });

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null when API key is missing', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: null,
      maxSuggestionsPerHour: 30,
    });

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
  });

  it('calls AI API with correct parameters', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categoryId: 'shopping',
                confidence: 0.85,
                reasoning: 'Amazon ist ein Einkaufsportal',
              }),
            },
          },
        ],
      }),
    } as Response);

    await getAiCategorySuggestion(mockTransaction, mockCategories);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.openai.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
        body: expect.stringContaining('gpt-4o-mini'),
      }),
    );
  });

  it('parses valid JSON response correctly', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categoryId: 'shopping',
                confidence: 0.92,
                reasoning: 'Amazon ist eindeutig Shopping',
              }),
            },
          },
        ],
      }),
    } as Response);

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);

    expect(result).toEqual({
      categoryId: 'shopping',
      confidence: 0.92,
      reasoning: 'Amazon ist eindeutig Shopping',
    });
  });

  it('clamps confidence to [0, 1]', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    // Test confidence > 1
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categoryId: 'shopping',
                confidence: 1.5,
              }),
            },
          },
        ],
      }),
    } as Response);

    const result1 = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result1?.confidence).toBe(1.0);

    // Test confidence < 0
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categoryId: 'shopping',
                confidence: -0.5,
              }),
            },
          },
        ],
      }),
    } as Response);

    const result2 = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result2?.confidence).toBe(0.0);
  });

  it('handles markdown code blocks in response', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n{"categoryId": "shopping", "confidence": 0.85}\n```',
            },
          },
        ],
      }),
    } as Response);

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);

    expect(result).toEqual({
      categoryId: 'shopping',
      confidence: 0.85,
      reasoning: undefined,
    });
  });

  it('returns null on invalid JSON', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'This is not JSON',
            },
          },
        ],
      }),
    } as Response);

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
  });

  it('returns null on HTTP error response', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    } as Response);

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
  });

  it('handles timeout gracefully', async () => {
    vi.mocked(aiConfigModule.getAiConfig).mockReturnValue({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      maxSuggestionsPerHour: 30,
    });

    vi.mocked(global.fetch).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        }),
    );

    const result = await getAiCategorySuggestion(mockTransaction, mockCategories);
    expect(result).toBeNull();
  });
});

