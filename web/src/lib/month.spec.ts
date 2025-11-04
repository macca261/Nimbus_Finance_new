import { describe, it, expect } from 'vitest'
import { buildRecentMonths, formatMonthLabel, formatMonthShort, shiftMonth } from './month'

describe('month helpers', () => {
  it('formats month labels with locale defaults', () => {
    expect(formatMonthLabel('2025-03')).toContain('2025')
    expect(formatMonthLabel(null)).toBe('Aktuell')
  })

  it('builds recent months relative to a reference date', () => {
    const reference = new Date(Date.UTC(2025, 2, 15))
    const options = buildRecentMonths(3, reference)
    expect(options[0].value).toBe('2025-03')
    expect(options[1].value).toBe('2025-02')
    expect(options[2].value).toBe('2025-01')
  })

  it('shifts months and renders short labels', () => {
    expect(shiftMonth('2025-03', -2)).toBe('2025-01')
    expect(formatMonthShort('2025-04')).toMatch(/Apr/)
  })
})

