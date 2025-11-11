import { describe, it, expect } from 'vitest';
import { categorize } from '../categorization';

describe('categorize', () => {
  it('detects salary', () => {
    const res = categorize({
      text: 'Gehalt ACME GmbH Oktober',
      amount: 2500,
    });
    expect(res.category).toBe('income_salary');
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it('detects groceries', () => {
    const res = categorize({
      text: 'Kartenzahlung REWE FILIALE 1234',
      amount: -45.9,
      counterpart: 'REWE FILIALE 1234',
    });
    expect(res.category).toBe('groceries');
  });

  it('detects subscriptions', () => {
    const res = categorize({
      text: 'NETFLIX.COM 12345',
      amount: -15.99,
    });
    expect(res.category).toBe('subscriptions');
  });

  it('detects telecom providers', () => {
    const res = categorize({
      text: 'Deutsche Telekom GmbH Rechnung',
      amount: -49.99,
    });
    expect(res.category).toBe('telecom_internet');
  });

  it('detects bank fees', () => {
    const res = categorize({
      text: 'Kontoführungsgebühr Sparkasse März',
      amount: -8.5,
    });
    expect(res.category).toBe('fees_charges');
  });

  it('detects cash withdrawals', () => {
    const res = categorize({
      text: 'Bargeldauszahlung ATM 1234',
      amount: -100,
    });
    expect(res.category).toBe('cash_withdrawal');
  });

  it('detects internal transfers', () => {
    const res = categorize({
      text: 'SEPA-Überweisung Eigene Kontonummer 12345678',
      amount: -300,
    });
    expect(res.category).toBe('transfer_internal');
  });

  it('falls back to review', () => {
    const res = categorize({
      text: 'Unbekannter Vorgang XYZ',
      amount: -3.21,
    });
    expect(res.category).toBe('other');
    expect(res.source).toBe('fallback');
  });

  it('classifies complex internal transfer text correctly', () => {
    const res = categorize({
      text: 'Empfänger: Aaron McIntosh Kto/IBAN: DE32200411770270381700 Übertrag / Überweisung Depot',
      amount: -2700,
    });
    expect(res.category).toBe('transfer_internal');
  });

  it('distinguishes Uber Eats as delivery', () => {
    const res = categorize({
      text: 'UBER *EATS HELP.UBER.COM NL Karte',
      amount: -23.5,
    });
    expect(res.category).toBe('dining_out');
  });

  it('classifies Uber ride as transport', () => {
    const res = categorize({
      text: 'UBER TRIP HELP.UBER.COM',
      amount: -12.8,
    });
    expect(res.category).toBe('transport');
  });

  it('classifies Drillisch payments as telecom_internet', () => {
    const res = categorize({
      text: 'Drillisch Online GmbH Kundenkonto 123456',
      amount: -19.99,
    });
    expect(res.category).toBe('telecom_internet');
  });

  it('classifies OpenAI subscription as subscriptions', () => {
    const res = categorize({
      text: 'OPENAI*ChatGPT Subscription',
      amount: -20,
    });
    expect(res.category).toBe('subscriptions');
  });

  it('classifies Bäckerei Heinemann spend as dining_out', () => {
    const res = categorize({
      text: 'Baeckerei Heinemann Buchungstext: Baeckerei Heinemann',
      amount: -4.2,
    });
    expect(res.category).toBe('dining_out');
  });
});
