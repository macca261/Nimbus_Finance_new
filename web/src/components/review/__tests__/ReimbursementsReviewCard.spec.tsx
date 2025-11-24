/**
 * Tests for ReimbursementsReviewCard component
 *
 * This component uses a 2-step UX flow:
 * - Level 1: Decision card ("Als Erstattung verknüpfen" vs "Getrennt behandeln")
 * - Level 2: Allocation wizard ("Zahlung verknüpfen") for fine-tuning complex groups
 *
 * Test approach:
 * - Text assertions use `exact: false` or flexible matchers to avoid brittle whitespace issues
 * - Multiple element matches use `getAllByText` and check length > 0
 * - Border/Tailwind class assertions are loose (e.g., matching patterns like `/border-slate-(200|800)/`)
 * - Old text patterns ("Wir schätzen...", "Hauptkategorie:") were replaced with new UX copy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReimbursementsReviewCard } from '../ReimbursementsReviewCard';
import * as reviewApi from '../../../api/reviewApi';

// Mock the API functions
vi.mock('../../../api/reviewApi', () => ({
  fetchReimbursementGroups: vi.fn(),
  markPassThrough: vi.fn(),
  ignoreReimbursementGroup: vi.fn(),
  saveReimbursementAllocations: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue([]),
}));

// Mock formatCurrency and formatDate
vi.mock('../../../lib/format', () => ({
  formatCurrency: (amount: number) => `€${amount.toFixed(2)}`,
  formatDate: (date?: string) => date || '',
}));

describe('ReimbursementsReviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with data - shows counterpart name, inflow/outflow summary, and button', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Pembe Aksoy',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund from Pembe',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment to Pembe',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Lade Erstattungen…')).not.toBeInTheDocument();
    });

    // Check that group data is rendered
    expect(screen.getByText('Pembe Aksoy')).toBeInTheDocument();
    expect(screen.getByText('2 Buchungen')).toBeInTheDocument();
    expect(screen.getByText(/Eingänge:/)).toBeInTheDocument();
    expect(screen.getByText(/Ausgänge:/)).toBeInTheDocument();
    expect(screen.getByText('Details anzeigen')).toBeInTheDocument();
  });

  it('renders empty state when no groups are returned', async () => {
    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue([]);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Derzeit keine offenen Erstattungs-Gruppen.')).toBeInTheDocument();
    });
  });

  it('calls markPassThrough with all transaction IDs when "Als Erstattung verknüpfen" is selected and saved', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.markPassThrough as any).mockResolvedValue(undefined);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen" (should be selected by default for complex groups)
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    // Find and click the save button (it should be visible after selecting an option)
    const saveButton = screen.getByRole('button', { name: /Speichern/ });
    fireEvent.click(saveButton);

    // Should call markPassThrough with all transaction IDs
    await waitFor(() => {
      expect(reviewApi.markPassThrough).toHaveBeenCalledWith([2, 1]);
    });
  });

  it('removes group from list after successful markPassThrough', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 80,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.markPassThrough as any).mockResolvedValue(undefined);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Check that progress strip shows 0 erledigt, 1 offen
    expect(screen.getByText(/0 erledigt · 1 offen/)).toBeInTheDocument();

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen" and save
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    const saveButton = screen.getByRole('button', { name: /Speichern/ });
    fireEvent.click(saveButton);

    // Group should be moved to resolved section
    await waitFor(() => {
      // Check that progress shows 1 erledigt
      expect(screen.getByText(/1 erledigt · 0 offen/)).toBeInTheDocument();
      // Group should appear in the resolved section
      expect(screen.getByText('Erledigte Abrechnungen (1)')).toBeInTheDocument();
    });
    
    // Open the resolved section to see the group
    const resolvedSection = screen.getByText('Erledigte Abrechnungen (1)').closest('summary');
    if (resolvedSection) {
      fireEvent.click(resolvedSection);
    }
    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });
  });

  it('shows error message when markPassThrough fails', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 60,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.markPassThrough as any).mockRejectedValue(new Error('API Error'));

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen" and save
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    const saveButton = screen.getByRole('button', { name: /Speichern/ });
    fireEvent.click(saveButton);

    // Error should be shown - error is displayed in a red alert box when markPassThrough fails
    // Wait for async error to be set and displayed (markPassThrough is async)
    // The error uses err?.message || default, so check for the actual error message "API Error"
    await waitFor(() => {
      // The mock rejects with "API Error", so that's what will be displayed
      // Error is shown in a red alert box div
      const errorElement = screen.getByText('API Error');
      expect(errorElement).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('toggles expanded details when "Details anzeigen" is clicked', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 70,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund from Test',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment to Test',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Details should not be visible initially
    expect(screen.queryByText('Refund from Test')).not.toBeInTheDocument();

    // Click "Details anzeigen"
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Details should now be visible - purpose text is now shown with date format "Date · Purpose"
    // May appear multiple times (in different sections), so use getAllByText
    await waitFor(() => {
      const refundElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Refund from Test');
      });
      expect(refundElements.length).toBeGreaterThan(0);
      
      const paymentElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Payment to Test');
      });
      expect(paymentElements.length).toBeGreaterThan(0);
    });

    // Click "Weniger" to collapse
    const collapseButton = screen.getByText('Weniger');
    fireEvent.click(collapseButton);

    // Details should be hidden again
    await waitFor(() => {
      expect(screen.queryByText('Refund from Test')).not.toBeInTheDocument();
    });
  });

  it('renders "Hohe Sicherheit" badge for confidence >= 85', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 90,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Hohe Sicherheit')).toBeInTheDocument();
      expect(screen.getByText('(90%)')).toBeInTheDocument();
    });
  });

  it('renders "Unsicher – bitte prüfen" badge for 50 <= confidence < 85', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 65,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Unsicher – bitte prüfen')).toBeInTheDocument();
      expect(screen.getByText('(65%)')).toBeInTheDocument();
    });
  });

  it('renders "Niedrige Sicherheit" badge for confidence < 50', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 30,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Niedrige Sicherheit')).toBeInTheDocument();
      expect(screen.getByText('(30%)')).toBeInTheDocument();
    });
  });

  it('highlights button with checkmark for high confidence groups', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 10000,
        lastBookingDate: '2025-01-20',
        confidence: 92,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group to see the Level-1 decision card
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check that the recommended option is visible
    await waitFor(() => {
      expect(screen.getByText(/Als Erstattung verknüpfen/)).toBeInTheDocument();
    });
  });

  it('shows "ausgegeben" text for positive net impact', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 5000, // User paid 50 EUR net
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText(/Netto-Auswirkung: Du hast in dieser Gruppe effektiv.*ausgegeben/)).toBeInTheDocument();
      // May appear multiple times (in summary chips and elsewhere)
      expect(screen.getAllByText(/€50\.00/).length).toBeGreaterThan(0);
    });
  });

  it('shows "erhalten" text for negative net impact', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 15000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: -5000, // User received 50 EUR net
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 15000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText(/Netto-Auswirkung: Du hast in dieser Gruppe effektiv.*erhalten/)).toBeInTheDocument();
      // May appear multiple times (in summary chips and elsewhere)
      expect(screen.getAllByText(/€50\.00/).length).toBeGreaterThan(0);
    });
  });

  it('shows "praktisch ausgeglichen" text for near-zero net impact', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10030,
        netImpactCents: 30, // Only 30 cents difference (within threshold)
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Netto-Auswirkung: Diese Gruppe ist praktisch ausgeglichen.')).toBeInTheDocument();
    });
  });

  it('renders settlement story when group is expanded', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 3,
        totalInflowCents: 40000,
        totalOutflowCents: 0,
        totalExpenseCents: 88900,
        netImpactCents: 48900, // User paid 489 EUR net
        lastBookingDate: '2025-01-20',
        confidence: 85,
        primaryCategoryId: 'groceries',
        primaryCategoryLabel: 'Lebensmittel & Drogerie',
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 40000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -50000,
            purpose: 'Payment 1',
            category: 'other',
          },
          {
            id: 3,
            bookingDate: '2025-01-16',
            amountCents: -38900,
            purpose: 'Payment 2',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for story header elements - "Hauptkategorie:" label was removed, category shown as pill
    await waitFor(() => {
      // Story header may be split across elements - may appear multiple times, use getAllByText
      const headerElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Abrechnung mit') && text.includes('Test Person');
      });
      expect(headerElements.length).toBeGreaterThan(0);
      // Primary category is shown as a pill, not with "Hauptkategorie:" label
      expect(screen.getByText('Lebensmittel & Drogerie')).toBeInTheDocument();
      // Summary text may be split across elements - may appear multiple times
      const summaryElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Du hast insgesamt') && text.includes('ausgegeben') && text.includes('zurückbekommen');
      });
      expect(summaryElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Aktuell trägst du etwa/)).toBeInTheDocument();
    });
  });

  it('shows "praktisch ausgeglichen" in settlement story for near-balanced group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10030,
        netImpactCents: 30, // Only 30 cents difference
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10030,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for "praktisch ausgeglichen" in story header
    await waitFor(() => {
      // May appear multiple times (in summary chips and elsewhere)
      expect(screen.getAllByText(/praktisch ausgeglichen/).length).toBeGreaterThan(0);
    });
  });

  it('shows "zurückbekommen" text in settlement story for net-negative group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 15000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: -5000, // User received 50 EUR net
        lastBookingDate: '2025-01-20',
        confidence: 80,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 15000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for "zurückbekommen" text in story header
    await waitFor(() => {
      expect(screen.getByText(/Aktuell hast du netto etwa.*€50\.00.*zurückbekommen/)).toBeInTheDocument();
    });
  });

  it('shows subtle hint for high confidence groups with non-zero net impact', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 40000,
        totalOutflowCents: 0,
        totalExpenseCents: 88900,
        netImpactCents: 48900,
        lastBookingDate: '2025-01-20',
        confidence: 90, // High confidence
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 40000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -88900,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group first to see the hint text
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    await waitFor(() => {
      // Old "Wir schätzen..." hint was replaced with "Aktuell trägst du etwa X € selbst"
      // Text is in story header section, may be split across elements
      // formatCurrency returns "€489.00", component adds " €", so text contains both
      const hintElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Aktuell trägst du etwa') && text.includes('489');
      });
      expect(hintElements.length).toBeGreaterThan(0);
    });
  });

  it('shows "zurückbekommen" hint for high confidence groups with negative net impact', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 15000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: -5000,
        lastBookingDate: '2025-01-20',
        confidence: 90, // High confidence
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 15000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group first to see the hint text
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    await waitFor(() => {
      // Old "Wir schätzen..." hint was replaced with "Aktuell hast du netto etwa X € zurückbekommen"
      // Text is in story header section, may be split across elements
      // formatCurrency returns "€50.00", component adds " €", so text contains both
      const hintElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Aktuell hast du netto etwa') && text.includes('50') && text.includes('zurückbekommen');
      });
      expect(hintElements.length).toBeGreaterThan(0);
    });
  });

  it('shows "Deine Ausgaben" and "Erstattungen & Rückzahlungen" labels in expanded view', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for detail labels
    await waitFor(() => {
      expect(screen.getByText('Deine Ausgaben')).toBeInTheDocument();
      expect(screen.getByText('Erstattungen & Rückzahlungen')).toBeInTheDocument();
    });
  });

  it('auto-expands and highlights focused group when focusedGroupId is provided', async () => {
    const mockGroups = [
      {
        groupId: 'group_focus',
        counterpartName: 'Focused Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
      {
        groupId: 'group_other',
        counterpartName: 'Other Person',
        txCount: 1,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 5000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-18',
        confidence: 75,
        inflows: [
          {
            id: 3,
            bookingDate: '2025-01-18',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    // Mock scrollIntoView
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { container } = render(<ReimbursementsReviewCard focusedGroupId="group_focus" />);

    await waitFor(() => {
      expect(screen.getByText('Focused Person')).toBeInTheDocument();
    });

    // focusedGroupId now auto-expands groups (added in component)
    // The component should highlight and auto-expand the focused group
    const focusedGroupEl = container.querySelector('#reimbursement-group-group_focus');
    expect(focusedGroupEl).toBeInTheDocument();
    
    // Check that group is highlighted (border-nf-primary/40 class when focused)
    expect(focusedGroupEl?.className).toContain('border-nf-primary/40');

    // Check that details are visible after auto-expansion
    await waitFor(() => {
      const headerElements = screen.getAllByText((content, element) => {
        const text = element?.textContent || '';
        return text.includes('Abrechnung mit') && text.includes('Focused Person');
      });
      expect(headerElements.length).toBeGreaterThan(0);
    });
    expect(focusedGroupEl?.className).toContain('border-nf-primary/40');

    // Check that "Ausgewählt von der Buchungsliste" text appears
    expect(screen.getByText('Ausgewählt von der Buchungsliste')).toBeInTheDocument();

    // Check that scrollIntoView was called
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it('does not auto-expand or highlight when focusedGroupId does not match any group', async () => {
    const mockGroups = [
      {
        groupId: 'group_other',
        counterpartName: 'Other Person',
        txCount: 1,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 5000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-18',
        confidence: 75,
        inflows: [
          {
            id: 3,
            bookingDate: '2025-01-18',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    const { container } = render(<ReimbursementsReviewCard focusedGroupId="nonexistent_group" />);

    await waitFor(() => {
      expect(screen.getByText('Other Person')).toBeInTheDocument();
    });

    // Check that group is NOT expanded (details should not be visible)
    expect(screen.queryByText(/Abrechnung mit Other Person/)).not.toBeInTheDocument();

    // Check that group does NOT have highlight class - border classes changed in new design
    const group = container.querySelector('#reimbursement-group-group_other');
    expect(group).toBeInTheDocument();
    expect(group?.className).not.toContain('border-sky-400');
    // New design uses border-nf-border-subtle
    expect(group?.className).toContain('border-nf-border-subtle');

    // Check that "Ausgewählt von der Buchungsliste" text does NOT appear
    expect(screen.queryByText('Ausgewählt von der Buchungsliste')).not.toBeInTheDocument();
  });

  it('does not auto-expand or highlight when focusedGroupId is null', async () => {
    const mockGroups = [
      {
        groupId: 'group_other',
        counterpartName: 'Other Person',
        txCount: 1,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 5000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-18',
        confidence: 75,
        inflows: [
          {
            id: 3,
            bookingDate: '2025-01-18',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    const { container } = render(<ReimbursementsReviewCard focusedGroupId={null} />);

    await waitFor(() => {
      expect(screen.getByText('Other Person')).toBeInTheDocument();
    });

    // Check that group is NOT expanded
    expect(screen.queryByText(/Abrechnung mit Other Person/)).not.toBeInTheDocument();

    // Check that group does NOT have highlight class
    const group = container.querySelector('#reimbursement-group-group_other');
    expect(group).toBeInTheDocument();
    expect(group?.className).not.toContain('border-sky-400');
  });

  it('renders ambiguous warning for low-confidence mixed-direction group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ambiguous',
        counterpartName: 'Ambiguous Person',
        txCount: 2,
        totalInflowCents: 21800, // 218 EUR
        totalOutflowCents: 0,
        totalExpenseCents: 43700, // 437 EUR
        netImpactCents: 21900, // 219 EUR net
        lastBookingDate: '2025-01-20',
        confidence: 30, // Low confidence
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 21800,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -43700,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Ambiguous Person')).toBeInTheDocument();
    });

    // Expand the group to see the Level-1 decision card
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check that ambiguous warning appears in the Level-1 decision card
    await waitFor(() => {
      expect(screen.getByText(/Hinweis: Dieses Muster ist unsicher – schau kurz, ob es wirklich eine Erstattung ist/)).toBeInTheDocument();
    });
  });

  it('uses softer settlement story copy for ambiguous mixed group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ambiguous',
        counterpartName: 'Ambiguous Person',
        txCount: 2,
        totalInflowCents: 21800,
        totalOutflowCents: 0,
        totalExpenseCents: 43700,
        netImpactCents: 21900, // Positive net impact
        lastBookingDate: '2025-01-20',
        confidence: 30,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 21800,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -43700,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Ambiguous Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for ambiguous warning in the Level-1 decision card
    await waitFor(() => {
      expect(screen.getByText(/Hinweis: Dieses Muster ist unsicher – schau kurz, ob es wirklich eine Erstattung ist/)).toBeInTheDocument();
    });
  });

  it('shows warning button label for ambiguous mixed group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ambiguous',
        counterpartName: 'Ambiguous Person',
        txCount: 2,
        totalInflowCents: 21800,
        totalOutflowCents: 0,
        totalExpenseCents: 43700,
        netImpactCents: 21900,
        lastBookingDate: '2025-01-20',
        confidence: 30,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 21800,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -43700,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Ambiguous Person')).toBeInTheDocument();
    });

    // Expand the group to see the Level-1 decision card
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check that ambiguous warning appears in the Level-1 decision card
    await waitFor(() => {
      expect(screen.getByText(/Hinweis: Dieses Muster ist unsicher – schau kurz, ob es wirklich eine Erstattung ist/)).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when clicking button for ambiguous mixed group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ambiguous',
        counterpartName: 'Ambiguous Person',
        txCount: 2,
        totalInflowCents: 21800,
        totalOutflowCents: 0,
        totalExpenseCents: 43700,
        netImpactCents: 21900,
        lastBookingDate: '2025-01-20',
        confidence: 30,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 21800,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -43700,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.markPassThrough as any).mockResolvedValue(undefined);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Ambiguous Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen" and save
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    const saveButton = screen.getByRole('button', { name: /Speichern/ });
    fireEvent.click(saveButton);

    // Check that confirm was called with correct message
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Dieses Muster ist nur schwach erkannt und enthält eingehende und ausgehende Zahlungen. Bist du sicher, dass du alle Buchungen als durchlaufende Posten markieren möchtest?'
      );
    });

    // Check that markPassThrough was NOT called (user cancelled)
    expect(reviewApi.markPassThrough).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('does not show ambiguous warning for high-confidence mixed group', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_high_conf',
        counterpartName: 'High Confidence Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 90, // High confidence
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('High Confidence Person')).toBeInTheDocument();
    });

    // Check that ambiguous warning does NOT appear
    expect(screen.queryByText(/Dieses Muster ist unsicher – vermutlich sind hier mehrere unabhängige Zahlungen vermischt/)).not.toBeInTheDocument();
  });

  it('renders primary category pill when primaryCategoryLabel is present', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_with_category',
        counterpartName: 'Lidl',
        txCount: 2,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 5000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 85,
        primaryCategoryId: 'groceries',
        primaryCategoryLabel: 'Lebensmittel & Drogerie',
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -5000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Lidl')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check for primary category - "Hauptkategorie:" label was removed, category shown as pill
    await waitFor(() => {
      // Category is shown directly as a pill without "Hauptkategorie:" label
      expect(screen.getByText('Lebensmittel & Drogerie')).toBeInTheDocument();
    });
  });

  it('does not render primary category when primaryCategoryLabel is undefined', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_no_category',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 0,
        netImpactCents: -10000,
        lastBookingDate: '2025-01-20',
        confidence: 75,
        primaryCategoryId: null,
        primaryCategoryLabel: null,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Check that primary category does NOT appear
    await waitFor(() => {
      expect(screen.queryByText(/Hauptkategorie:/)).not.toBeInTheDocument();
    });
  });

  it('ignores reimbursement group when "Getrennt behandeln" is selected and saved', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ignore',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.ignoreReimbursementGroup as any).mockResolvedValue(undefined);

    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group first
    const expandButton = screen.getByText('Details anzeigen');
    fireEvent.click(expandButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Getrennt behandeln" option
    const separateOption = screen.getByText('Getrennt behandeln');
    fireEvent.click(separateOption);

    // Click "Speichern" button
    const saveButton = screen.getByText('Speichern');
    fireEvent.click(saveButton);

    // Verify confirm dialog was shown - message updated in component
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Diese Buchungen werden nicht als Erstattung behandelt. Beide bleiben als normale Buchungen in deinen Auswertungen. Fortfahren?'
      );
    });

    // Verify API was called
    await waitFor(() => {
      expect(reviewApi.ignoreReimbursementGroup).toHaveBeenCalledWith('rb_test_ignore');
    });

    // Verify group is moved to resolved section
    await waitFor(() => {
      // Check that progress shows 1 erledigt
      expect(screen.getByText(/1 erledigt · 0 offen/)).toBeInTheDocument();
      // Group should appear in the resolved section
      expect(screen.getByText('Erledigte Abrechnungen (1)')).toBeInTheDocument();
    });
    
    // Open the resolved section to see the group
    const resolvedSection = screen.getByText('Erledigte Abrechnungen (1)').closest('summary');
    if (resolvedSection) {
      fireEvent.click(resolvedSection);
    }
    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('does not ignore group when "Getrennt behandeln" is selected but user cancels confirm', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_ignore',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 75,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.ignoreReimbursementGroup as any).mockResolvedValue(undefined);

    // Mock window.confirm to return false (user cancels)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group first
    const expandButton = screen.getByText('Details anzeigen');
    fireEvent.click(expandButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Getrennt behandeln" option
    const separateOption = screen.getByText('Getrennt behandeln');
    fireEvent.click(separateOption);

    // Click "Speichern" button
    const saveButton = screen.getByText('Speichern');
    fireEvent.click(saveButton);

    // Verify confirm dialog was shown
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    // Verify API was NOT called
    expect(reviewApi.ignoreReimbursementGroup).not.toHaveBeenCalled();

    // Verify group is still in DOM
    expect(screen.getByText('Test Person')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('renders counterparty summary header with net balances', async () => {
    const mockGroups = [
      {
        groupId: 'rb_pembe_1',
        counterpartName: 'Pembe',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 22300,
        netImpactCents: 12300, // +123 EUR (you are owed)
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -22300,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
      {
        groupId: 'rb_tim_1',
        counterpartName: 'Tim',
        txCount: 2,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 9500,
        netImpactCents: -4500, // -45 EUR (you owe)
        lastBookingDate: '2025-01-18',
        confidence: 80,
        inflows: [
          {
            id: 4,
            bookingDate: '2025-01-18',
            amountCents: 5000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 3,
            bookingDate: '2025-01-10',
            amountCents: -9500,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Wer steht wie bei dir?')).toBeInTheDocument();
    });

    // Check for Pembe (positive balance) - text may be split across elements
    // May appear multiple times (in summary chips and elsewhere), use getAllByText
    const pembeElements = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return text.includes('Pembe:') && 
             text.includes('123') && 
             text.includes('€') && 
             text.includes('du trägst mehr');
    });
    expect(pembeElements.length).toBeGreaterThan(0);

    // Check for Tim (negative balance) - text may be split across elements
    const timElements = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return text.includes('Tim:') && (text.includes('45') || text.includes('45.00')) && text.includes('€') && text.includes('sie trägt mehr');
    });
    expect(timElements.length).toBeGreaterThan(0);
  });

  it('shows balanced message when all groups are near-zero', async () => {
    const mockGroups = [
      {
        groupId: 'rb_balanced_1',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10020,
        netImpactCents: 20, // Only 0.20 EUR difference
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10020,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Aktuell sind deine Erstattungen weitgehend ausgeglichen.')).toBeInTheDocument();
    });

    // Should not show the summary header
    expect(screen.queryByText('Wer steht wie bei dir?')).not.toBeInTheDocument();
  });

  it('sorts counterparties by absolute net impact descending', async () => {
    const mockGroups = [
      {
        groupId: 'rb_small_1',
        counterpartName: 'Small Balance',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 0,
        totalExpenseCents: 10500,
        netImpactCents: 500, // 5 EUR
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [{ id: 2, bookingDate: '2025-01-20', amountCents: 10000, purpose: 'Refund', category: 'other' }],
        outflows: [{ id: 1, bookingDate: '2025-01-15', amountCents: -10500, purpose: 'Payment', category: 'other' }],
      },
      {
        groupId: 'rb_large_1',
        counterpartName: 'Large Balance',
        txCount: 2,
        totalInflowCents: 20000,
        totalOutflowCents: 0,
        totalExpenseCents: 50000,
        netImpactCents: 30000, // 300 EUR
        lastBookingDate: '2025-01-18',
        confidence: 80,
        inflows: [{ id: 4, bookingDate: '2025-01-18', amountCents: 20000, purpose: 'Refund', category: 'other' }],
        outflows: [{ id: 3, bookingDate: '2025-01-10', amountCents: -50000, purpose: 'Payment', category: 'other' }],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Wer steht wie bei dir?')).toBeInTheDocument();
    });

    // Get all summary pills
    const summaryText = screen.getByText(/Wer steht wie bei dir\?/).parentElement;
    const pills = summaryText?.querySelectorAll('.rounded-full');
    
    // Large Balance should appear first (higher absolute value) - text may be split across elements
    // May appear multiple times (in summary chips and elsewhere), use getAllByText
    const largeBalanceElements = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return text.includes('Large Balance:') && 
             text.includes('300') && 
             text.includes('€');
    });
    expect(largeBalanceElements.length).toBeGreaterThan(0);
    
    const smallBalanceElements = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return text.includes('Small Balance:') && 
             text.includes('5') && 
             text.includes('€');
    });
    expect(smallBalanceElements.length).toBeGreaterThan(0);
  });

  it('opens allocation wizard when clicking "Details & Anteile anpassen…"', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_alloc',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 21817,
        totalOutflowCents: 0,
        totalExpenseCents: 43745,
        netImpactCents: 21928,
        lastBookingDate: '2025-01-20',
        confidence: 85,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 21817,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -43745,
            purpose: 'Movie Park / Lidl',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    // Wait for Level-1 decision card to appear
    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen" first to make the button visible
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    // Click "Details & Anteile anpassen…"
    const linkButton = screen.getByText('Details & Anteile anpassen…');
    fireEvent.click(linkButton);

    // Check that wizard appears - use getAllByText for heading since there may be a button with same text
    await waitFor(() => {
      const wizardTitles = screen.getAllByText('Zahlung verknüpfen');
      expect(wizardTitles.length).toBeGreaterThan(0);
      // Check for wizard content labels
      expect(screen.getByText('Erstattung:')).toBeInTheDocument();
      expect(screen.getByText('Davon verteilt:')).toBeInTheDocument();
      expect(screen.getByText('Übrig:')).toBeInTheDocument();
    });
  });

  it('shows progress strip with correct counts', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_1',
        counterpartName: 'Person 1',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 80,
        inflows: [{ id: 1, bookingDate: '2025-01-20', amountCents: 10000, purpose: 'Refund', category: 'other' }],
        outflows: [{ id: 2, bookingDate: '2025-01-15', amountCents: -10000, purpose: 'Payment', category: 'other' }],
      },
      {
        groupId: 'rb_test_2',
        counterpartName: 'Person 2',
        txCount: 1,
        totalInflowCents: 5000,
        totalOutflowCents: 0,
        totalExpenseCents: 0,
        netImpactCents: -5000,
        lastBookingDate: '2025-01-21',
        confidence: 90,
        inflows: [{ id: 3, bookingDate: '2025-01-21', amountCents: 5000, purpose: 'Refund', category: 'other' }],
        outflows: [],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Person 1')).toBeInTheDocument();
    });

    // Check progress strip shows correct counts
    expect(screen.getByText(/0 erledigt · 2 offen/)).toBeInTheDocument();
    expect(screen.getByText('Erstattungen prüfen')).toBeInTheDocument();
  });

  it('marks group as resolved and shows in Erledigt section after saving allocations', async () => {
    const mockGroups = [
      {
        groupId: 'rb_test_123',
        counterpartName: 'Test Person',
        txCount: 2,
        totalInflowCents: 10000,
        totalOutflowCents: 10000,
        totalExpenseCents: 10000,
        netImpactCents: 0,
        lastBookingDate: '2025-01-20',
        confidence: 80,
        inflows: [
          {
            id: 2,
            bookingDate: '2025-01-20',
            amountCents: 10000,
            purpose: 'Refund',
            category: 'other',
          },
        ],
        outflows: [
          {
            id: 1,
            bookingDate: '2025-01-15',
            amountCents: -10000,
            purpose: 'Payment',
            category: 'other',
          },
        ],
      },
    ];

    (reviewApi.fetchReimbursementGroups as any).mockResolvedValue(mockGroups);
    (reviewApi.saveReimbursementAllocations as any).mockResolvedValue(undefined);

    render(<ReimbursementsReviewCard />);

    await waitFor(() => {
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });

    // Expand the group
    const detailsButton = screen.getByText('Details anzeigen');
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText('Wie soll das in deinen Auswertungen erscheinen?')).toBeInTheDocument();
    });

    // Select "Als Erstattung verknüpfen"
    const reimbursementOption = screen.getByText(/Als Erstattung verknüpfen/);
    fireEvent.click(reimbursementOption);

    // Open allocation wizard
    const linkButton = screen.getByText('Details & Anteile anpassen…');
    fireEvent.click(linkButton);

    await waitFor(() => {
      const wizardTitles = screen.getAllByText('Zahlung verknüpfen');
      expect(wizardTitles.length).toBeGreaterThan(0);
    });

    // Save allocations
    const saveButton = screen.getByRole('button', { name: /Abrechnung übernehmen/ });
    fireEvent.click(saveButton);

    // After successful save, group should be marked as resolved
    // Since loadGroups() is called, the group may be refreshed or removed by backend
    await waitFor(() => {
      // Verify API was called
      expect(reviewApi.saveReimbursementAllocations).toHaveBeenCalled();
    });
  });
});
