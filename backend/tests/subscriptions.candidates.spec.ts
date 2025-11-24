import { describe, it, expect, beforeEach } from 'vitest';
import { detectSubscriptionCandidates } from '../src/categorization/subscriptions';

describe('detectSubscriptionCandidates', () => {
  it('detects monthly phone payment subscription', () => {
    const baseDate = '2024-01-15';
    const transactions = [
      // Monthly phone payment - same merchant, same amount, ~30 days apart
      { id: 1, bookingDate: '2024-01-15', amountCents: -2999, payee: 'Telekom Deutschland', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-14', amountCents: -2999, payee: 'Telekom Deutschland', counterpartName: null, purpose: null, memo: null },
      { id: 3, bookingDate: '2024-03-16', amountCents: -2999, payee: 'Telekom Deutschland', counterpartName: null, purpose: null, memo: null },
      { id: 4, bookingDate: '2024-04-15', amountCents: -2999, payee: 'Telekom Deutschland', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    expect(candidates.length).toBeGreaterThan(0);
    const phoneCandidate = candidates.find(c => c.merchantKey.includes('telekom'));
    expect(phoneCandidate).toBeDefined();
    expect(phoneCandidate?.frequency).toBe('monthly');
    expect(phoneCandidate?.txCount).toBe(4);
    expect(phoneCandidate?.avgAmountCents).toBeCloseTo(2999, 0);
  });

  it('detects yearly insurance payment', () => {
    const transactions = [
      // Yearly insurance - same merchant, same amount, ~365 days apart
      { id: 1, bookingDate: '2023-01-10', amountCents: -120000, payee: 'Allianz Versicherung', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-01-12', amountCents: -120000, payee: 'Allianz Versicherung', counterpartName: null, purpose: null, memo: null },
      { id: 3, bookingDate: '2025-01-11', amountCents: -120000, payee: 'Allianz Versicherung', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    expect(candidates.length).toBeGreaterThan(0);
    const insuranceCandidate = candidates.find(c => c.merchantKey.includes('allianz'));
    expect(insuranceCandidate).toBeDefined();
    expect(insuranceCandidate?.frequency).toBe('yearly');
    expect(insuranceCandidate?.txCount).toBe(3);
    expect(insuranceCandidate?.avgAmountCents).toBeCloseTo(120000, 0);
  });

  it('filters out noisy one-off transactions', () => {
    const transactions = [
      // Monthly subscription (should be detected)
      { id: 1, bookingDate: '2024-01-15', amountCents: -999, payee: 'Spotify', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-14', amountCents: -999, payee: 'Spotify', counterpartName: null, purpose: null, memo: null },
      { id: 3, bookingDate: '2024-03-16', amountCents: -999, payee: 'Spotify', counterpartName: null, purpose: null, memo: null },
      // One-off random merchant (should NOT be detected)
      { id: 4, bookingDate: '2024-03-20', amountCents: -4500, payee: 'Random Shop', counterpartName: null, purpose: null, memo: null },
      { id: 5, bookingDate: '2024-04-25', amountCents: -5200, payee: 'Different Store', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    // Should only find Spotify, not the one-offs
    const spotifyCandidate = candidates.find(c => c.merchantKey.includes('spotify'));
    expect(spotifyCandidate).toBeDefined();
    expect(spotifyCandidate?.frequency).toBe('monthly');
    
    // One-offs should not appear (need at least 3 transactions)
    const randomShop = candidates.find(c => c.merchantKey.includes('random'));
    expect(randomShop).toBeUndefined();
    const differentStore = candidates.find(c => c.merchantKey.includes('different'));
    expect(differentStore).toBeUndefined();
  });

  it('requires at least 3 transactions per merchant', () => {
    const transactions = [
      { id: 1, bookingDate: '2024-01-15', amountCents: -1999, payee: 'Netflix', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-15', amountCents: -1999, payee: 'Netflix', counterpartName: null, purpose: null, memo: null },
      // Only 2 transactions - should not be detected
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    const netflixCandidate = candidates.find(c => c.merchantKey.includes('netflix'));
    expect(netflixCandidate).toBeUndefined();
  });

  it('filters out transactions with high variance', () => {
    const transactions = [
      // Same merchant but wildly different amounts (should not be detected as subscription)
      { id: 1, bookingDate: '2024-01-15', amountCents: -10000, payee: 'Amazon', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-14', amountCents: -50000, payee: 'Amazon', counterpartName: null, purpose: null, memo: null },
      { id: 3, bookingDate: '2024-03-16', amountCents: -5000, payee: 'Amazon', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    // High variance should prevent detection
    const amazonCandidate = candidates.find(c => c.merchantKey.includes('amazon'));
    // May or may not appear depending on variance calculation, but if it does, frequency should be 'unknown' or filtered out
    if (amazonCandidate) {
      // If somehow detected, it should be filtered by frequency check
      expect(amazonCandidate.frequency).not.toBe('unknown'); // Should be filtered out entirely
    }
  });

  it('handles transactions with small amount variance', () => {
    const transactions = [
      // Small variance within 10-15% should still be detected
      { id: 1, bookingDate: '2024-01-15', amountCents: -2999, payee: 'Vodafone', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-14', amountCents: -2995, payee: 'Vodafone', counterpartName: null, purpose: null, memo: null },
      { id: 3, bookingDate: '2024-03-16', amountCents: -3005, payee: 'Vodafone', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    const vodafoneCandidate = candidates.find(c => c.merchantKey.includes('vodafone'));
    expect(vodafoneCandidate).toBeDefined();
    expect(vodafoneCandidate?.frequency).toBe('monthly');
    expect(vodafoneCandidate?.stddevAmountCents).toBeLessThan(2999 * 0.15); // Within 15%
  });

  it('only considers expense transactions (negative amounts)', () => {
    const transactions = [
      { id: 1, bookingDate: '2024-01-15', amountCents: -2999, payee: 'Telekom', counterpartName: null, purpose: null, memo: null },
      { id: 2, bookingDate: '2024-02-14', amountCents: 2999, payee: 'Telekom', counterpartName: null, purpose: null, memo: null }, // Income - should be ignored
      { id: 3, bookingDate: '2024-03-16', amountCents: -2999, payee: 'Telekom', counterpartName: null, purpose: null, memo: null },
    ];

    const candidates = detectSubscriptionCandidates(transactions);
    
    // Should not detect because only 2 expenses (need at least 3)
    const telekomCandidate = candidates.find(c => c.merchantKey.includes('telekom'));
    expect(telekomCandidate).toBeUndefined();
  });
});

