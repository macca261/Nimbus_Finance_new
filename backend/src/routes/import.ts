/**
 * CSV Import API Routes
 * 
 * Provides endpoints for uploading and importing CSV files from German banks.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { importBankCsv } from '../services/csvImportService';
import { listImports } from '../services/importsService';
import { db as defaultDb } from '../db';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure upload directory exists (do this synchronously at module load)
const uploadDir = path.join(__dirname, '../../tmp/uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('[import] Upload directory ready:', uploadDir);
  }
} catch (err: any) {
  console.error('[import] Failed to create upload directory:', err.message);
  // Continue anyway - multer will handle errors
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased for large CSV exports)
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files (be lenient with mime types - browsers may send different ones)
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV-Dateien sind erlaubt.'));
    }
  },
});

/**
 * Multer error handler middleware
 * Catches multer errors (file size, file type, etc.) and converts to JSON responses
 */
function handleMulterError(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'CSV_IMPORT_FAILED',
        message: 'Datei ist zu groß (max. 50MB).',
        details: err.message,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'CSV_IMPORT_FAILED',
        message: 'Bitte lade nur eine CSV-Datei hoch.',
        details: err.message,
      });
    }
    return res.status(400).json({
      error: 'CSV_IMPORT_FAILED',
      message: 'Fehler beim Upload.',
      details: err.message,
    });
  }
  
  if (err) {
    // File filter error or other multer-related error
    return res.status(400).json({
      error: 'CSV_IMPORT_FAILED',
      message: err.message || 'Fehler beim Upload.',
      details: 'Bitte prüfe die Datei und versuche es erneut.',
    });
  }
  
  next();
}

/**
 * Shared import handler for both /api/import and /api/import/csv
 */
async function handleImport(req: Request, res: Response) {
  // Log incoming request (dev only)
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[import] incoming request', {
      method: req.method,
      path: req.path,
      hasFile: !!req.file,
      fieldName: req.file?.fieldname,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      accountId: req.body?.accountId,
      contentType: req.headers['content-type'],
    });
  }

  try {
    if (!req.file) {
      // If no file and we got here, multer didn't process it (should be caught by error handler)
      // But handle gracefully anyway
      return res.status(400).json({
        error: 'CSV_IMPORT_FAILED',
        message: 'Keine Datei hochgeladen.',
        details: 'Bitte wähle eine CSV-Datei aus. Stelle sicher, dass das FormData-Feld "file" verwendet wird.',
      });
    }

    // Verify file exists on disk (multer should have created it)
    if (!fs.existsSync(req.file.path)) {
      console.error('[import] Uploaded file not found on disk:', req.file.path);
      return res.status(500).json({
        error: 'CSV_IMPORT_FAILED',
        message: 'Datei konnte nicht verarbeitet werden.',
        details: 'Die hochgeladene Datei wurde nicht gefunden.',
      });
    }

    const accountId = (req.body?.accountId as string) || 'default';
    const enableReconciliation = req.body?.enableReconciliation === 'true' || req.body?.enableReconciliation === true;

    // Get database instance from request (matches pattern used in other routes)
    const db = ((req.app as any)?.locals?.db) || undefined; // ImportService will use rawDb default if undefined

    // Import the file - wrap in try-catch to handle service errors
    let result;
    try {
      result = await importBankCsv(req.file.path, accountId, db, {
        enableReconciliation,
      });
    } catch (importError: any) {
      // Clean up uploaded file on error
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupErr) {
        // Ignore cleanup errors
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[import] Failed to cleanup file:', cleanupErr);
        }
      }

      // Log error with context
      console.error('[import] Import service error:', {
        error: importError?.message || String(importError),
        stack: importError?.stack,
        fileName: req.file.originalname,
        filePath: req.file.path,
      });

      return res.status(500).json({
        error: 'CSV_IMPORT_FAILED',
        message: 'Konnte die CSV nicht importieren.',
        details: importError?.message || 'Unbekannter Fehler beim Importieren der Datei.',
      });
    }

    // Clean up uploaded file after successful import
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors - file will be cleaned up by system later
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[import] Failed to cleanup file after import:', cleanupErr);
      }
    }

    if (result.success) {
      // Return response in format expected by frontend with improved structure
      const response = {
        success: true,
        strategy: result.strategy,
        imported: result.imported,
        inserted: result.imported, // Alias for frontend compatibility
        insertedCount: result.imported, // Primary field name
        skipped: result.skipped,
        duplicateCount: result.skipped, // Alias for frontend compatibility
        skippedCount: result.skipped, // Alias for frontend compatibility
        pairedTransactions: result.pairedTransactions || 0,
        potentialInternalTransfers: result.potentialInternalTransfers || 0,
        errors: result.errors,
        reason: result.reason || null, // Reason code for import result
        message: result.imported > 0
          ? `${result.imported} Transaktion${result.imported !== 1 ? 'en' : ''} importiert.`
          : result.reason === 'all_duplicates'
          ? 'Keine neuen Transaktionen – alle Buchungen waren bereits vorhanden.'
          : 'Keine neuen Transaktionen importiert.',
      };

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[import] import complete', {
          strategy: result.strategy,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
          reason: result.reason,
        });
      }

      return res.json(response);
    } else {
      if (process.env.NODE_ENV !== 'production' && result.reason === 'unsupported_format') {
        // eslint-disable-next-line no-console
        console.warn('[importCsv] detection failed', {
          header: result.header,
          detectionScores: result.detectionScores,
        });
      }
      // Failed import
      return res.status(400).json({
        error: 'CSV_IMPORT_FAILED',
        message: result.reason === 'parse_error'
          ? 'Die CSV konnte nicht vollständig gelesen werden. Bitte prüfe Format und Trennzeichen.'
          : result.reason === 'unsupported_format'
          ? 'Das Format der CSV-Datei wird nicht unterstützt.'
          : 'Import fehlgeschlagen.',
        details: result.errors.join(' '),
        errors: result.errors,
        reason: result.reason || null,
        insertedCount: 0,
        duplicateCount: 0,
        skippedCount: 0,
      });
    }
  } catch (err: any) {
    // Clean up uploaded file on unexpected error
    try {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    console.error('[import] Unexpected error:', {
      error: err?.message || String(err),
      stack: err?.stack,
      fileName: req.file?.originalname,
    });
    
    return res.status(500).json({
      error: 'CSV_IMPORT_FAILED',
      message: 'Konnte die CSV nicht importieren.',
      details: err?.message || 'Unbekannter Fehler beim Importieren der Datei.',
    });
  }
}

/**
 * POST /api/import
 * 
 * Main import endpoint (frontend calls this)
 * 
 * Body (multipart/form-data):
 * - file: CSV file
 * - accountId: Account ID to associate transactions with (optional)
 * - enableReconciliation: Optional boolean to enable PayPal reconciliation
 */
router.post('/', upload.single('file'), handleMulterError, handleImport);

/**
 * POST /api/import/csv
 * 
 * Alternative endpoint (for compatibility)
 */
router.post('/csv', upload.single('file'), handleMulterError, handleImport);

function resolveDb(req: Request) {
  return ((req.app as any)?.locals?.db) ?? defaultDb;
}

function parseLimit(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(typeof raw === 'string' ? raw : '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 100);
  }
  return 50;
}

/**
 * GET /api/import/history
 *
 * Returns recent import history entries backed by the imports table.
 */
router.get('/history', (req, res) => {
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitParsed = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;
    const imports = listImports(limit, resolveDb(req));
    const items = imports.map(item => ({
      id: item.id,
      fileName: item.filename,
      importedAt: item.createdAt,
      profileId: 'csv',
      confidence: 1,
      rowsImported: item.rowCount,
      warnings: item.warnings,
      status: item.status,
      batchId: null,
    }));
    return res.json({ items });
  } catch (err) {
    console.error('[import] history error', err);
    return res.status(500).json({ error: 'Failed to load import history' });
  }
});

export { router as importRouter };
export default router;
