/**
 * API client for subscription detection endpoints.
 */

export type SubscriptionCandidate = {
  merchantKey: string;
  displayName: string;
  avgAmountCents: number;
  stddevAmountCents: number;
  txCount: number;
  firstDate: string;
  lastDate: string;
  frequency: 'monthly' | 'yearly' | 'unknown';
};

export type SubscriptionCandidatesResponse = {
  candidates: SubscriptionCandidate[];
};

/**
 * Fetch subscription candidates from the API.
 */
export async function fetchSubscriptionCandidates(days = 365): Promise<SubscriptionCandidate[]> {
  try {
    const res = await fetch(`/api/subscriptions/candidates?days=${days}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch subscription candidates: ${res.statusText}`);
    }
    const json = (await res.json()) as SubscriptionCandidatesResponse;
    return json.candidates ?? [];
  } catch (error: any) {
    console.error('[subscriptions] Failed to fetch candidates', error);
    return [];
  }
}

