import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ 
    status: "OK", 
    message: "Nimbus Finance Backend Running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Mock transactions endpoint
app.get("/api/transactions", (req, res) => {
  const { limit = "10" } = req.query as { limit?: string };
  const transactions = [
    {
      id: "1",
      bookingDate: "2024-01-15",
      amount: -15.67,
      currency: "EUR",
      purpose: "REWE SAGT DANKE",
      category: "Groceries",
      counterpartName: "REWE",
      type: "card"
    },
    {
      id: "2",
      bookingDate: "2024-01-14", 
      amount: 3200.00,
      currency: "EUR",
      purpose: "Salary",
      category: "Income",
      counterpartName: "Employer GmbH",
      type: "transfer"
    },
    {
      id: "3",
      bookingDate: "2024-01-13",
      amount: -12.99,
      currency: "EUR",
      purpose: "Netflix Subscription",
      category: "Entertainment",
      counterpartName: "Netflix",
      type: "direct_debit"
    }
  ];
  
  const result = transactions.slice(0, parseInt(limit as string));
  res.json(result);
});

// Mock categories breakdown endpoint
app.get("/api/categories/breakdown", (_req, res) => {
  res.json([
    { category: "Groceries", amount: -450.00, count: 12, color: "#10B981" },
    { category: "Transport", amount: -120.50, count: 8, color: "#3B82F6" },
    { category: "Entertainment", amount: -85.30, count: 5, color: "#8B5CF6" },
    { category: "Income", amount: 3200.00, count: 2, color: "#059669" }
  ]);
});

// Mock balance endpoint
app.get("/api/summary/balance", (_req, res) => {
  res.json({
    currentBalance: 45230.50,
    availableBalance: 44800.00,
    currency: "EUR",
    lastUpdated: new Date().toISOString()
  });
});

// CSV upload endpoint
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/imports/csv", upload.single("file"), (req, res) => {
  try {
    console.log("📬 CSV upload received! File:", req.file?.originalname);
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Mock successful import
    const result = {
      new: 3,
      updated: 0,
      duplicates: 0,
      errors: 0,
      adapterId: "mock_sparkasse",
      message: "Successfully imported 3 transactions from CSV"
    };

    console.log("✅ Mock CSV import successful");
    res.json(result);

  } catch (error) {
    console.error("❌ CSV upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 NIMBUS FINANCE BACKEND RUNNING!");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`📊 API Base: http://localhost:${PORT}/api`);
  console.log(`💾 Using MOCK DATA - No database required`);
});

export default app;


