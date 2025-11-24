import { evaluateAchievements } from '../../api/achievementsApi';

let evaluationTimeout: ReturnType<typeof setTimeout> | null = null;
let lastEvaluationTime = 0;
const DEBOUNCE_MS = 2000; // Wait 2 seconds before evaluating
const MIN_INTERVAL_MS = 5000; // Don't evaluate more than once per 5 seconds

/**
 * Quietly evaluate achievements in the background.
 * Debounces rapid calls and doesn't block the UI.
 * Errors are logged but not shown to the user.
 */
export async function evaluateQuietly(): Promise<void> {
  // Clear any pending evaluation
  if (evaluationTimeout) {
    clearTimeout(evaluationTimeout);
    evaluationTimeout = null;
  }

  // Check if we've evaluated recently
  const now = Date.now();
  const timeSinceLastEvaluation = now - lastEvaluationTime;
  
  if (timeSinceLastEvaluation < MIN_INTERVAL_MS) {
    // Schedule evaluation after debounce period
    evaluationTimeout = setTimeout(() => {
      evaluationTimeout = null;
      performEvaluation();
    }, DEBOUNCE_MS);
    return;
  }

  // Perform evaluation immediately
  performEvaluation();
}

async function performEvaluation(): Promise<void> {
  lastEvaluationTime = Date.now();
  
  try {
    await evaluateAchievements();
  } catch (error) {
    // Silently log errors - don't interrupt user flow
    console.debug('[achievements] Evaluation failed:', error);
  }
}

