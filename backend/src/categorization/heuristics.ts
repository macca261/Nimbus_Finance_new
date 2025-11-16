import type { ParsedRow } from '../parser/types';
import type { CategoryId } from './categoryRegistry';
import { normalizeMerchant } from './merchants';

export interface HeuristicMatch {
  category: CategoryId;
  confidence: number;
  reason: string;
}

export interface RecurringDetectionResult {
  category: string; // internal Nimbus category (e.g. 'subscriptions:telecom', 'housing:rent')
  confidence: number; // 0–1
  reason: string; // short debug string
}

/**
 * Detect recurring transaction patterns (subscriptions, insurance, rent, etc.)
 * 
 * Looks for transactions that:
 * - Have the same normalized merchant name in at least 3 months in the last 6 months
 * - Amount is stable within ±5% tolerance
 * - Interval is ~monthly (26–35 days)
 * 
 * @param row - Current transaction row
 * @param history - Array of previous transactions (should be sorted by date, newest first)
 * @returns RecurringDetectionResult if pattern detected, null otherwise
 */
export function detectRecurringPattern(
  row: ParsedRow,
  history: ParsedRow[] | undefined,
): RecurringDetectionResult | null {
  if (!history || history.length < 2) {
    return null; // Need at least 2 previous occurrences (3 total)
  }

  const merchantInfo = normalizeMerchant(row.rawText ?? undefined, row.counterparty);
  const currentMerchant = merchantInfo.merchant?.toUpperCase().trim() || '';
  const currentAmount = Math.abs(row.amountCents);

  if (!currentMerchant || currentAmount === 0) {
    return null;
  }

  // Find matching transactions in history (same merchant, similar amount)
  const matches: ParsedRow[] = [];
  const amountTolerance = 0.05; // ±5%

  for (const prevRow of history) {
    const prevMerchantInfo = normalizeMerchant(prevRow.rawText ?? undefined, prevRow.counterparty);
    const prevMerchant = prevMerchantInfo.merchant?.toUpperCase().trim() || '';
    const prevAmount = Math.abs(prevRow.amountCents);

    // Check if merchant matches (normalized)
    if (prevMerchant && prevMerchant === currentMerchant) {
      // Check if amount is within tolerance
      const amountDiff = Math.abs(prevAmount - currentAmount) / Math.max(currentAmount, prevAmount);
      if (amountDiff <= amountTolerance) {
        matches.push(prevRow);
      }
    }
  }

  // Need at least 2 previous matches (3 total including current)
  if (matches.length < 2) {
    return null;
  }

  // Sort matches by date (oldest first) to check intervals
  const allMatches = [...matches, row].sort((a, b) => {
    const dateA = new Date(a.bookingDate).getTime();
    const dateB = new Date(b.bookingDate).getTime();
    return dateA - dateB;
  });

  // Check if intervals are consistent (~monthly: 26–35 days)
  const intervals: number[] = [];
  for (let i = 1; i < allMatches.length; i++) {
    const dateA = new Date(allMatches[i - 1].bookingDate).getTime();
    const dateB = new Date(allMatches[i].bookingDate).getTime();
    const daysDiff = Math.round((dateB - dateA) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }

  // Check if intervals are roughly monthly (26–35 days)
  const isMonthly = intervals.every(days => days >= 26 && days <= 35);
  if (!isMonthly) {
    return null; // Not monthly recurring
  }

  // Determine category based on merchant name or description
  const text = (row.rawText ?? '').toUpperCase();
  const merchant = currentMerchant;

  // Telecom
  if (
    merchant.includes('DRILLISCH') ||
    merchant.includes('TELEKOM') ||
    merchant.includes('VODAFONE') ||
    merchant.includes('O2') ||
    merchant.includes('1&1') ||
    merchant.includes('SIMYO') ||
    merchant.includes('FONIC') ||
    text.includes('TELEKOM') ||
    text.includes('VODAFONE') ||
    text.includes('O2')
  ) {
    return {
      category: 'subscriptions:telecom',
      confidence: 0.9,
      reason: 'recurring:telecom',
    };
  }

  // Insurance
  if (
    merchant.includes('VERSICHERUNG') ||
    merchant.includes('KRANKENKASSE') ||
    merchant.includes('AOK') ||
    merchant.includes('TK') ||
    merchant.includes('DAK') ||
    merchant.includes('BARMER') ||
    merchant.includes('HAFTPFLICHT') ||
    text.includes('VERSICHERUNG') ||
    text.includes('KRANKENKASSE') ||
    text.includes('HAFTPFLICHT')
  ) {
    return {
      category: 'insurance',
      confidence: 0.9,
      reason: 'recurring:insurance',
    };
  }

  // Gym / Fitness
  if (
    merchant.includes('FITNESS') ||
    merchant.includes('MCFIT') ||
    merchant.includes('FITX') ||
    merchant.includes('CLEVER FIT') ||
    merchant.includes('CLEVERFIT') ||
    merchant.includes('FITSTAR') ||
    text.includes('FITNESS') ||
    text.includes('MCFIT') ||
    text.includes('FITX')
  ) {
    return {
      category: 'leisure:fitness',
      confidence: 0.85,
      reason: 'recurring:fitness',
    };
  }

  // Rent (if amount is large and recurring)
  if (
    currentAmount >= 30000 && // At least €300/month
    (merchant.includes('MIETE') ||
      merchant.includes('VERWALTUNG') ||
      merchant.includes('HAUSVERWALTUNG') ||
      text.includes('MIETE') ||
      text.includes('KALTMIETE') ||
      text.includes('WARMMIETE'))
  ) {
    return {
      category: 'housing:rent',
      confidence: 0.9,
      reason: 'recurring:rent',
    };
  }

  // Utilities
  if (
    merchant.includes('STADTWERKE') ||
    merchant.includes('STROM') ||
    merchant.includes('GAS') ||
    merchant.includes('WASSER') ||
    merchant.includes('FERNWAERME') ||
    text.includes('STADTWERKE') ||
    text.includes('STROM') ||
    text.includes('GAS') ||
    text.includes('WASSER')
  ) {
    return {
      category: 'housing:utilities',
      confidence: 0.9,
      reason: 'recurring:utilities',
    };
  }

  // Uber subscription detection (before generic subscription)
  // Check for small fixed recurring Uber charges (Uber One, Uber Pass subscriptions)
  if (merchant === 'UBER' || text.includes('UBER')) {
    // Must be small fixed amount (subscriptions are typically €3-€5, not large ride charges)
    const amountEur = currentAmount / 100;
    if (amountEur > 0 && amountEur <= 50) {
      // Check for subscription keywords OR require at least 3 occurrences for pattern-based detection
      const hasSubKeyword = text.includes('PASS') ||
                            text.includes('ONE') ||
                            text.includes('MEMBERSHIP') ||
                            text.includes('ABO');
      
      // If we have subscription keywords OR enough recurring pattern matches, treat as subscription
      if (hasSubKeyword || matches.length >= 2) {
        return {
          category: 'transport:rideshare', // Keep in transport bucket for now
          confidence: hasSubKeyword && matches.length >= 2 ? 0.95 : 0.9,
          reason: 'heuristic:recurring', // Use generic recurring reason to match other recurring patterns
        };
      }
    }
  }

  // Generic recurring subscription (if we can't determine specific type)
  if (matches.length >= 3) {
    return {
      category: 'subscriptions',
      confidence: 0.8,
      reason: 'recurring:generic',
    };
  }

  return null;
}

/**
 * Detect salary / income from transaction text
 * 
 * Looks for German salary markers and employer-style patterns.
 * Only fires when rules didn't already categorize as income.
 * 
 * @param row - Transaction row
 * @param cleanedText - Normalized, cleaned text for matching
 * @returns HeuristicMatch if salary detected, null otherwise
 */
export function detectSalary(row: ParsedRow, cleanedText: string): HeuristicMatch | null {
  // Only check incoming transactions
  if (row.direction !== 'in') {
    return null;
  }

  const text = cleanedText.toUpperCase();
  const rawText = (row.rawText ?? '').toUpperCase();
  const counterparty = (row.counterparty ?? '').toUpperCase();
  const combinedText = `${text} ${rawText} ${counterparty}`.toUpperCase();

  // German salary markers
  const salaryKeywords = [
    'GEHALT',
    'LOHN',
    'VERGÜTUNG',
    'VERGUETUNG',
    'ARBEITSENTGELT',
    'ENTGELT',
    'GEHALTSZAHLUNG',
    'LOHNABRECHNUNG',
    'LOHNZAHLUNG',
    'SALARY',
    'PAYROLL',
    'WAGE',
  ];

  const hasSalaryKeyword = salaryKeywords.some(keyword => combinedText.includes(keyword));

  if (!hasSalaryKeyword) {
    return null;
  }

  // Exclude obvious non-salary cases
  const excludeKeywords = [
    'MIETE',
    'KALTMIETE',
    'WARMMIETE',
    'NEBENKOSTEN',
    'STROM',
    'GAS',
    'WASSER',
    'VERSICHERUNG',
    'KRANKENKASSE',
    'HAFTPFLICHT',
  ];

  const hasExcludeKeyword = excludeKeywords.some(keyword => combinedText.includes(keyword));
  if (hasExcludeKeyword) {
    return null; // Likely not salary (e.g., "Miete" + "Gehalt" = rent payment, not salary)
  }

  // Check for employer-style patterns (company + salary keyword)
  const hasCompanySuffix = /(GMBH|AG|KG|UG|LTD|INC|CORP)/.test(combinedText);
  const hasEmployerPhrase = /(FIRMA|ARBEITGEBER|EMPLOYER)/.test(combinedText);

  // Strong match: multiple salary terms or company + salary
  const salaryKeywordCount = salaryKeywords.filter(kw => combinedText.includes(kw)).length;
  const isStrongMatch = salaryKeywordCount >= 2 || (hasCompanySuffix && hasSalaryKeyword) || hasEmployerPhrase;

  return {
    category: 'income:salary',
    confidence: isStrongMatch ? 0.95 : 0.85,
    reason: 'heuristic:salary',
  };
}

/**
 * Detect rent or housing-related transactions
 * 
 * @param row - Transaction row
 * @param cleanedText - Normalized, cleaned text for matching
 * @returns HeuristicMatch if rent/housing detected, null otherwise
 */
export function detectRentOrHousing(row: ParsedRow, cleanedText: string): HeuristicMatch | null {
  // Only check outgoing transactions
  if (row.direction !== 'out') {
    return null;
  }

  const text = cleanedText.toUpperCase();
  const rawText = (row.rawText ?? '').toUpperCase();
  const counterparty = (row.counterparty ?? '').toUpperCase();
  const combinedText = `${text} ${rawText} ${counterparty}`.toUpperCase();

  // Rent keywords
  const rentKeywords = [
    'MIETE',
    'KALTMIETE',
    'WARMMIETE',
    'MIETZAHLUNG',
    'MIETKONTO',
    'RENT',
    'MIETVERTRAG',
  ];

  const hasRentKeyword = rentKeywords.some(keyword => combinedText.includes(keyword));

  if (hasRentKeyword) {
    // Check for landlord-like patterns
    const hasLandlordPattern = /(GMBH|AG|KG|VERWALTUNG|HAUSVERWALTUNG|IMMOBILIEN)/.test(combinedText);
    
    return {
      category: 'housing:rent',
      confidence: hasLandlordPattern ? 0.95 : 0.9,
      reason: 'heuristic:rent',
    };
  }

  // Utilities keywords
  const utilityKeywords = [
    'NEBENKOSTEN',
    'BETRIEBSKOSTENABRECHNUNG',
    'HAUSVERWALTUNG',
    'STADTWERKE',
    'STROM',
    'GAS',
    'WASSER',
    'FERNWAERME',
    'HEIZUNG',
    'NEBENKOSTENABRECHNUNG',
  ];

  const hasUtilityKeyword = utilityKeywords.some(keyword => combinedText.includes(keyword));

  if (hasUtilityKeyword) {
    return {
      category: 'housing:utilities',
      confidence: 0.9,
      reason: 'heuristic:housing',
    };
  }

  return null;
}

/**
 * Stage 4: Heuristics - direction, keywords, periodicity-based categorization
 * These are fallback rules when no explicit rules match.
 */
export function applyHeuristics(row: ParsedRow, cleanedText: string): HeuristicMatch | null {
  const text = cleanedText.toUpperCase();
  const direction = row.direction;

  // Income heuristics (direction === 'in')
  if (direction === 'in') {
    // Try salary detection first (stronger heuristic)
    const salaryMatch = detectSalary(row, cleanedText);
    if (salaryMatch) {
      return salaryMatch;
    }

    // Refunds / reimbursements
    if (
      text.includes('ERSTATTUNG') ||
      text.includes('RÜCKERSTATTUNG') ||
      text.includes('RUCKERSTATTUNG') ||
      text.includes('REFUND') ||
      text.includes('REIMBURSEMENT')
    ) {
      return {
        category: 'income:refunds',
        confidence: 0.75,
        reason: 'heuristic:refund_keywords',
      };
    }

    // Transfers / reimbursements coming in (generic income_other fallback)
    if (
      text.includes('ÜBERTRAG') ||
      text.includes('UEBERTRAG') ||
      text.includes('ÜBERWEISUNG') ||
      text.includes('UEBERWEISUNG') ||
      text.includes('INSTANT TRANSFER')
    ) {
      // If internal transfer flags are set elsewhere, engine will handle it
      return {
        category: 'income:freelance', // use generic income category as "other"
        confidence: 0.7,
        reason: 'heuristic:incoming_transfer',
      };
    }
  }

  // Expense heuristics (direction === 'out')
  if (direction === 'out') {
    // Try rent/housing detection first (stronger heuristic)
    const rentMatch = detectRentOrHousing(row, cleanedText);
    if (rentMatch) {
      return rentMatch;
    }

    // Bank fees
    if (
      text.includes('KONTOFÜHRUNG') ||
      text.includes('KONTOFUEHRUNG') ||
      text.includes('KONTOPREIS') ||
      text.includes('ENTGELT') ||
      text.includes('GEBÜHR') ||
      text.includes('GEBUEHR') ||
      text.includes('KARTENENTGELT') ||
      text.includes('KARTENGEBÜHR') ||
      text.includes('KARTENGEBUEHR') ||
      text.includes('SEPA GEBÜHR') ||
      text.includes('SEPA GEBUEHR')
    ) {
      return {
        category: 'fees:bank',
        confidence: 0.8,
        reason: 'heuristic:bank_fee_keywords',
      };
    }

    // Health / pharmacy
    if (
      text.includes('APOTHEKE') ||
      text.includes('PHARMACY') ||
      text.includes('ARZT') ||
      text.includes('DOCTOR') ||
      text.includes('KRANKENHAUS') ||
      text.includes('HOSPITAL')
    ) {
      return {
        category: 'health:pharmacy',
        confidence: 0.75,
        reason: 'heuristic:health_keywords',
      };
    }

    // Bakeries (low priority, only when no rule matched)
    if (
      text.includes('BAECKEREI') ||
      text.includes('BÄCKEREI') ||
      text.includes('BACKEREI') ||
      text.includes('BAKERY')
    ) {
      return {
        category: 'dining:bakery',
        confidence: 0.7,
        reason: 'heuristic:bakery_keywords',
      };
    }

    // Travel / holiday (low priority)
    if (
      text.includes('HOTEL') ||
      text.includes('BOOKING.COM') ||
      text.includes('CAMPING') ||
      text.includes('FERIENHAUS') ||
      text.includes('HOLIDAY') ||
      text.includes('URLAUB')
    ) {
      return {
        category: 'travel:holiday',
        confidence: 0.7,
        reason: 'heuristic:travel_keywords',
      };
    }

    // Insurance
    if (
      text.includes('VERSICHERUNG') ||
      text.includes('INSURANCE') ||
      text.includes('KRANKENVERSICHERUNG') ||
      text.includes('HAFTPFLICHT')
    ) {
      return {
        category: 'insurance',
        confidence: 0.75,
        reason: 'heuristic:insurance_keywords',
      };
    }
  }

  return null;
}
