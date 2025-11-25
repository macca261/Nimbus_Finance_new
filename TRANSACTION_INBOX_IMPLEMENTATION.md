# Transaction Inbox "Inbox Zero" Implementation

## Overview

Refactored the Transaction Review workflow from a batch-list to an "Inbox Zero" stream with robust Split Transaction support, specifically handling the "PayPal Reimbursement" edge case.

## Implementation Summary

### 1. Database Schema Update ✅

**Migration File:** `backend/src/db/migrations/00_init_splits.sql`

- Created `transaction_splits` table with:
  - `id` (TEXT PRIMARY KEY, UUID)
  - `transaction_id` (INTEGER, FK to transactions.id, ON DELETE CASCADE)
  - `category_id` (TEXT NOT NULL)
  - `amount_cents` (INTEGER NOT NULL) - Supports positive (refund) and negative (spend)
  - `memo` (TEXT, nullable)

**Schema Updates in `backend/src/db.ts`:**
- Added `status` column to `transactions` table (default: 'inbox')
  - Values: 'inbox', 'reviewed', 'skipped'
- Kept `review_status` for backward compatibility
- Auto-migration: Existing transactions default to 'inbox' status

### 2. Backend Logic ✅

**Service:** `backend/src/services/transactionService.ts`

**Key Functions:**
- `distributeTransaction()` - Splits transaction into multiple category allocations
  - Validates sum of allocations equals transaction amount (zero-sum constraint)
  - For positive transactions (Income/Reimbursement), allows assigning to Expense Categories (Refund/Contra-Expense)
  - Inserts rows into `transaction_splits`
  - Marks parent transaction status as 'reviewed'
  
- `getInboxTransactions()` - Fetches transactions with `status === 'inbox'`
- `approveTransaction()` - Approves transaction (keeps auto-category, marks as reviewed)
- `skipTransaction()` - Marks transaction as skipped
- `suggestCategoriesForReimbursement()` - Suggests categories based on recent expenses matching amount

**API Routes:** `backend/src/routes/inbox.ts`

- `GET /api/inbox` - Get inbox transactions
- `POST /api/inbox/distribute` - Distribute transaction into splits
- `POST /api/inbox/:transactionId/approve` - Approve transaction
- `POST /api/inbox/:transactionId/skip` - Skip transaction
- `GET /api/inbox/suggest-categories` - Get category suggestions for reimbursement

**Validation:**
- Zod schema (`DistributeTransactionValidator`) ensures:
  - At least one allocation required
  - Sum of allocations equals transaction amount
  - Amounts converted from EUR to cents

### 3. Frontend Components ✅

#### A. `InboxStream.tsx`

**Location:** `web/src/components/inbox/InboxStream.tsx`

**Features:**
- Displays transactions with `status === 'inbox'`
- Swipe gestures:
  - **Swipe Right** → Approve (keep auto-category)
  - **Swipe Left** → Split/Edit (opens drawer)
- PayPal Reimbursement Detection:
  - Highlights transactions where `payee.includes('paypal')` and `amount > 0`
  - Shows "Reimbursement?" badge
- Empty state: "Inbox Zero!" message when no transactions
- Real-time updates after approve/split/skip actions

**Visual Design:**
- "Thin Utility" styling (zinc colors, minimal borders)
- Swipe reveals background actions (green for approve, dark for split)
- Transaction row: h-16, border-b border-zinc-100

#### B. `SplitDrawer.tsx` (Enhanced)

**Location:** `web/src/components/inbox/SplitDrawer.tsx`

**Features:**
- Bottom drawer using simple overlay pattern (no external library needed)
- Header: "Distribute {amount}" with PayPal indicator
- Dynamic split rows using React Hook Form `useFieldArray`
- **PayPal-Specific:**
  - "Suggest Categories" button appears for PayPal reimbursements
  - Loads category suggestions from `/api/inbox/suggest-categories`
  - Pre-fills splits with suggested categories when clicked
- Footer:
  - "Remaining Amount" badge (red if unbalanced, green if balanced)
  - Save button disabled until `remaining === 0`
  - Shows prompt "You have {x} left to assign" if unbalanced
- "Distribute Remainder" button for each split row
- Amount inputs in EUR (converts to cents internally)

**Form Validation:**
- Zero-sum constraint enforced
- Save button only enabled when balanced
- Real-time remaining amount calculation

### 4. PayPal Reimbursement Flow ✅

**Detection:**
- `InboxStream` identifies PayPal transactions with positive amounts
- Shows visual badge: "Reimbursement?" with alert icon

**Category Suggestions:**
- When drawer opens for PayPal reimbursement:
  - Calls `/api/inbox/suggest-categories?amountCents={amount}`
  - Finds recent expenses (last 30 days) with similar amounts (within 10% tolerance)
  - Groups by category and returns top matches
- "Use Suggestions" button pre-fills splits with suggested categories

**User Flow:**
1. User sees PayPal transaction with "Reimbursement?" badge
2. Swipes left or clicks to open SplitDrawer
3. Drawer shows suggested categories (if available)
4. User clicks "Use Suggestions" to auto-fill
5. User adjusts amounts as needed
6. Saves when remaining === 0

## Technical Details

### Database Schema

```sql
CREATE TABLE transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  memo TEXT,
  FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'inbox';
```

### API Contract

**Distribute Transaction:**
```typescript
POST /api/inbox/distribute
{
  transactionId: string | number,
  allocations: [
    { categoryId: string, amount: number } // amount in EUR
  ]
}
```

**Response:**
```typescript
{
  success: true,
  allocations: [
    {
      id: string,
      transactionId: string,
      categoryId: string,
      amountCents: number,
      memo: string | null
    }
  ]
}
```

### Zero-Sum Validation

The system enforces that:
```
sum(allocations.amount) === transaction.amountCents
```

This works for:
- **Negative transactions** (expenses): Split into multiple expense categories
- **Positive transactions** (income/reimbursements): Split into contra-expenses (negative allocations to expense categories)

## Files Created/Modified

### Backend
- ✅ `backend/src/db/migrations/00_init_splits.sql` (new)
- ✅ `backend/src/db.ts` (updated - added status column)
- ✅ `backend/src/services/transactionService.ts` (new)
- ✅ `backend/src/routes/inbox.ts` (new)
- ✅ `backend/src/server.ts` (updated - registered inbox router)

### Frontend
- ✅ `web/src/components/inbox/InboxStream.tsx` (new)
- ✅ `web/src/components/inbox/SplitDrawer.tsx` (enhanced)
- ✅ `web/src/components/inbox/InboxItem.tsx` (existing, used by InboxStream)

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Existing transactions default to 'inbox' status
- [ ] InboxStream loads and displays transactions
- [ ] Swipe right approves transaction
- [ ] Swipe left opens SplitDrawer
- [ ] SplitDrawer validates zero-sum constraint
- [ ] PayPal transactions show "Reimbursement?" badge
- [ ] Category suggestions load for PayPal reimbursements
- [ ] "Use Suggestions" pre-fills splits correctly
- [ ] Positive transactions can be split into negative allocations
- [ ] Transaction status updates to 'reviewed' after split/approve
- [ ] Empty inbox shows "Inbox Zero!" message

## Next Steps

1. **Virtualization:** Add `react-virtuoso` for large transaction lists (>100 items)
2. **Category Selector:** Replace text input with dropdown/autocomplete
3. **Batch Actions:** Allow approving/skipping multiple transactions
4. **Keyboard Shortcuts:** Add keyboard navigation for power users
5. **Analytics:** Track split patterns for ML-based suggestions

## Architecture Notes

- **"Splits-Only" Reporting:** Future analytics will SUM from `transaction_splits`, not parent table
- **Atomic Operations:** All split operations use database transactions
- **Backward Compatible:** Existing transactions auto-migrated to 'inbox' status
- **Type Safety:** Full TypeScript + Zod validation throughout
- **Performance:** Synchronous better-sqlite3 operations for sub-100ms feedback

