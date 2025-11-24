import { getAiConfig } from '../config/ai';
import type { MoneyCoachMetrics } from './moneyCoachMetricsService';
import axios from 'axios';

export interface AiCoachStory {
  title: string;
  insights: string[]; // 2–3 bullet points
  actions: string[]; // 1–2 suggested next steps
}

/**
 * Generate an AI-powered money coach story from financial metrics.
 * Returns null if AI is disabled or the request fails.
 */
export async function getAiCoachStory(
  metrics: MoneyCoachMetrics,
  opts?: { locale?: 'de' | 'en' },
): Promise<AiCoachStory | null> {
  const config = getAiConfig();
  
  if (!config.coachEnabled || !config.apiKey) {
    console.debug('[aiCoachService] AI coach is disabled or API key is missing.');
    return null;
  }

  const locale = opts?.locale || 'de';

  // Build a compact, privacy-aware prompt
  const formatCents = (cents: number) => (cents / 100).toFixed(2);
  const formatDelta = (delta: number) => {
    const abs = Math.abs(delta);
    const sign = delta >= 0 ? '+' : '-';
    return `${sign}${(abs / 100).toFixed(2)}`;
  };

  const metricsJson = {
    period: metrics.period,
    income: `${formatCents(metrics.totalIncomeCents)} EUR`,
    expenses: `${formatCents(metrics.totalExpenseCents)} EUR`,
    net: `${formatCents(metrics.netCents)} EUR`,
    netChange: metrics.prevNetCents !== undefined ? formatDelta(metrics.netCents - metrics.prevNetCents) : null,
    topCategories: metrics.topCategories.map(cat => ({
      category: cat.label,
      amount: `${formatCents(cat.amountCents)} EUR`,
      change: cat.deltaVsPrevCents !== undefined ? formatDelta(cat.deltaVsPrevCents) : null,
    })),
    budgets: metrics.budgetSummary ? {
      total: metrics.budgetSummary.totalBudgets,
      overspent: metrics.budgetSummary.overspentCount,
      underBudget: metrics.budgetSummary.underBudgetCount,
    } : null,
    goals: metrics.goalSummary ? {
      total: metrics.goalSummary.totalGoals,
      onTrack: metrics.goalSummary.onTrackCount,
      behind: metrics.goalSummary.behindCount,
    } : null,
    achievements: metrics.achievementsSummary?.completedCount || 0,
    anomalies: metrics.anomalies?.map(a => ({
      category: a.categoryLabel,
      amount: `${formatCents(a.amountCents)} EUR`,
    })) || [],
  };

  const prompt = locale === 'de' 
    ? `Du bist ein freundlicher, ermutigender Finanzcoach für eine persönliche Finanz-App. 
Analysiere die folgenden Finanzdaten der letzten ${metrics.period.start} bis ${metrics.period.end} und erstelle eine kurze, motivierende Monatsgeschichte.

Daten (JSON):
${JSON.stringify(metricsJson, null, 2)}

Erstelle eine kurze, freundliche Zusammenfassung mit:
1. Einem prägnanten Titel (max. 60 Zeichen)
2. 2-3 konkreten Erkenntnissen (z.B. "Du hast 120 € weniger für Essen ausgegeben als im Vormonat.")
3. 1-2 konkreten Handlungsempfehlungen (z.B. "Setze ein Sparziel für Urlaub", "Überprüfe deine Abos in Sonstiges")

Antworte NUR mit einem JSON-Objekt im folgenden Format (keine zusätzlichen Erklärungen):
{
  "title": "Dein Monat in kurzen Worten",
  "insights": ["Erkenntnis 1", "Erkenntnis 2", "Erkenntnis 3"],
  "actions": ["Handlung 1", "Handlung 2"]
}

Wichtig:
- Sei freundlich und ermutigend, nicht belehrend
- Verwende konkrete Zahlen aus den Daten
- Halte die Erkenntnisse kurz (max. 80 Zeichen pro Punkt)
- Die Handlungen sollten konkret und umsetzbar sein`
    : `You are a friendly, encouraging financial coach for a personal finance app.
Analyze the following financial data from ${metrics.period.start} to ${metrics.period.end} and create a short, motivating monthly story.

Data (JSON):
${JSON.stringify(metricsJson, null, 2)}

Create a short, friendly summary with:
1. A concise title (max. 60 characters)
2. 2-3 concrete insights (e.g., "You spent 120 EUR less on food than last month.")
3. 1-2 concrete action recommendations (e.g., "Set a savings goal for vacation", "Review your subscriptions in Other")

Respond ONLY with a JSON object in the following format (no additional explanations):
{
  "title": "Your month in brief",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "actions": ["Action 1", "Action 2"]
}

Important:
- Be friendly and encouraging, not preachy
- Use concrete numbers from the data
- Keep insights short (max. 80 characters per point)
- Actions should be concrete and actionable`;

  try {
    const apiUrl = config.provider === 'openai' 
      ? 'https://api.openai.com/v1/chat/completions'
      : config.provider;

    const response = await axios.post(
      apiUrl,
      {
        model: config.coachModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent, factual responses
        max_tokens: 300,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000, // 8 seconds timeout
      },
    );

    const rawStory = response.data.choices[0]?.message?.content;
    if (!rawStory) {
      console.warn('[aiCoachService] No story content from AI.');
      return null;
    }

    const parsed = JSON.parse(rawStory) as AiCoachStory;

    // Validate structure
    if (!parsed.title || !Array.isArray(parsed.insights) || !Array.isArray(parsed.actions)) {
      console.warn('[aiCoachService] Invalid story structure from AI.');
      return null;
    }

    // Ensure we have the right number of items
    const insights = parsed.insights.slice(0, 3).filter(Boolean);
    const actions = parsed.actions.slice(0, 2).filter(Boolean);

    if (insights.length < 2 || actions.length < 1) {
      console.warn('[aiCoachService] Story missing required items.');
      return null;
    }

    return {
      title: parsed.title,
      insights,
      actions,
    };
  } catch (error: any) {
    console.error('[aiCoachService] Error fetching AI story:', error?.response?.data || error.message);
    return null;
  }
}

