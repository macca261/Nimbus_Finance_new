/**
 * AI categorization configuration.
 * Reads from environment variables and provides a strongly-typed config object.
 */

export interface AiConfig {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string | null;
  maxSuggestionsPerHour: number;
  coachEnabled: boolean;
  coachModel: string;
}

/**
 * Get AI categorization configuration from environment variables.
 * Returns a config object with enabled=false if AI_API_KEY is missing or AI_CATEGORIZATION_ENABLED is false.
 */
export function getAiConfig(): AiConfig {
  const apiKey = process.env.AI_API_KEY?.trim() || null;
  const enabledEnv = process.env.AI_CATEGORIZATION_ENABLED?.toLowerCase();
  const enabled = apiKey !== null && (enabledEnv === 'true' || enabledEnv === '1');
  
  // Log config status (only once on first call, or in dev mode)
  if (process.env.NODE_ENV !== 'production' || !(global as any).__aiConfigLogged) {
    console.log('[aiConfig] AI Configuration:', {
      hasApiKey: !!apiKey,
      enabledEnv,
      enabled,
      provider: process.env.AI_PROVIDER || 'openai',
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      maxSuggestionsPerHour: process.env.AI_MAX_SUGGESTIONS_PER_HOUR || '30',
    });
    if (!enabled && apiKey === null) {
      console.warn('[aiConfig] AI categorization disabled: AI_API_KEY is missing');
    } else if (!enabled && enabledEnv !== 'true' && enabledEnv !== '1') {
      console.warn('[aiConfig] AI categorization disabled: AI_CATEGORIZATION_ENABLED is not "true" or "1"');
    }
    (global as any).__aiConfigLogged = true;
  }
  
  const coachEnabledEnv = process.env.AI_COACH_ENABLED?.toLowerCase();
  const coachEnabled = apiKey !== null && (coachEnabledEnv !== 'false' && coachEnabledEnv !== '0') && enabled;

  return {
    enabled,
    provider: process.env.AI_PROVIDER || 'openai',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    apiKey,
    maxSuggestionsPerHour: Number.parseInt(process.env.AI_CATEGORIZATION_MAX_RPH || process.env.AI_MAX_SUGGESTIONS_PER_HOUR || '30', 10),
    coachEnabled,
    coachModel: process.env.AI_COACH_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
  };
}

/**
 * Check if AI categorization is enabled.
 */
export function isAiCategorizationEnabled(): boolean {
  return getAiConfig().enabled;
}

