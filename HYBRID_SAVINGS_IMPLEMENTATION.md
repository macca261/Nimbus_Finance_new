# Hybrid Savings System Implementation Summary

## Overview

This document summarizes the implementation of the **Nimbus Finanz Hybrid Savings Ecosystem** as specified in the architectural blueprint. The system unifies virtual envelopes (Soft Savings) and external asset accumulation (Hard Savings) into a single, gamified savings experience.

## Completed Components

### 1. Database Schema ✅

**Location:** `backend/src/db.ts`, `backend/prisma/schema.prisma`

**Changes:**
- Added `is_external_savings` column to `transactions` table
- Added `nature` column to `accounts` table (BUDGET/TRACKING distinction)
- Created `buckets` table for virtual envelopes
- Created `bucket_movements` table for soft savings ledger
- Created `gamification_log` table for City Builder events
- Added gamification fields to `Goal` model (buildingHealth, buildingLevel, buildingSkin, lastContributionTs)
- Created `view_hybrid_goal_status` SQL view for unified progress calculation

### 2. Transaction Categorization Engine (TCE) ✅

**Location:** `backend/src/services/transactionCategorizationEngine.ts`

**Features:**
- Detects German neobrokers (Trade Republic, Scalable Capital, Flatex, Comdirect, Baader Bank)
- Identifies savings plans (Sparplan, Wertpapierkauf, ETF-Kauf)
- Recognizes robo-advisors (Liqid, Quirion, Ginmon)
- Detects high-yield savings (Tagesgeld, Festgeld)
- Integrated into transaction insertion flow in `backend/src/db.ts`

### 3. Auto-Link Service ✅

**Location:** `backend/src/services/externalSavingsAutoLink.ts`

**Features:**
- Automatically creates tracking accounts for detected external savings
- Links transactions to tracking accounts
- Retroactively updates similar past transfers
- Extracts account names from transaction payee/memo

### 4. Health Decay Calculator ✅

**Location:** `backend/src/services/gamificationHealthDecay.ts`

**Features:**
- Calculates goal health based on contribution activity
- Implements decay mechanic: -1 HP per week after 30 days of inactivity
- Instant repair (100% health) on any contribution
- Logs gamification events (CONSTRUCT, DECAY, REPAIR)

### 5. API Endpoints ✅

**Locations:**
- `backend/src/routes/buckets.ts` - Buckets (virtual envelopes) CRUD
- `backend/src/routes/goals.ts` - Enhanced with gamification support

**Endpoints:**
- `GET /api/buckets` - List all buckets
- `GET /api/buckets/:id` - Get bucket details
- `POST /api/buckets` - Create bucket
- `PATCH /api/buckets/:id` - Update bucket
- `POST /api/buckets/:id/movements` - Create bucket movement (allocate funds)
- `DELETE /api/buckets/:id` - Delete bucket

### 6. Frontend Components ✅

**Locations:**
- `web/src/components/goals/HybridProgressBar.tsx` - Visualizes virtual vs external savings
- `web/src/components/goals/SidebarSavingsGoals.tsx` - Sidebar goals display with drag-drop zones
- `web/src/api/buckets.ts` - Buckets API client
- `web/src/hooks/useBuckets.ts` - React hook for buckets

**Features:**
- Hybrid progress bar showing solid (external) vs striped (virtual) savings
- Sidebar integration showing active savings goals
- Health indicators and building levels
- Drop zones for transaction allocation (basic implementation)

## Pending/Incomplete Components

### 1. Full Drag-and-Drop Implementation

**Status:** Partially implemented

**Needed:**
- Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (added to package.json, needs `npm install`)
- Make transaction rows draggable
- Complete drop handler in `SidebarSavingsGoals.tsx`
- Create allocation modal/dialog for partial amounts
- Connect to bucket movements API

**Files to Update:**
- `web/src/pages/Transactions.tsx` - Add draggable wrapper to transaction rows
- `web/src/components/goals/SidebarSavingsGoals.tsx` - Complete drop handler

### 2. City Builder Visualization

**Status:** Not implemented

**Needed:**
- Design isometric SVG assets for building types
- Create `CityViewport` component for sidebar
- Implement building level visualization based on goal progress
- Add health decay visual indicators (scaffolding, weathering)
- Create "Supply Drop" system for dividend detection

**Suggested Location:** `web/src/components/gamification/CityViewport.tsx`

### 3. Hybrid Goal Status API

**Status:** Schema created, API not implemented

**Needed:**
- Create endpoint to query `view_hybrid_goal_status`
- Return virtual + external balance breakdown
- Update `SidebarSavingsGoals.tsx` to fetch and display hybrid status

**Suggested Location:** `backend/src/routes/goals.ts` - Add `GET /api/goals/:id/hybrid-status`

### 4. Health Decay Background Job

**Status:** Service created, not scheduled

**Needed:**
- Create cron job or scheduled task to run `updateGoalHealth()` daily
- Consider using `node-cron` or similar
- Log health updates for debugging

**Suggested Location:** `backend/src/jobs/gamificationHealthDecay.ts`

### 5. Transaction-to-Goal Allocation Flow

**Status:** Basic structure in place

**Needed:**
- Complete drag-drop handler to call bucket movements API
- Create allocation dialog component
- Handle partial allocation (user specifies amount)
- Update goal progress after allocation
- Trigger gamification events (CONSTRUCT)

**Files to Create:**
- `web/src/components/goals/AllocationDialog.tsx`

## Testing Checklist

- [ ] Test TCE detection with real German bank transaction strings
- [ ] Verify auto-link creates tracking accounts correctly
- [ ] Test health decay calculation with various inactivity periods
- [ ] Verify bucket movements update bucket balances
- [ ] Test hybrid progress bar with various virtual/external combinations
- [ ] Test drag-and-drop transaction allocation
- [ ] Verify gamification events are logged correctly

## Next Steps

1. **Install dependencies:**
   ```bash
   cd web
   npm install
   ```

2. **Run database migrations:**
   ```bash
   cd backend
   npm run migrate  # If migration script exists
   # Or the schema will auto-migrate on first run
   ```

3. **Test TCE with sample transactions:**
   - Import CSV with Trade Republic transaction
   - Verify `is_external_savings` flag is set
   - Check that tracking account is created

4. **Complete drag-and-drop:**
   - Install dnd-kit packages
   - Implement draggable transaction rows
   - Complete drop handler

5. **Build City Builder visualization:**
   - Design building assets
   - Create CityViewport component
   - Integrate into sidebar

## Architecture Notes

- **Dual Database Approach:** The system uses both Prisma (for Goals) and better-sqlite3 (for transactions, buckets). This is intentional for performance and flexibility.
- **Location-Agnostic Goals:** Goals can link to both virtual buckets and external tracking accounts simultaneously.
- **Behavioral Economics:** The decay mechanic leverages Loss Aversion to drive consistent engagement.
- **German Market Focus:** TCE patterns are specifically tuned for German banking terminology and neobroker names.

## References

- Original Blueprint: See user query for full architectural specification
- Key Concepts:
  - **Soft Savings:** Virtual envelopes (buckets) within checking account
  - **Hard Savings:** Physical transfers to external accounts (Trade Republic, etc.)
  - **Hybrid Savings:** Unified view combining both types
  - **Location-Agnostic:** Goal progress independent of where money is stored

