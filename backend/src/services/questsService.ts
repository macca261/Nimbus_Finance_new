/**
 * Quest Service (v0)
 * 
 * Quest Engine for Nimbus Finance - turns dashboard "nudges" into data-driven quests.
 * 
 * **Design:**
 * - QuestDefinition: Template for quests (hardcoded in v0, can be DB-backed later)
 * - UserQuestState: Per-user progress tracking with computed metrics
 * - Progress is computed from existing metrics (transactions, categories, imports)
 * - Status transitions: LOCKED → ACTIVE → COMPLETED
 * 
 * **Extension Points (marked in comments):**
 * - AI-generated quest descriptions (future)
 * - Streak tracking (UserQuestState.streakCount)
 * - Difficulty levels / tiers (Bronze/Silver/Gold)
 * - Per-user quest selection based on AI Coach insights
 * 
 * **v0 Scope:**
 * - Hardcoded quest definitions (cleanup_sonstiges, import_more_data)
 * - Simple progress calculation from transaction/import metrics
 * - No AI calls (uses static copy)
 * - Idempotent state updates
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

export type QuestKind = 'CLEANUP' | 'IMPORT' | 'SPENDING' | 'OTHER';

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  kind: QuestKind;
  targetValue: number;
  unit: string; // e.g., "transactions", "percent", "months"
  isActive: boolean;
  configJson?: string; // Optional JSON for quest-specific parameters
}

export type QuestStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export interface UserQuestState {
  id: string; // Composite: "${userId}:${questId}"
  userId: string;
  questId: string;
  status: QuestStatus;
  currentValue: number;
  targetValue: number;
  progressPercent: number; // 0–100
  startedAt: string | null;
  completedAt: string | null;
  metadataJson?: string | null;
}

export interface QuestDto {
  id: string;
  title: string;
  description: string;
  kind: QuestKind;
  status: QuestStatus;
  currentValue: number;
  targetValue: number;
  progressPercent: number; // 0–100
  cta: {
    label: string; // e.g., "Los geht's"
    href: string; // e.g., "/review" or "/imports"
  };
}

/**
 * Get active quest definitions (hardcoded for v0).
 * 
 * **Future:** Can be moved to DB with admin UI for editing.
 * For now, these are defined in code and synced to DB on first use.
 */
export function getActiveQuestDefinitions(): QuestDefinition[] {
  return [
    {
      id: 'cleanup_sonstiges',
      title: 'Räume Sonstiges auf',
      description: 'Bringe deine "Sonstiges"-Buchungen in Ordnung.',
      kind: 'CLEANUP',
      targetValue: 0, // Target: 0 remaining Sonstiges transactions
      unit: 'transactions',
      isActive: true,
    },
    {
      id: 'import_more_data',
      title: 'Importiere mehr Daten',
      description: 'Importiere mehr Buchungen für bessere Analysen.',
      kind: 'IMPORT',
      targetValue: 3, // Target: at least 3 months of data
      unit: 'months',
      isActive: true,
    },
  ];
}

/**
 * Ensure quest definitions exist in DB (idempotent).
 * Called on service init to sync hardcoded definitions to DB.
 */
export function ensureQuestDefinitions(db: BetterSqliteDatabase): void {
  const definitions = getActiveQuestDefinitions();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO quest_definitions 
    (id, title, description, kind, targetValue, unit, isActive, configJson, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  for (const def of definitions) {
    insert.run(
      def.id,
      def.title,
      def.description,
      def.kind,
      def.targetValue,
      def.unit,
      def.isActive ? 1 : 0,
      def.configJson ?? null,
    );
  }
}

/**
 * Compute current value for a quest based on its kind.
 * 
 * **Extension point:** Add more quest kinds here as needed.
 */
function computeQuestCurrentValue(
  db: BetterSqliteDatabase,
  quest: QuestDefinition,
  userId: string = 'default',
): number {
  switch (quest.kind) {
    case 'CLEANUP': {
      // Count uncategorised / Sonstiges transactions (excluding internal transfers, cash withdrawals, reimbursements)
      const row = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM transactions
           WHERE (category IS NULL OR category = 'other' OR category = 'other_review')
             AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
             AND (isPassThrough = 0 OR isPassThrough IS NULL)
             AND (isCashWithdrawal = 0 OR isCashWithdrawal IS NULL)
             AND (isReimbursement = 0 OR isReimbursement IS NULL)
             AND amountCents < 0
           LIMIT 1000`,
        )
        .get() as { count: number } | undefined;
      return row?.count ?? 0;
    }

    case 'IMPORT': {
      // Count distinct months with transactions (simple heuristic for v0)
      // Get all unique year-month combinations from transactions
      const rows = db
        .prepare(
          `SELECT DISTINCT 
             strftime('%Y-%m', bookingDate) as month
           FROM transactions
           WHERE bookingDate IS NOT NULL AND bookingDate != ''
           ORDER BY month DESC
           LIMIT 12`,
        )
        .all() as Array<{ month: string }>;
      return rows.length;
    }

    default:
      return 0;
  }
}

/**
 * Compute progress percentage (0–100).
 * 
 * For cleanup_sonstiges: progress = 100 * (1 - remaining/initialBaseline)
 * If no baseline, treat as completed when remaining === 0.
 */
function computeProgressPercent(
  currentValue: number,
  targetValue: number,
  questId: string,
  existingState: UserQuestState | null,
): number {
  if (questId === 'cleanup_sonstiges') {
    // For cleanup, we want to reach 0 remaining
    // If we don't have a baseline, use current as baseline
    const baseline = existingState?.metadataJson
      ? (JSON.parse(existingState.metadataJson) as { initialBaseline?: number }).initialBaseline ?? currentValue
      : currentValue;

    if (baseline === 0) return 100; // Already clean
    if (currentValue === 0) return 100; // Completed
    return Math.max(0, Math.min(100, 100 * (1 - currentValue / baseline)));
  }

  // For other quests, use simple ratio
  if (targetValue === 0) return currentValue > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (currentValue / targetValue) * 100));
}

/**
 * Get or create user quest states for all active quest definitions.
 * Computes current progress and updates status.
 */
export function getUserQuestStates(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): UserQuestState[] {
  // Ensure quest definitions exist
  ensureQuestDefinitions(db);

  // Get all active quest definitions
  const definitions = db
    .prepare(`SELECT id, title, description, kind, targetValue, unit, isActive, configJson FROM quest_definitions WHERE isActive = 1`)
    .all() as Array<{
    id: string;
    title: string;
    description: string;
    kind: string;
    targetValue: number;
    unit: string;
    isActive: number;
    configJson: string | null;
  }>;

  const states: UserQuestState[] = [];

  for (const defRow of definitions) {
    const questId = defRow.id;
    const stateId = `${userId}:${questId}`;

    // Get existing state or create new
    let stateRow = db
      .prepare(`SELECT * FROM user_quest_states WHERE id = ?`)
      .get(stateId) as
      | {
          id: string;
          userId: string;
          questId: string;
          status: string;
          currentValue: number;
          targetValue: number;
          progressPercent: number;
          startedAt: string | null;
          completedAt: string | null;
          metadataJson: string | null;
        }
      | undefined;

    // Convert definition row to QuestDefinition
    const questDef: QuestDefinition = {
      id: defRow.id,
      title: defRow.title,
      description: defRow.description,
      kind: defRow.kind as QuestKind,
      targetValue: defRow.targetValue,
      unit: defRow.unit,
      isActive: defRow.isActive === 1,
      configJson: defRow.configJson ?? undefined,
    };

    // Compute current value
    const currentValue = computeQuestCurrentValue(db, questDef, userId);

    // Get existing state for baseline (if cleanup quest)
    const existingState: UserQuestState | null = stateRow
      ? {
          id: stateRow.id,
          userId: stateRow.userId,
          questId: stateRow.questId,
          status: stateRow.status as QuestStatus,
          currentValue: stateRow.currentValue,
          targetValue: stateRow.targetValue,
          progressPercent: stateRow.progressPercent,
          startedAt: stateRow.startedAt,
          completedAt: stateRow.completedAt,
          metadataJson: stateRow.metadataJson ?? undefined,
        }
      : null;

    // Compute progress
    const progressPercent = computeProgressPercent(currentValue, questDef.targetValue, questId, existingState);

    // Determine status
    let status: QuestStatus = existingState?.status ?? 'LOCKED';
    const now = new Date().toISOString();

    if (status === 'LOCKED' && progressPercent > 0) {
      status = 'ACTIVE';
    } else if (status === 'ACTIVE' && progressPercent >= 100) {
      status = 'COMPLETED';
    }

    // Update metadata for cleanup quest (store initial baseline)
    let metadataJson = existingState?.metadataJson ?? null;
    if (questId === 'cleanup_sonstiges' && !metadataJson && currentValue > 0) {
      metadataJson = JSON.stringify({ initialBaseline: currentValue });
    }

    // Upsert state
    if (stateRow) {
      // Update existing
      db.prepare(
        `UPDATE user_quest_states
         SET currentValue = ?,
             targetValue = ?,
             progressPercent = ?,
             status = ?,
             startedAt = COALESCE(startedAt, CASE WHEN ? = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE NULL END),
             completedAt = CASE WHEN ? = 'COMPLETED' AND completedAt IS NULL THEN CURRENT_TIMESTAMP ELSE completedAt END,
             metadataJson = ?,
             updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).run(
        currentValue,
        questDef.targetValue,
        progressPercent,
        status,
        status,
        status,
        metadataJson,
        stateId,
      );
    } else {
      // Insert new
      db.prepare(
        `INSERT INTO user_quest_states 
         (id, userId, questId, status, currentValue, targetValue, progressPercent, startedAt, completedAt, metadataJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        stateId,
        userId,
        questId,
        status,
        currentValue,
        questDef.targetValue,
        progressPercent,
        status === 'ACTIVE' || status === 'COMPLETED' ? now : null,
        status === 'COMPLETED' ? now : null,
        metadataJson,
      );
    }

    states.push({
      id: stateId,
      userId,
      questId,
      status,
      currentValue,
      targetValue: questDef.targetValue,
      progressPercent,
      startedAt: status === 'ACTIVE' || status === 'COMPLETED' ? now : null,
      completedAt: status === 'COMPLETED' ? now : null,
      metadataJson: metadataJson ?? undefined,
    });
  }

  return states;
}

/**
 * Get quests for user (combines definition + state into DTOs).
 * 
 * Returns only ACTIVE quests (hides COMPLETED for v0 to keep layout clean).
 * 
 * **Extension point:** Can show completed quests in a separate section later.
 */
export function getQuestsForUser(
  db: BetterSqliteDatabase,
  userId: string = 'default',
): QuestDto[] {
  const states = getUserQuestStates(db, userId);

  // Get quest definitions
  const definitions = db
    .prepare(`SELECT id, title, description, kind, targetValue, unit FROM quest_definitions WHERE isActive = 1`)
    .all() as Array<{
    id: string;
    title: string;
    description: string;
    kind: string;
    targetValue: number;
    unit: string;
  }>;

  const defMap = new Map(definitions.map(d => [d.id, d]));

  const quests: QuestDto[] = [];

  for (const state of states) {
    // Only return ACTIVE quests (hide COMPLETED for v0)
    if (state.status === 'COMPLETED') continue;

    const def = defMap.get(state.questId);
    if (!def) continue;

    // Determine CTA based on quest kind
    let cta: { label: string; href: string };
    switch (state.questId) {
      case 'cleanup_sonstiges':
        cta = { label: 'Los geht\'s', href: '/review' };
        break;
      case 'import_more_data':
        cta = { label: 'Importieren', href: '/imports' };
        break;
      default:
        cta = { label: 'Los geht\'s', href: '/' };
    }

    quests.push({
      id: state.questId,
      title: def.title,
      description: def.description,
      kind: def.kind as QuestKind,
      status: state.status,
      currentValue: state.currentValue,
      targetValue: state.targetValue,
      progressPercent: state.progressPercent,
      cta,
    });
  }

  // Sort: ACTIVE first, then by progress (descending)
  quests.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'ACTIVE') return -1;
      if (b.status === 'ACTIVE') return 1;
    }
    return b.progressPercent - a.progressPercent;
  });

  return quests;
}

