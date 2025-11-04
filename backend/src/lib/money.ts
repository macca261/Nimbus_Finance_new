export const sumCents = (nums: number[]): number => nums.reduce((sum, n) => sum + (n | 0), 0);

export const toEuros = (cents: number): number => Number((cents / 100).toFixed(2));


