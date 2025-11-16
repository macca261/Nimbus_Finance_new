/**
 * Repository for loading category rules from the database.
 * 
 * This is a hook point for future UI/API integration.
 * 
 * Note: This requires Prisma to be set up. To use this:
 * 1. Install Prisma: npm install @prisma/client
 * 2. Generate Prisma client: npx prisma generate
 * 3. Uncomment the implementation below
 */

import type { CategoryRule, CategoryRuleConditions } from './types';

/**
 * Load enabled user rules from the database.
 * 
 * This function should use Prisma to query the CategoryRule table
 * and return rules that are enabled, ordered by score descending.
 * 
 * @returns Array of enabled user rules
 */
export async function loadUserRules(): Promise<CategoryRule[]> {
  // TODO: Uncomment when Prisma is set up
  /*
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  
  try {
    const records = await prisma.categoryRule.findMany({
      where: { 
        enabled: true,
        source: 'user',
      },
      orderBy: { score: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      source: r.source === 'system' ? 'system' : 'user',
      enabled: r.enabled,
      score: r.score,
      setCategory: r.setCategory,
      when: (r.whenJson ?? {}) as CategoryRuleConditions,
    }));
  } finally {
    await prisma.$disconnect();
  }
  */
  
  // Placeholder: return empty array until Prisma is set up
  return [];
}

/**
 * Load enabled merchant patterns from the database.
 * 
 * @returns Array of enabled merchant patterns
 */
export async function loadMerchantPatterns(): Promise<Array<{
  id: string;
  source: 'system' | 'user';
  pattern: string;
  normalized: string;
  category?: string;
  score: number;
  exact?: boolean;
}>> {
  // TODO: Uncomment when Prisma is set up
  /*
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  
  try {
    const records = await prisma.merchantPattern.findMany({
      where: { 
        // Add enabled field if needed
      },
      orderBy: { score: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      source: r.source === 'system' ? 'system' : 'user',
      pattern: r.pattern,
      normalized: r.normalized,
      category: r.categoryId ?? undefined,
      score: r.score,
      exact: r.exact,
    }));
  } finally {
    await prisma.$disconnect();
  }
  */
  
  // Placeholder: return empty array until Prisma is set up
  return [];
}

