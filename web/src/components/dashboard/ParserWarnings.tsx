type ParserWarningsProps = {
  warnings: string[];
};

export function ParserWarnings({ warnings }: ParserWarningsProps) {
  if (!warnings.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
      <p className="font-semibold">Parser-Hinweise</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning, index) => (
          <li key={index}>• {warning}</li>
        ))}
      </ul>
    </div>
  );
}


