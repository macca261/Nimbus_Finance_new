export const categoryColors: Record<string, string> = {
  Groceries: '#34d399',
  Dining: '#60a5fa',
  Transport: '#f59e0b',
  Utilities: '#a78bfa',
  Entertainment: '#f472b6',
  Health: '#22d3ee',
  Rent: '#f87171',
  Income: '#10b981',
  Other: '#94a3b8'
}
export const getCategoryColor = (name: string) => categoryColors[name] ?? '#94a3b8'

