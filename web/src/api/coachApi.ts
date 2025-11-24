export interface CoachStory {
  title: string;
  insights: string[];
  actions: string[];
}

export interface CoachStoryResponse {
  story: CoachStory | null;
  fallbackMetrics?: {
    period: { start: string; end: string };
    netCents: number;
    topCategory: string | null;
    topCategoryAmountCents: number;
  };
  disabled?: boolean;
  message?: string;
  isEmpty?: boolean;
}

/**
 * Fetch an AI-generated coach story for the specified period.
 * Returns null story if AI is disabled, rate-limited, or fails.
 */
export async function fetchCoachStory(days: number = 30): Promise<CoachStoryResponse> {
  try {
    const res = await fetch(`/api/coach/story?days=${days}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 503) {
      // AI disabled
      const data = await res.json();
      return { story: null, disabled: true, message: data.message };
    }

    if (!res.ok) {
      console.error('[coachApi] Failed to fetch story:', res.status, res.statusText);
      return { story: null };
    }

    const data = (await res.json()) as CoachStoryResponse;
    return data;
  } catch (error) {
    console.error('[coachApi] Error fetching coach story:', error);
    return { story: null };
  }
}

