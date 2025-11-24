import { redactTransactionForAi } from '../lib/redactTransactionForAi';
import { getAiConfig } from '../config/ai';
import type { NormalizedTransaction } from '../types/transactions';

export interface AiCategorySuggestion {
  categoryId: string;
  confidence: number; // 0–1
  reasoning?: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  parentId?: string | null;
}

/**
 * Build a prompt for the AI model to suggest a category.
 */
function buildPrompt(
  redactedTx: ReturnType<typeof redactTransactionForAi>,
  categories: CategoryOption[],
  locale: string = 'de-DE',
): string {
  const categoryList = categories
    .map(cat => `  - ${cat.id}: ${cat.label}`)
    .join('\n');

  const amountFormatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.abs(redactedTx.amount));

  return `Du bist ein Finanzassistent, der Bankbuchungen kategorisiert.

Buchung:
- Beschreibung: ${redactedTx.description}
- Betrag: ${amountFormatted}
- Richtung: ${redactedTx.direction === 'in' ? 'Einnahme' : 'Ausgabe'}
- Datum: ${redactedTx.date}

Verfügbare Kategorien:
${categoryList}

Wähle genau eine Kategorie-ID aus der Liste oben, die am besten zu dieser Buchung passt.

Antworte NUR mit einem JSON-Objekt im folgenden Format (keine zusätzlichen Erklärungen):
{
  "categoryId": "kategorie-id",
  "confidence": 0.85,
  "reasoning": "Kurze Begründung auf Deutsch"
}

Wichtig:
- categoryId muss exakt eine der oben aufgeführten IDs sein
- confidence ist eine Zahl zwischen 0.0 und 1.0
- reasoning ist optional, aber hilfreich`;
}

/**
 * Call the OpenAI-compatible API to get a category suggestion.
 */
async function callAiApi(
  prompt: string,
  config: ReturnType<typeof getAiConfig>,
): Promise<string> {
  const apiUrl =
    config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(5000), // 5 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI API returned empty response');
  }

  return content;
}

/**
 * Parse JSON response from AI, handling markdown code blocks.
 */
function parseAiResponse(content: string): AiCategorySuggestion | null {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }

  // Try to extract JSON object
  const jsonMatch2 = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch2) {
    cleaned = jsonMatch2[0];
  }

  try {
    const parsed = JSON.parse(cleaned) as {
      categoryId?: string;
      confidence?: number;
      reasoning?: string;
    };

    if (!parsed.categoryId || typeof parsed.confidence !== 'number') {
      return null;
    }

    // Clamp confidence to [0, 1]
    const confidence = Math.max(0, Math.min(1, parsed.confidence));

    return {
      categoryId: parsed.categoryId,
      confidence,
      reasoning: parsed.reasoning,
    };
  } catch {
    return null;
  }
}

/**
 * Get an AI category suggestion for a transaction.
 * Returns null if AI is disabled, API call fails, or response is invalid.
 */
export async function getAiCategorySuggestion(
  tx: NormalizedTransaction,
  categories: CategoryOption[],
  opts?: { locale?: string },
): Promise<AiCategorySuggestion | null> {
  const config = getAiConfig();

  if (!config.enabled || !config.apiKey) {
    return null;
  }

  try {
    // Redact transaction for privacy
    const redacted = redactTransactionForAi(tx);

    // Build prompt
    const prompt = buildPrompt(redacted, categories, opts?.locale || 'de-DE');

    // Call AI API
    const response = await callAiApi(prompt, config);

    // Parse response
    const suggestion = parseAiResponse(response);

    return suggestion;
  } catch (error) {
    // Log error but don't throw - fail gracefully
    console.error('[aiCategoryService] Failed to get suggestion:', error);
    return null;
  }
}

