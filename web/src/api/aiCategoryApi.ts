export interface AiCategorySuggestion {
  categoryId: string;
  confidence: number; // 0–1
  reasoning?: string;
}

export interface CategorySuggestionResponse {
  suggestion: AiCategorySuggestion | null;
  disabled?: boolean;
  message?: string;
}

export interface CategoryFeedbackPayload {
  transactionId: string;
  suggestedCategoryId: string;
  accepted: boolean;
}

/**
 * Fetch an AI category suggestion for a transaction.
 * Returns null if AI is disabled, rate-limited, or fails.
 */
export async function fetchCategorySuggestion(transactionId: string): Promise<AiCategorySuggestion | null> {
  try {
    if (import.meta.env.DEV) {
      console.debug('[aiCategoryApi] Fetching suggestion for transactionId:', transactionId);
    }
    
    const res = await fetch('/api/ai/category-suggestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionId }),
    });

    if (res.status === 503) {
      // AI disabled
      const data = await res.json().catch(() => ({}));
      if (import.meta.env.DEV) {
        console.debug('[aiCategoryApi] AI categorization is disabled:', data);
      }
      return null;
    }

    if (res.status === 429) {
      // Rate limited
      if (import.meta.env.DEV) {
        console.debug('[aiCategory] Rate limit exceeded');
      }
      return null;
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error('[aiCategory] Failed to fetch suggestion:', res.status, res.statusText, errorText);
      return null;
    }

    const data = (await res.json()) as CategorySuggestionResponse;
    if (import.meta.env.DEV) {
      console.debug('[aiCategoryApi] Received response:', data);
    }
    return data.suggestion || null;
  } catch (error) {
    console.error('[aiCategory] Error fetching suggestion:', error);
    if (error instanceof Error && import.meta.env.DEV) {
      console.error('[aiCategory] Error details:', error.message, error.stack);
    }
    return null;
  }
}

/**
 * Send feedback about an AI category suggestion.
 */
export async function sendCategoryFeedback(payload: CategoryFeedbackPayload): Promise<void> {
  try {
    const res = await fetch('/api/ai/category-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[aiCategory] Failed to send feedback:', res.status, res.statusText);
    }
  } catch (error) {
    console.error('[aiCategory] Error sending feedback:', error);
    // Fail silently - feedback is not critical
  }
}

/**
 * Check if AI categorization is enabled (frontend flag).
 */
export function isAiCategorizationEnabled(): boolean {
  // Check window flag or env var
  if (typeof window !== 'undefined') {
    const flags = (window as any).NIMBUS_FLAGS;
    if (flags?.aiCategorization === false) {
      return false;
    }
  }

  // Check env var
  const envEnabled = import.meta.env.VITE_AI_CATEGORIZATION_ENABLED;
  if (envEnabled === 'false' || envEnabled === '0') {
    return false;
  }

  // Default to enabled if flag/env not explicitly set to false
  // The backend will still check its own config
  return true;
}

