import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Database } from '../db';
import { db, getTransactionById, getTransactionByPublicId } from '../db';
import { getAiConfig, isAiCategorizationEnabled } from '../config/ai';
import { getAiCategorySuggestion } from '../services/aiCategoryService';
import { listCategories } from '../categorization/categoryRegistry';
import { isEligibleForAiSuggestion } from '../services/aiCategoryEligibility';
import type { NormalizedTransaction } from '../types/transactions';
import type { Transaction } from '../types/core';

const aiCategoryRouter = Router();

// Simple in-memory rate limiter (per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const config = getAiConfig();
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Reset or create entry
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= config.maxSuggestionsPerHour) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Convert Transaction to NormalizedTransaction for AI processing.
 */
function transactionToNormalized(tx: Transaction): NormalizedTransaction {
  // Get purpose from memo or raw
  let purpose = tx.memo || '';
  if (!purpose && tx.raw && typeof tx.raw === 'object') {
    purpose = (tx.raw.purpose as string) || (tx.raw.memo as string) || '';
  }

  return {
    id: tx.id,
    bookingDate: tx.bookingDate,
    valutaDate: tx.valueDate,
    amountCents: tx.amountCents,
    currency: tx.currency || 'EUR',
    direction: tx.amountCents >= 0 ? 'in' : 'out',
    accountId: tx.accountId || 'unknown',
    rawText: purpose,
    bankProfile: tx.sourceProfile || 'bank',
    category: (tx.categoryId as any) || 'other',
    categoryConfidence: tx.confidence || 0,
    categorySource: 'fallback',
    counterparty: tx.counterparty || null,
    payee: tx.payee || null,
    memo: tx.memo || null,
    source: tx.source || 'manual',
    sourceProfile: tx.sourceProfile || null,
  };
}

/**
 * Get transaction by ID (supports both publicId and numeric ID).
 */
function getTransactionByIdOrPublicId(transactionId: string, db: Database): Transaction | null {
  // Try publicId first
  let transaction = getTransactionByPublicId(transactionId, db);

  if (!transaction) {
    // Try numeric ID
    const numericId = Number.parseInt(transactionId, 10);
    if (Number.isFinite(numericId) && numericId > 0) {
      const row = getTransactionById(numericId, db);
      if (row) {
        // Convert row to Transaction format
        transaction = {
          id: String(row.id),
          source: 'manual',
          sourceProfile: null,
          accountId: 'unknown',
          bookingDate: row.bookingDate,
          valueDate: row.valueDate || undefined,
          amountCents: row.amountCents,
          currency: row.currency || 'EUR',
          payee: null,
          counterparty: row.counterpartName,
          memo: row.purpose,
          categoryId: row.category,
          confidence: row.categoryConfidence || undefined,
          externalId: null,
          referenceId: null,
          isTransfer: false,
          transferLinkId: null,
          isRefund: false,
          isRefunded: false,
          refundGroupId: null,
          isInternalTransfer: false,
          internalTransferDirection: null,
          internalTransferKind: null,
          internalTransferGroupId: null,
          isReimbursement: false,
          reimbursementRole: null,
          reimbursementGroupId: null,
          reimbursementShareRatio: null,
          bankReferenceId: null,
          raw: undefined,
        };
      }
    }
  }

  return transaction;
}

/**
 * Log why a transaction was skipped for AI categorization.
 * Only logs in development or when NODE_ENV is not production.
 */
function logSkipReason(
  transactionId: string,
  reason: 'ai_disabled' | 'rate_limited' | 'transaction_not_found' | 'already_categorised' | 'internal_transfer' | 'low_amount' | 'other' | 'pass_through' | 'cash_withdrawal' | 'reimbursement' | 'missing_fields' | 'zero_amount',
  details?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === 'production') {
    return; // Skip logging in production
  }
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    transactionId,
    reason,
    ...details,
  };
  
  console.log('[aiCategory] SKIP:', JSON.stringify(logEntry));
}

/**
 * POST /api/ai/category-suggestion
 * Get an AI category suggestion for a transaction.
 */
aiCategoryRouter.post('/category-suggestion', async (req: Request, res: Response) => {
  const { transactionId } = req.body;
  
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[aiCategory] POST /category-suggestion hit', { transactionId });
    }
    
    // Check if AI is enabled
    const config = getAiConfig();
    
    if (!isAiCategorizationEnabled()) {
      logSkipReason(transactionId, 'ai_disabled', {
        hasApiKey: !!config.apiKey,
        enabled: config.enabled,
      });
      return res.status(503).json({
        suggestion: null,
        disabled: true,
        message: 'AI categorization is disabled',
      });
    }

    if (!transactionId || typeof transactionId !== 'string') {
      return res.status(400).json({
        error: 'transactionId is required',
      });
    }

    // Rate limiting (per IP)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      logSkipReason(transactionId, 'rate_limited', {
        clientIp,
        maxPerHour: config.maxSuggestionsPerHour,
      });
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
      });
    }

    // Get transaction
    const transaction = getTransactionByIdOrPublicId(transactionId, db);

    if (!transaction) {
      logSkipReason(transactionId, 'transaction_not_found');
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    // Check eligibility using centralized helper
    const eligibility = isEligibleForAiSuggestion(transaction);
    
    if (!eligibility.eligible) {
      logSkipReason(transactionId, eligibility.reason as any, eligibility.details);
      return res.status(200).json({
        suggestion: null,
        message: `Transaction not eligible: ${eligibility.reason}`,
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[aiCategory] Processing transaction:', {
        id: transaction.id,
        bookingDate: transaction.bookingDate,
        amountCents: transaction.amountCents,
        category: transaction.categoryId,
        confidence: transaction.confidence || 0,
      });
    }

    // Convert to NormalizedTransaction
    const normalizedTx = transactionToNormalized(transaction);

    // Get categories
    const categories = listCategories();
    const categoryOptions = categories.map(cat => ({
      id: cat.id,
      label: cat.labelDe,
      parentId: cat.parentId || null,
    }));

    // Get AI suggestion
    const suggestion = await getAiCategorySuggestion(normalizedTx, categoryOptions, {
      locale: 'de-DE',
    });

    if (!suggestion) {
      logSkipReason(transactionId, 'other', {
        message: 'AI service returned null',
      });
      return res.status(200).json({
        suggestion: null,
        message: 'Could not generate suggestion',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[aiCategory] Suggestion generated:', {
        transactionId,
        categoryId: suggestion.categoryId,
        confidence: suggestion.confidence,
      });
    }

    return res.status(200).json({
      suggestion,
    });
  } catch (error: any) {
    console.error('[aiCategory] Error in category-suggestion:', error);
    console.error('[aiCategory] Error stack:', error?.stack);
    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Failed to get category suggestion',
    });
  }
});

/**
 * POST /api/ai/category-suggestions/batch
 * Get AI category suggestions for multiple transactions in a single request.
 * Processes transactions in batches and respects rate limits.
 */
aiCategoryRouter.post('/category-suggestions/batch', async (req: Request, res: Response) => {
  const { transactionIds } = req.body;

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[aiCategory] POST /category-suggestions/batch hit', {
        count: transactionIds?.length || 0,
      });
    }

    // Check if AI is enabled
    const config = getAiConfig();

    if (!isAiCategorizationEnabled()) {
      return res.status(503).json({
        suggestions: [],
        skippedIds: transactionIds || [],
        rateLimited: false,
        disabled: true,
        message: 'AI categorization is disabled',
      });
    }

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        error: 'transactionIds must be a non-empty array',
      });
    }

    // Rate limiting (per IP)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitOk = checkRateLimit(clientIp);

    if (!rateLimitOk) {
      return res.status(200).json({
        suggestions: [],
        skippedIds: transactionIds,
        rateLimited: true,
        message: 'Rate limit exceeded. Please try again later.',
      });
    }

    // Limit batch size to prevent abuse (max 100 at a time)
    const maxBatchSize = 100;
    const idsToProcess = transactionIds.slice(0, maxBatchSize);

    // Get categories once (shared across all transactions)
    const categories = listCategories();
    const categoryOptions = categories.map(cat => ({
      id: cat.id,
      label: cat.labelDe,
      parentId: cat.parentId || null,
    }));

    // Process transactions
    const suggestions: Array<{
      transactionId: string;
      suggestedCategoryId: string | null;
      confidence: number | null;
      explanation?: string;
    }> = [];
    const skippedIds: string[] = [];

    // Process in smaller chunks to avoid overwhelming the AI API
    const chunkSize = 10; // Process 10 at a time
    for (let i = 0; i < idsToProcess.length; i += chunkSize) {
      const chunk = idsToProcess.slice(i, i + chunkSize);
      
      // Process chunk in parallel
      const chunkResults = await Promise.allSettled(
        chunk.map(async (transactionId: string) => {
          // Get transaction
          const transaction = getTransactionByIdOrPublicId(transactionId, db);

          if (!transaction) {
            skippedIds.push(transactionId);
            return null;
          }

          // Check eligibility
          const eligibility = isEligibleForAiSuggestion(transaction);
          if (!eligibility.eligible) {
            if (process.env.NODE_ENV !== 'production') {
              logSkipReason(transactionId, eligibility.reason as any, eligibility.details);
            }
            skippedIds.push(transactionId);
            return null;
          }

          // Convert to NormalizedTransaction
          const normalizedTx = transactionToNormalized(transaction);

          // Get AI suggestion
          const suggestion = await getAiCategorySuggestion(normalizedTx, categoryOptions, {
            locale: 'de-DE',
          });

          if (!suggestion) {
            skippedIds.push(transactionId);
            return null;
          }

          return {
            transactionId,
            suggestedCategoryId: suggestion.categoryId,
            confidence: suggestion.confidence,
            explanation: suggestion.reasoning,
          };
        }),
      );

      // Collect results
      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value) {
          suggestions.push(result.value);
        }
      }

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < idsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[aiCategory] Batch suggestions completed:', {
        requested: transactionIds.length,
        processed: idsToProcess.length,
        suggestions: suggestions.length,
        skipped: skippedIds.length,
      });
    }

    return res.status(200).json({
      suggestions,
      skippedIds,
      rateLimited: false,
    });
  } catch (error: any) {
    console.error('[aiCategory] Error in category-suggestions/batch:', error);
    console.error('[aiCategory] Error stack:', error?.stack);
    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Failed to get batch suggestions',
      suggestions: [],
      skippedIds: transactionIds || [],
    });
  }
});

/**
 * POST /api/ai/category-feedback
 * Log feedback about an AI category suggestion (accepted or rejected).
 */
aiCategoryRouter.post('/category-feedback', async (req: Request, res: Response) => {
  try {
    const { transactionId, suggestedCategoryId, accepted } = req.body;

    if (!transactionId || !suggestedCategoryId || typeof accepted !== 'boolean') {
      return res.status(400).json({
        error: 'transactionId, suggestedCategoryId, and accepted are required',
      });
    }

    // For now, just log the feedback
    // In the future, this could be stored in a database table for analytics
    console.log('[aiCategory] Feedback:', {
      transactionId,
      suggestedCategoryId,
      accepted,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback recorded',
    });
  } catch (error: any) {
    console.error('[aiCategory] Error in category-feedback:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Failed to record feedback',
    });
  }
});

export default aiCategoryRouter;
