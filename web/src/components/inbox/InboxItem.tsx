/**
 * InboxItem Component
 * 
 * Swipeable transaction row for the Transaction Inbox workflow.
 * Uses framer-motion for swipe-left gesture (threshold 30%).
 * 
 * Style: "Thin Utility" - minimal borders, clean typography
 */

import React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface InboxItemProps {
  id: number;
  date: string;
  payee: string | null;
  memo: string | null;
  amountCents: number;
  category?: string | null;
  onSwipeOpen?: () => void;
  onClick?: () => void;
}

const SWIPE_THRESHOLD = 0.3; // 30% of width

export const InboxItem: React.FC<InboxItemProps> = ({
  id,
  date,
  payee,
  memo,
  amountCents,
  category,
  onSwipeOpen,
  onClick,
}) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0], [0.5, 1]);
  const scale = useTransform(x, [-100, 0], [0.95, 1]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = Math.abs(info.offset.x);
    const swipeVelocity = Math.abs(info.velocity.x);
    const width = window.innerWidth;
    const threshold = width * SWIPE_THRESHOLD;

    // Trigger if dragged past threshold or with sufficient velocity
    if ((swipeDistance > threshold || swipeVelocity > 500) && info.offset.x < 0) {
      onSwipeOpen?.();
    }
  };

  const isPositive = amountCents > 0;
  const amountFormatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.abs(amountCents) / 100);

  const displayText = payee || memo || 'Unbekannt';
  const dateFormatted = new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      style={{ x, opacity, scale }}
      className="h-16 border-b border-zinc-100 bg-white flex items-center px-4 cursor-pointer active:cursor-grabbing"
      onClick={onClick}
      aria-label={`Transaction: ${displayText}, ${amountFormatted}`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        {/* Date */}
        <div className="text-xs text-zinc-500 font-medium w-12 flex-shrink-0">
          {dateFormatted}
        </div>

        {/* Payee/Memo */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-zinc-900 truncate">
            {displayText}
          </div>
          {category && (
            <div className="text-xs text-zinc-500 truncate">
              {category}
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

        {/* Chevron */}
        <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0 ml-2" />
      </div>
    </motion.div>
  );
};

