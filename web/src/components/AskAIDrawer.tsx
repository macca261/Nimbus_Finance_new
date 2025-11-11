import { useState } from 'react';

interface AskAIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AskAIDrawer({ isOpen, onClose }: AskAIDrawerProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data.response || data.message || 'No response received');
    } catch (err: any) {
      setResponse(`Error: ${err.message || 'Failed to get AI response'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-surface border-l border-default z-50 flex flex-col shadow-xl">
        <div className="p-4 border-b border-default flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ask AI</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {response && (
            <div className="mb-4 p-4 bg-secondary rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-default">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your finances..."
            className="w-full p-3 rounded-md bg-secondary border border-default text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            rows={4}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
}

