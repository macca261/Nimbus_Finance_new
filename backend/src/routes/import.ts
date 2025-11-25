/**
 * CSV Import API Routes
 * 
 * Provides endpoints for uploading and importing CSV files from German banks.
 */

import { Router } from 'express';
import multer from 'multer';
import { importService } from '../services/ImportService';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../tmp/uploads'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../tmp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * POST /api/import/csv
 * 
 * Upload and import a CSV file.
 * 
 * Body (multipart/form-data):
 * - file: CSV file
 * - accountId: Account ID to associate transactions with
 * - enableReconciliation: Optional boolean to enable PayPal reconciliation
 */
router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = req.body.accountId || 'default';
    const enableReconciliation = req.body.enableReconciliation === 'true' || req.body.enableReconciliation === true;

    // Import the file
    const result = await importService.importFile(req.file.path, accountId, undefined, {
      enableReconciliation,
    });

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      // Ignore cleanup errors
    }

    if (result.success) {
      res.json({
        success: true,
        strategy: result.strategy,
        imported: result.imported,
        skipped: result.skipped,
        pairedTransactions: result.pairedTransactions || 0,
        potentialInternalTransfers: result.potentialInternalTransfers || 0,
        errors: result.errors,
      });
    } else {
      res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }
  } catch (err: any) {
    console.error('[import] POST /api/import/csv error:', err);
    res.status(500).json({ error: err?.message || 'Failed to import CSV file' });
  }
});

export { router as importRouter };
export default router;
