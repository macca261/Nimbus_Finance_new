type Props = {
  method: 'rule' | 'ml' | 'ai';
  confidence: number;
  reason?: string;
};

export default function ExplainChip({ method, confidence, reason }: Props) {
  const color = method === 'rule' ? 'bg-green-100 text-green-800' : method === 'ml' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  const label = method.toUpperCase();
  const pct = Math.round(confidence * 100);
  return (
    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs ${color}`} title={reason || ''}>
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{pct}%</span>
      {reason && <span className="truncate max-w-[200px]">{reason}</span>}
    </span>
  );
}


