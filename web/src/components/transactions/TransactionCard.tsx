import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Link2 } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { getCategoryMeta } from '../../lib/categories';
import { getTransactionDisplayName } from '../../lib/transactions/displayName';
import CategoryControl from '../CategoryControl';
import { TransactionFlagsBadges } from '../Badges/TransactionFlagsBadges';
import { ExplanationTooltip } from '../ExplanationTooltip';
import { PromoteRuleButton } from '../PromoteRuleButton';
import { useAccounts } from '../../hooks/useAccounts';
import type { ApiTransaction, DisplayTransaction } from '../../pages/Transactions';

type TransactionCardProps = {
  transaction: DisplayTransaction;
  isSelected?: boolean;
  onSelect?: (id: number, checked: boolean) => void;
  onCategoryChange?: (txId: number, nextCategory: string | null) => void;
  onNavigate?: (tx: DisplayTransaction) => void;
  showSubscriptionCandidate?: boolean;
};

export const TransactionCard = React.memo<TransactionCardProps>(
  ({ transaction: tx, isSelected = false, onSelect, onCategoryChange, onNavigate, showSubscriptionCandidate = false }) => {
    const navigate = useNavigate();
    const [isCategoryEditing, setIsCategoryEditing] = useState(false);
    const { accounts } = useAccounts();
    const meta = getCategoryMeta(tx.category ?? undefined);
    const showInternal = Boolean(tx.isInternalTransfer || tx.transferLinkId);
    const rawMeta = (tx.metadata ?? undefined) as Record<string, unknown> | undefined;
    
    // Get account names for internal transfers
    const fromAccountName = useMemo(() => {
      // For now, we don't have fromAccountId/toAccountId in the API response
      // This would need to be added to the backend transaction DTO
      // For now, we'll use the accountId if available
      if (tx.isInternalTransfer && tx.accountId) {
        const account = accounts.find(a => a.id === tx.accountId);
        return account?.name || null;
      }
      return null;
    }, [tx.isInternalTransfer, tx.accountId, accounts]);
    
    const toAccountName = useMemo(() => {
      // Similarly, we'd need toAccountId in the API response
      // For now, try to infer from counterparty if it matches an account name
      if (tx.isInternalTransfer && tx.counterpart) {
        const account = accounts.find(a => 
          a.name?.toLowerCase().includes(tx.counterpart?.toLowerCase() || '') ||
          a.iban === tx.counterpartyIban
        );
        return account?.name || null;
      }
      return null;
    }, [tx.isInternalTransfer, tx.counterpart, tx.counterpartyIban, accounts]);
    const transferReasons =
      rawMeta && Array.isArray(rawMeta.transferReasons)
        ? (rawMeta.transferReasons as string[])
        : rawMeta && typeof rawMeta.transferReasons === 'string'
        ? (rawMeta.transferReasons as string).split(',').filter(Boolean)
        : null;

    const fingerprintInput = useMemo(
      () =>
        !tx.externalId && tx.bookingDate
          ? {
              bookingDate: tx.bookingDate ?? '',
              valueDate: tx.valueDate ?? tx.bookingDate ?? '',
              amountCents: tx.amountCents ?? Math.round((tx.amount ?? 0) * 100),
              currency: tx.currency ?? 'EUR',
              purpose: tx.purpose ?? tx.memo ?? '',
              counterpartName: tx.counterpart ?? tx.payee ?? null,
              accountIban: null,
            }
          : undefined,
      [tx],
    );

    // Use centralized display name helper for consistent user-friendly labels
    const merchant = getTransactionDisplayName(tx);
    const bookingText = useMemo(() => {
      const parts: string[] = [];
      if (tx.source) {
        if (tx.source === 'manual') parts.push('Manuell');
        else if (tx.source === 'ml') parts.push('ML');
        else if (tx.source === 'rule') parts.push('Regel');
        else parts.push(tx.source);
      }
      if (tx.sourceProfile) parts.push(tx.sourceProfile);
      return parts.join(' · ') || undefined;
    }, [tx.source, tx.sourceProfile]);

    const handleClick = (e: React.MouseEvent) => {
      // Don't trigger navigation if clicking on interactive elements
      if (
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('select') ||
        (e.target as HTMLElement).closest('input')
      ) {
        return;
      }
      onNavigate?.(tx);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate?.(tx);
      }
    };

    const handleCategoryApplied = (_resolvedId: string, next: string | null) => {
      onCategoryChange?.(tx.id, next);
      setIsCategoryEditing(false);
    };

    const amountColor = tx.amount < 0 ? 'text-nf-negative' : 'text-nf-positive';
    const captionText = tx.isPassThrough
      ? 'Durchlaufend'
      : tx.isReimbursement
      ? 'Erstattung'
      : tx.sourceProfile
      ? `Konto: ${tx.sourceProfile}`
      : undefined;

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`group flex items-center justify-between gap-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card px-3.5 py-2.5 text-sm shadow-card transition-all hover:-translate-y-[1px] hover:border-nf-primary/30 hover:shadow-elevated ${
          isSelected ? 'ring-2 ring-nf-primary' : ''
        }`}
      >
        {/* Left: Checkbox (if selection enabled) */}
        {onSelect && (
          <input
            type="checkbox"
            aria-label="Transaktion auswählen"
            checked={isSelected}
            onChange={e => {
              e.stopPropagation();
              onSelect(tx.id, e.target.checked);
            }}
            onClick={e => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 dark:border-slate-600 dark:focus:ring-indigo-500/30"
          />
        )}

        {/* Left Column: Merchant & Details */}
        <div className="flex-1 min-w-0">
          {/* Merchant/Purpose */}
          <div className="truncate text-[13px] font-medium text-nf-text-main">{merchant}</div>

          {/* Booking text / source */}
          {bookingText && (
            <div className="mt-0.5 line-clamp-1 text-[11px] text-nf-text-muted">{bookingText}</div>
          )}

          {/* Badges row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Category pill or dropdown */}
            {isCategoryEditing ? (
              <div className="relative z-10" onClick={e => e.stopPropagation()}>
                <CategoryControl
                  id={tx.externalId ?? undefined}
                  fingerprintInput={fingerprintInput}
                  category={tx.category}
                  categorySource={tx.categorySource}
                  rawText={tx.purpose ?? tx.memo ?? null}
                  merchant={tx.payee ?? tx.counterpart ?? null}
                  onApplied={handleCategoryApplied}
                />
              </div>
            ) : (
              <ExplanationTooltip
                explanationText={tx.categorizationReasonText}
                explanationCode={tx.categorizationReasonCode}
                isOther={tx.category === 'other' || tx.category === 'other_review'}
              >
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsCategoryEditing(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full bg-nf-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-nf-primary transition hover:opacity-80 ${
                    tx.category === 'other' || tx.category === 'other_review'
                      ? 'ring-1 ring-nf-warning/50'
                      : ''
                  }`}
                  style={tx.category && tx.category !== 'other' && tx.category !== 'other_review' ? { backgroundColor: meta.background, color: meta.color } : undefined}
                >
                  {showInternal && <Link2 className="h-3 w-3" />}
                  {meta.label}
                </button>
              </ExplanationTooltip>
            )}

            {/* Source tags */}
            {tx.source && tx.source !== 'manual' && (
              <span className="inline-flex items-center rounded-full bg-nf-bg-card-subtle px-2 py-0.5 text-[10px] font-medium text-nf-text-muted">
                {tx.source === 'ml' ? 'ML' : tx.source === 'rule' ? 'Regel' : tx.source}
              </span>
            )}

            {/* Transaction flags */}
            <TransactionFlagsBadges
              isPassThrough={tx.isPassThrough}
              isInternalTransfer={tx.isInternalTransfer}
              internalTransferKind={tx.internalTransferKind ?? null}
              internalTransferDirection={tx.internalTransferDirection ?? null}
              fromAccountName={fromAccountName}
              toAccountName={toAccountName}
              isReimbursement={tx.isReimbursement}
              reimbursementRole={tx.reimbursementRole ?? null}
              isCashWithdrawal={tx.isCashWithdrawal}
            />

            {/* Reimbursement link button */}
            {tx.reimbursementGroupId && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/review?focusReimbursementGroup=${encodeURIComponent(tx.reimbursementGroupId!)}`);
                }}
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900 transition-colors"
              >
                Abrechnung öffnen
              </button>
            )}

            {/* Subscription candidate badge */}
            {showSubscriptionCandidate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-200">
                Abo-Kandidat
              </span>
            )}

            {/* Promote rule button for eligible transactions */}
            {!isCategoryEditing &&
              tx.category &&
              tx.category !== 'other' &&
              tx.category !== 'other_review' &&
              !tx.isInternalTransfer &&
              !tx.isRefund &&
              !tx.isRefunded &&
              !tx.isReimbursement && (
                <PromoteRuleButton
                  transactionId={tx.id}
                  category={tx.category}
                  merchant={tx.payee ?? tx.counterpart ?? null}
                  onSuccess={() => {
                    // Optionally refresh or update UI
                  }}
                />
              )}
          </div>
        </div>

        {/* Right Column: Amount & Affordance */}
        <div className="flex flex-col items-end justify-center gap-1 text-right">
          <div className={`text-[13px] font-semibold tabular-nums ${amountColor} ${tx.isPassThrough ? 'opacity-70' : ''}`}>
            {formatCurrency(tx.amount)}
          </div>
          {captionText && (
            <div className="text-[10px] text-nf-text-soft">{captionText}</div>
          )}
          {onNavigate && (
            <ChevronRight className="h-4 w-4 text-nf-text-soft opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
      </div>
    );
  },
);

TransactionCard.displayName = 'TransactionCard';

