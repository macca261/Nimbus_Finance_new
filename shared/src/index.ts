export type UserSummary = {
  id: string;
  email: string;
};

export type CsvUploadSummary = {
  filename: string;
  sizeBytes: number;
  numRows: number;
  headers: string[];
};

export type Category =
  | 'Groceries'
  | 'Shopping'
  | 'Dining'
  | 'Transportation'
  | 'Subscriptions'
  | 'Housing'
  | 'Utilities'
  | 'Income'
  | 'Health'
  | 'Entertainment'
  | 'Other';

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  category: Category;
  confidence: number;
};


