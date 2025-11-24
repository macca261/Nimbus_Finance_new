import { getAiConfig } from '../config/ai';
import type { MonthSummary } from './monthSummaryService';
import axios from 'axios';

export interface MonthNarrative {
  bullets: string[]; // each max. ~120 characters
}

/**
 * Generate a German narrative from monthly summary metrics.
 * Returns template-based bullets if AI is disabled or fails.
 */
export async function getMonthNarrative(
  summary: MonthSummary,
  opts?: { locale?: 'de' | 'en' },
): Promise<MonthNarrative> {
  const config = getAiConfig();
  const locale = opts?.locale || 'de';

  // Check if AI summary is enabled (use AI_SUMMARY_ENABLED env var or default to coachEnabled)
  const aiSummaryEnabled = process.env.AI_SUMMARY_ENABLED?.toLowerCase() === 'true' || 
                           process.env.AI_SUMMARY_ENABLED === '1' ||
                           (config.coachEnabled && process.env.AI_SUMMARY_ENABLED !== 'false');

  if (!aiSummaryEnabled || !config.apiKey) {
    return getTemplateNarrative(summary, locale);
  }

  try {
    const formatCents = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
    const formatPct = (pct: number) => {
      const sign = pct >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(1)}%`;
    };

    // Build a compact summary for AI
    const summaryData = {
      period: `${summary.period.start} bis ${summary.period.end}`,
      income: `${formatCents(summary.incomeCents)} €`,
      expenses: `${formatCents(summary.expenseCents)} €`,
      net: `${formatCents(summary.netCents)} €`,
      changeVsPrevMonth: summary.changeVsPrevMonthPct !== null 
        ? formatPct(summary.changeVsPrevMonthPct) 
        : null,
      topCategories: summary.topCategories.map(cat => ({
        name: cat.name,
        amount: `${formatCents(cat.amountCents)} €`,
        share: `${cat.sharePct.toFixed(1)}%`,
      })),
      biggestExpense: summary.biggestExpense ? {
        displayName: summary.biggestExpense.displayName,
        amount: `${formatCents(summary.biggestExpense.amountCents)} €`,
        category: summary.biggestExpense.categoryName,
        date: summary.biggestExpense.date,
      } : null,
    };

    const prompt = locale === 'de'
      ? `Du bist ein freundlicher Finanzcoach für eine persönliche Finanz-App.
Erstelle eine kurze, prägnante Monatszusammenfassung in 3-5 Stichpunkten (jeweils max. 120 Zeichen) basierend auf folgenden Daten:

Daten (JSON):
${JSON.stringify(summaryData, null, 2)}

Erstelle 3-5 kurze, freundliche Stichpunkte auf Deutsch, die:
- Die wichtigsten Erkenntnisse des Monats zusammenfassen
- Konkrete Zahlen und Kategorienamen verwenden (nicht technische IDs)
- Den displayName von Transaktionen verwenden, nicht rohe Buchungstexte
- Freundlich und ermutigend sind, nicht belehrend
- Maximal 120 Zeichen pro Punkt haben

Antworte NUR mit einem JSON-Objekt im folgenden Format (keine zusätzlichen Erklärungen):
{
  "bullets": [
    "Stichpunkt 1",
    "Stichpunkt 2",
    "Stichpunkt 3"
  ]
}

Wichtig:
- Verwende die Kategorienamen aus den Daten (z.B. "Lebensmittel & Drogerie" statt "groceries")
- Verwende displayName-Werte für Transaktionen (z.B. "REWE Markt" statt "REWE MARKT 123 BERLIN")
- Sei konkret mit Zahlen
- Halte jeden Punkt unter 120 Zeichen`
      : `You are a friendly financial coach for a personal finance app.
Create a short, concise monthly summary in 3-5 bullet points (max. 120 characters each) based on the following data:

Data (JSON):
${JSON.stringify(summaryData, null, 2)}

Create 3-5 short, friendly bullet points in English that:
- Summarize the most important insights of the month
- Use concrete numbers and category names (not technical IDs)
- Use displayName values for transactions, not raw booking text
- Are friendly and encouraging, not preachy
- Have a maximum of 120 characters per point

Respond ONLY with a JSON object in the following format (no additional explanations):
{
  "bullets": [
    "Bullet point 1",
    "Bullet point 2",
    "Bullet point 3"
  ]
}

Important:
- Use category names from the data (e.g., "Groceries" instead of "groceries")
- Use displayName values for transactions (e.g., "REWE Market" instead of "REWE MARKT 123 BERLIN")
- Be concrete with numbers
- Keep each point under 120 characters`;

    const apiUrl = config.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : config.provider;

    const response = await axios.post(
      apiUrl,
      {
        model: config.coachModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      },
    );

    const rawContent = response.data.choices[0]?.message?.content;
    if (!rawContent) {
      console.warn('[aiSummaryService] No content from AI.');
      return getTemplateNarrative(summary, locale);
    }

    const parsed = JSON.parse(rawContent) as { bullets?: string[] };
    if (!parsed.bullets || !Array.isArray(parsed.bullets) || parsed.bullets.length === 0) {
      console.warn('[aiSummaryService] Invalid narrative structure from AI.');
      return getTemplateNarrative(summary, locale);
    }

    // Validate and limit bullets (3-5, max 120 chars each)
    const bullets = parsed.bullets
      .slice(0, 5)
      .filter((b): b is string => typeof b === 'string' && b.length > 0 && b.length <= 120);

    if (bullets.length < 3) {
      console.warn('[aiSummaryService] Not enough valid bullets from AI.');
      return getTemplateNarrative(summary, locale);
    }

    return { bullets };
  } catch (error: any) {
    console.error('[aiSummaryService] Error fetching AI narrative:', error?.response?.data || error.message);
    return getTemplateNarrative(summary, locale);
  }
}

/**
 * Generate template-based narrative when AI is disabled or fails.
 */
function getTemplateNarrative(summary: MonthSummary, locale: 'de' | 'en'): MonthNarrative {
  const formatCents = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const bullets: string[] = [];

  if (locale === 'de') {
    // Income
    if (summary.incomeCents > 0) {
      bullets.push(`Einnahmen: ${formatCents(summary.incomeCents)} €`);
    }

    // Expenses
    if (summary.expenseCents > 0) {
      bullets.push(`Ausgaben: ${formatCents(summary.expenseCents)} €`);
    }

    // Net
    if (summary.netCents > 0) {
      bullets.push(`Netto: +${formatCents(summary.netCents)} €`);
    } else if (summary.netCents < 0) {
      bullets.push(`Netto: ${formatCents(summary.netCents)} €`);
    }

    // Top category
    if (summary.topCategories.length > 0) {
      const top = summary.topCategories[0];
      bullets.push(`Hauptausgabe: ${top.name} (${formatCents(top.amountCents)} €)`);
    }

    // Change vs previous month
    if (summary.changeVsPrevMonthPct !== null) {
      const sign = summary.changeVsPrevMonthPct >= 0 ? '+' : '';
      bullets.push(`Veränderung zum Vormonat: ${sign}${summary.changeVsPrevMonthPct.toFixed(1)}%`);
    }
  } else {
    // English fallback
    if (summary.incomeCents > 0) {
      bullets.push(`Income: ${formatCents(summary.incomeCents)} €`);
    }
    if (summary.expenseCents > 0) {
      bullets.push(`Expenses: ${formatCents(summary.expenseCents)} €`);
    }
    if (summary.netCents > 0) {
      bullets.push(`Net: +${formatCents(summary.netCents)} €`);
    } else if (summary.netCents < 0) {
      bullets.push(`Net: ${formatCents(summary.netCents)} €`);
    }
    if (summary.topCategories.length > 0) {
      const top = summary.topCategories[0];
      bullets.push(`Top category: ${top.name} (${formatCents(top.amountCents)} €)`);
    }
    if (summary.changeVsPrevMonthPct !== null) {
      const sign = summary.changeVsPrevMonthPct >= 0 ? '+' : '';
      bullets.push(`Change vs previous month: ${sign}${summary.changeVsPrevMonthPct.toFixed(1)}%`);
    }
  }

  // Ensure we have at least 3 bullets
  while (bullets.length < 3) {
    bullets.push(locale === 'de' ? 'Keine weiteren Daten verfügbar.' : 'No additional data available.');
  }

  return { bullets: bullets.slice(0, 5) };
}

