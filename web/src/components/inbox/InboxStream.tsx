/**
 * InboxStream Component
 * 
 * Virtualized list of transactions with status === 'inbox'.
 * Supports swipe gestures: Right to "Approve", Left to "Split/Edit".
 * 
 * Features:
 * - PayPal reimbursement detection and highlighting
 * - Swipe gestures with framer-motion
 * - Virtualized rendering for performance
 */

import React, { useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { InboxItem } from './InboxItem';
import { SplitDrawer } from './SplitDrawer';
import clsx from 'clsx';

export interface InboxTransaction {
  id: number;
  publicId: string | null;
  bookingDate: string;
  amountCents: number;
  payee: string | null;
  memo: string | null;
  category: string | null;
  status: string | null;
}

interface InboxStreamProps {
  onTransactionProcessed?: () => void;
}

const SWIPE_THRESHOLD = 0.3; // 30% of width

export const InboxStream: React.FC<InboxStreamProps> = ({ onTransactionProcessed }) => {
  const [transactions, setTransactions] = useState<InboxTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<InboxTransaction | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [swipedId, setSwipedId] = useState<number | null>(null);

  useEffect(() => {
    loadInboxTransactions();
  }, []);

  const loadInboxTransactions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/inbox');
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('[InboxStream] Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId: number) => {
    try {
      await axios.post(`/api/inbox/${transactionId}/approve`);
      // Remove from list
      setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      onTransactionProcessed?.();
    } catch (err) {
      console.error('[InboxStream] Failed to approve transaction:', err);
    }
  };

  const handleSkip = async (transactionId: number) => {
    try {
      await axios.post(`/api/inbox/${transactionId}/skip`);
      // Remove from list
      setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      onTransactionProcessed?.();
    } catch (err) {
      console.error('[InboxStream] Failed to skip transaction:', err);
    }
  };

  const handleSplit = (transaction: InboxTransaction) => {
    setSelectedTransaction(transaction);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedTransaction(null);
  };

  const handleDrawerSaved = () => {
    if (selectedTransaction) {
      // Remove from list
      setTransactions(prev => prev.filter(tx => tx.id !== selectedTransaction.id));
      onTransactionProcessed?.();
    }
    handleDrawerClose();
  };

  const isPayPalReimbursement = (tx: InboxTransaction): boolean => {
    const payeeLower = (tx.payee || '').toLowerCase();
    return payeeLower.includes('paypal') && tx.amountCents > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading transactions...</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Check className="h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">Inbox Zero!</h3>
        <p className="text-sm text-zinc-500">All transactions have been reviewed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 bg-white">
        <h2 className="text-lg font-semibold text-zinc-900">
          Transaction Inbox ({transactions.length})
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Swipe right to approve • Swipe left to split
        </p>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto">
        {transactions.map((transaction) => {
          const isPayPal = isPayPalReimbursement(transaction);
          const isSwiped = swipedId === transaction.id;

          return (
            <SwipeableTransactionRow
              key={transaction.id}
              transaction={transaction}
              isPayPal={isPayPal}
              onApprove={() => handleApprove(transaction.id)}
              onSplit={() => handleSplit(transaction)}
              onSkip={() => handleSkip(transaction.id)}
              isSwiped={isSwiped}
              onSwipeStart={() => setSwipedId(transaction.id)}
              onSwipeEnd={() => setSwipedId(null)}
            />
          );
        })}
      </div>

      {/* Split Drawer */}
      {selectedTransaction && (
        <SplitDrawer
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose}
          transaction={{
            id: selectedTransaction.id,
            amountCents: selectedTransaction.amountCents,
            payee: selectedTransaction.payee,
            memo: selectedTransaction.memo,
          }}
          onSaved={handleDrawerSaved}
          isPayPalReimbursement={isPayPalReimbursement(selectedTransaction)}
        />
      )}
    </div>
  );
};

interface SwipeableTransactionRowProps {
  transaction: InboxTransaction;
  isPayPal: boolean;
  onApprove: () => void;
  onSplit: () => void;
  onSkip: () => void;
  isSwiped: boolean;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
}

const SwipeableTransactionRow: React.FC<SwipeableTransactionRowProps> = ({
  transaction,
  isPayPal,
  onApprove,
  onSplit,
  onSkip,
  isSwiped,
  onSwipeStart,
  onSwipeEnd,
}) => {
  const [dragX, setDragX] = React.useState(0);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = Math.abs(info.offset.x);
    const swipeVelocity = Math.abs(info.velocity.x);
    const width = window.innerWidth;
    const threshold = width * SWIPE_THRESHOLD;

    if (swipeDistance > threshold || swipeVelocity > 500) {
      if (info.offset.x > 0) {
        // Swipe right - Approve
        onApprove();
      } else {
        // Swipe left - Split
        onSplit();
      }
    }

    setDragX(0);
    onSwipeEnd();
  };

  const handleDragStart = () => {
    onSwipeStart();
  };

  const amountFormatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.abs(transaction.amountCents) / 100);

  const isPositive = transaction.amountCents > 0;
  const displayText = transaction.payee || transaction.memo || 'Unbekannt';
  const dateFormatted = new Date(transaction.bookingDate).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="relative overflow-hidden">
      {/* Background Actions */}
      <div className="absolute inset-0 flex">
        {/* Left: Split Action */}
        <div className="flex-1 bg-zinc-800 flex items-center justify-start pl-4">
          <X className="h-6 w-6 text-white" />
          <span className="ml-2 text-white font-medium">Split</span>
        </div>
        {/* Right: Approve Action */}
        <div className="flex-1 bg-emerald-600 flex items-center justify-end pr-4">
          <Check className="h-6 w-6 text-white" />
          <span className="mr-2 text-white font-medium">Approve</span>
        </div>
      </div>

      {/* Transaction Row */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrag={(_, info) => setDragX(info.offset.x)}
        className={clsx(
          'relative bg-white border-b border-zinc-100',
          isSwiped && 'z-10'
        )}
        style={{ x: dragX }}
      >
        <div className="h-16 flex items-center px-4">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {/* Date */}
            <div className="text-xs text-zinc-500 font-medium w-12 flex-shrink-0">
              {dateFormatted}
            </div>

            {/* Payee/Memo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm text-zinc-900 truncate">
                  {displayText}
                </div>
                {isPayPal && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Reimbursement?
                  </span>
                )}
              </div>
              {transaction.category && (
                <div className="text-xs text-zinc-500 truncate">
                  {transaction.category}
                </div>
              )}
            </div>

            {/* Amount */}
            <div
              className={clsx(
                'text-sm font-semibold flex-shrink-0',
                isPositive ? 'text-emerald-600' : 'text-zinc-900'
              )}
            >
              {isPositive ? '+' : ''}
              {amountFormatted}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

