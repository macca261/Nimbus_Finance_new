/**
 * Groups transactions by date and formats date labels for display
 */

type DateGroup<T> = {
  dateKey: string; // YYYY-MM-DD
  label: string; // "Heute", "Gestern", or formatted date
  transactions: T[];
  netto: number; // Sum of amounts for this day
};

export function groupTransactionsByDate<T extends { bookingDate: string | null; amount: number }>(
  transactions: T[],
): DateGroup<T>[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, T[]>();

  for (const tx of transactions) {
    if (!tx.bookingDate) continue;
    const date = new Date(tx.bookingDate);
    if (Number.isNaN(date.getTime())) continue;

    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const arr = groups.get(dateKey) ?? [];
    arr.push(tx);
    groups.set(dateKey, arr);
  }

  const result: DateGroup<T>[] = [];

  for (const [dateKey, txs] of groups.entries()) {
    const date = new Date(dateKey);
    date.setHours(0, 0, 0, 0);

    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Heute';
    } else if (date.getTime() === yesterday.getTime()) {
      label = 'Gestern';
    } else {
      // Format as "Mo, 21. Oktober" or similar
      const formatter = new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      label = formatter.format(date);
    }

    const netto = txs.reduce((sum, tx) => sum + tx.amount, 0);

    result.push({
      dateKey,
      label,
      transactions: txs.sort((a, b) => {
        // Sort by amount descending (largest first)
        return b.amount - a.amount;
      }),
      netto,
    });
  }

  // Sort groups by date descending (most recent first)
  result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return result;
}

