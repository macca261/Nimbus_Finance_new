/**
 * Transactions table component
 */

import { useState, useMemo } from 'react';
import { Search, DollarSign, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Transaction, Category, ALL_CATEGORIES } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/format';
import { CATEGORY_COLORS } from '@/lib/mockData';

interface TransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function Transactions({ transactions, isLoading = false }: TransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((tx) => tx.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (tx) =>
          tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [transactions, searchTerm, selectedCategory]);

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl border border-default shadow-lg animate-pulse">
        <div className="p-6 border-b border-default">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-64 rounded bg-muted" />
            <div className="h-10 w-32 rounded bg-muted" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-default shadow-lg">
      <div className="p-6 border-b border-default">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <Link
            to="/import"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            Import CSV
          </Link>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-default bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Search transactions"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Category | 'all')}
            className="px-4 py-2 rounded-lg border border-default bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted">
            <DollarSign size={48} className="mb-4 text-primary opacity-50" />
            <p className="text-sm font-medium mb-2">No transactions found</p>
            <p className="text-xs mb-4">Try adjusting your filters or</p>
            <Link
              to="/import"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              <Upload size={16} />
              Import a CSV file
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted">Date</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted">Description</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted">Category</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-muted">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium">{formatDate(tx.date)}</td>
                  <td className="px-6 py-4 text-sm">{tx.description}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[tx.category]}20`,
                        color: CATEGORY_COLORS[tx.category],
                      }}
                    >
                      {tx.category}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-sm text-right font-semibold tabular-nums ${
                      tx.type === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

