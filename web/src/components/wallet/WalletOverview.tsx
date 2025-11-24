import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountsOverview } from '../../hooks/useAccountsOverview';
import { formatCurrency, formatDate } from '../../lib/format';
import { TrendingUp, TrendingDown, MoreVertical, Trash2 } from 'lucide-react';
import { deleteAccount } from '../../api/accountsApi';
import { toast } from '../../lib/toast';

type AccountType = 'checking' | 'credit' | 'savings' | 'cash' | 'other';

function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'checking':
      return 'Hauptkonto';
    case 'credit':
      return 'Kreditkarte';
    case 'savings':
      return 'Sparkonto';
    case 'cash':
      return 'Wallet';
    default:
      return 'Konto';
  }
}

function getAccountTypeColor(type: AccountType): string {
  switch (type) {
    case 'checking':
      return 'from-blue-900 via-blue-800 to-blue-900';
    case 'credit':
      return 'from-purple-900 via-purple-800 to-purple-900';
    case 'savings':
      return 'from-emerald-900 via-emerald-800 to-emerald-900';
    case 'cash':
      return 'from-amber-900 via-amber-800 to-amber-900';
    default:
      return 'from-slate-900 via-slate-800 to-slate-900';
  }
}

interface WalletOverviewProps {
  /**
   * Number of grid columns for account cards on desktop.
   * If not provided, uses auto-fit grid that adapts to available space.
   * Set to 2 for a 2×2 grid layout (e.g. on Dashboard).
   */
  gridColumns?: number;
}

export const WalletOverview: React.FC<WalletOverviewProps> = ({ gridColumns }) => {
  const { data, isLoading, error, refetch } = useAccountsOverview();
  const navigate = useNavigate();
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDeleteMenu(null);
      }
    };

    if (showDeleteMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDeleteMenu]);

  const handleAccountClick = (accountId: string) => {
    navigate(`/transactions?accountId=${encodeURIComponent(accountId)}`);
  };

  const handleAccountKeyDown = (e: React.KeyboardEvent, accountId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAccountClick(accountId);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation(); // Prevent card click
    if (!confirm('Möchtest du dieses Konto wirklich entfernen? Transaktionen bleiben erhalten.')) {
      return;
    }

    try {
      setDeletingAccountId(accountId);
      setShowDeleteMenu(null); // Close menu immediately
      
      // Call delete API
      await deleteAccount(accountId);
      
      // Show success toast
      toast('Konto wurde entfernt', 'success');
      
      // Refetch accounts data to update the list
      if (refetch) {
        await refetch();
      } else {
        // Fallback: reload the page if refetch is not available
        window.location.reload();
      }
    } catch (err: any) {
      console.error('[WalletOverview] Delete account error:', err);
      toast(err?.message || 'Fehler beim Entfernen des Kontos', 'error');
    } finally {
      setDeletingAccountId(null);
    }
  };

  const handleMenuToggle = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation(); // Prevent card click
    setShowDeleteMenu(showDeleteMenu === accountId ? null : accountId);
  };

  // Skeleton loader
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-5 sm:p-6 lg:p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-4">
            <div className="h-6 w-32 bg-nf-bg-card-subtle rounded animate-pulse" />
            <div className="h-12 w-48 bg-nf-bg-card-subtle rounded animate-pulse" />
          </div>
          <div className="h-8 w-48 bg-nf-bg-card-subtle rounded-full animate-pulse" />
        </div>
        <div
          className={`flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 md:grid ${
            gridColumns === 2
              ? 'md:grid-cols-2'
              : 'md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]'
          } md:overflow-x-visible md:pb-0 md:-mx-0 md:px-0`}
        >
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-64 shrink-0 md:w-full md:shrink h-40 bg-nf-bg-card-subtle rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-5 sm:p-6 lg:p-7">
        <div className="text-sm text-nf-negative">{error}</div>
      </div>
    );
  }

  // Empty state
  if (!data || data.accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-5 sm:p-6 lg:p-7">
        <div className="text-sm text-nf-text-muted">Noch keine Konten vorhanden.</div>
      </div>
    );
  }

  const { accounts, totalBalance, totalDelta30d, upcomingPayments } = data;
  const displayAccounts = accounts.slice(0, 4); // Show first 4 accounts
  const deltaColor = totalDelta30d >= 0 ? 'text-nf-positive' : 'text-nf-negative';
  const deltaIcon = totalDelta30d >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card shadow-elevated p-4 sm:p-5 lg:p-6 space-y-6">
      {/* Top Section: Title + Balance + Period Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-nf-text-main">Gesamtsaldo</h2>
          <div className="mt-2">
            <p className={`text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums ${
              totalBalance < 0 ? 'text-nf-negative' : 'text-nf-text-main'
            }`}>
              {formatCurrency(totalBalance)}
            </p>
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              totalDelta30d >= 0 ? 'bg-nf-positive/10 text-nf-positive' : 'bg-nf-negative/10 text-nf-negative'
            }`}>
              {React.createElement(deltaIcon, { className: 'h-3.5 w-3.5' })}
              <span>
                {totalDelta30d >= 0 ? '+' : ''}{formatCurrency(totalDelta30d)} vs. letzten 30 Tagen
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-nf-primary bg-nf-primary-soft px-3 py-1 text-xs font-medium text-nf-primary"
          >
            30 Tage
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main hover:border-nf-primary hover:text-nf-primary transition-colors"
          >
            90 Tage
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-nf-border-subtle bg-nf-bg-card px-3 py-1 text-xs font-medium text-nf-text-main hover:border-nf-primary hover:text-nf-primary transition-colors"
          >
            Dieses Jahr
          </button>
        </div>
      </div>

      {/* Account Cards Grid - Full Width Responsive */}
      {/* Mobile: horizontal scroll, Desktop: responsive grid (2x2 for 4 accounts, auto-fit otherwise) */}
      <div
        className={`flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 md:grid ${
          gridColumns === 2
            ? 'md:grid-cols-2'
            : gridColumns === 3
            ? 'md:grid-cols-3'
            : gridColumns === 4
            ? 'md:grid-cols-4'
            : 'md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]'
        } md:overflow-x-visible md:pb-0 md:-mx-0 md:px-0`}
      >
        {displayAccounts.map((account, idx) => {
          const accountDeltaColor = account.last30dDelta >= 0 ? 'text-emerald-300' : 'text-rose-300';
          const accountDeltaIcon = account.last30dDelta >= 0 ? TrendingUp : TrendingDown;
          const gradientClass = getAccountTypeColor(account.type);
          const last4 = account.bankName ? undefined : account.id.slice(-4);

          return (
              <div
                key={account.id}
                role="button"
                tabIndex={0}
                onClick={() => handleAccountClick(account.id)}
                onKeyDown={e => handleAccountKeyDown(e, account.id)}
                className={`relative w-64 shrink-0 md:w-full md:shrink rounded-3xl bg-gradient-to-br ${gradientClass} text-white shadow-elevated hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent`}
              >
                <div className="p-4 sm:p-5 flex flex-col h-44 sm:h-48">
                  {/* Top: Name + Badge + Delete Menu */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{account.name}</p>
                      <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium mt-1">
                        {getAccountTypeLabel(account.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isPrimary && (
                        <span className="inline-flex items-center rounded-full bg-nf-primary/30 px-2 py-0.5 text-[10px] font-medium">
                          Primär
                        </span>
                      )}
                      {/* Delete Menu Button */}
                      <div className="relative" ref={menuRef}>
                        <button
                          type="button"
                          onClick={e => handleMenuToggle(e, account.id)}
                          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                          aria-label="Konto-Optionen"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {/* Delete Menu Dropdown */}
                        {showDeleteMenu === account.id && (
                          <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-nf-border-subtle z-10 min-w-[160px]">
                            <button
                              type="button"
                              onClick={e => handleDeleteClick(e, account.id)}
                              disabled={deletingAccountId === account.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-nf-negative hover:bg-nf-negative/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>{deletingAccountId === account.id ? 'Wird entfernt...' : 'Konto entfernen'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                {/* Middle: Balance + Delta */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-2xl font-bold tabular-nums mb-2">
                    {formatCurrency(account.balance)}
                  </p>
                  <div className={`inline-flex items-center gap-1 text-xs ${accountDeltaColor}`}>
                    {React.createElement(accountDeltaIcon, { className: 'h-3 w-3' })}
                    <span>
                      {account.last30dDelta >= 0 ? '+' : ''}{formatCurrency(Math.abs(account.last30dDelta))}
                    </span>
                  </div>
                </div>

                {/* Bottom: Bank + Last4 */}
                <div className="mt-auto pt-3 border-t border-white/20">
                  <p className="text-[10px] text-white/70">
                    {account.bankName || 'Konto'} {last4 ? `• ${last4}` : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Payments - Below Cards (only show when non-empty or show subtle empty state) */}
      {upcomingPayments.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-nf-text-main mb-3">Demnächst fällig</h3>
          <div className="rounded-2xl border border-nf-border-subtle bg-nf-bg-card-subtle p-4">
            <div className="space-y-3">
              {upcomingPayments.map(payment => {
                const paymentDate = new Date(payment.date);
                const dateStr = paymentDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
                return (
                  <div key={payment.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nf-text-main truncate">{payment.label}</p>
                      <p className="text-xs text-nf-text-muted">{dateStr}</p>
                    </div>
                    <p className="text-sm font-semibold text-nf-negative tabular-nums whitespace-nowrap">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Subtle empty state - doesn't steal layout space
        <div className="text-center py-2">
          <p className="text-xs text-nf-text-muted">
            Keine anstehenden Zahlungen in den nächsten 14 Tagen 🎉
          </p>
        </div>
      )}
    </div>
  );
};

