import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ColumnMapWizard from '../components/ColumnMapWizard';
import { api } from '../lib/api';

type ImportResult =
  | { needsMapping: true; headers: string[]; sample: string[][] }
  | { new: number; updated: number; duplicates: number; errors: number };

export default function UploadCSVPage() {
  const [needsMapping, setNeedsMapping] = useState<null | { headers: string[]; sample: string[][] }>(null);
  const [summary, setSummary] = useState<null | { new: number; updated: number; duplicates: number; errors: number }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    setError(null); setSummary(null); setNeedsMapping(null);
    if (!accepted.length) return;
    const file = accepted[0];
    const form = new FormData();
    form.append('file', file);
    try {
      setLoading(true);
      const { data } = await api.post<ImportResult>('/imports/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if ((data as any).needsMapping) setNeedsMapping(data as any);
      else setSummary(data as any);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  const sampleRows = useMemo(() => needsMapping?.sample || [], [needsMapping]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Upload CSV</h1>
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${isDragActive ? 'border-primary-500 bg-primary-300/10' : 'border-gray-300 hover:border-primary-400'}`}>
        <input {...getInputProps()} />
        <p className="text-lg">Drag & drop your CSV here, or click to select</p>
        <p className="text-sm text-gray-500 mt-1">We auto-detect your bank and map columns.</p>
      </div>
      {loading && <p className="mt-4 text-sm">Processing…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {needsMapping && (
        <div className="mt-6">
          <h3 className="font-medium mb-2">Unknown format detected. Help us map your columns.</h3>
          <ColumnMapWizard headers={needsMapping.headers} sampleRows={sampleRows} />
        </div>
      )}

      {summary && (
        <div className="mt-6 border rounded p-4">
          <h3 className="font-semibold mb-2">Import Summary</h3>
          <ul className="text-sm space-y-1">
            <li><strong>New</strong>: {summary.new}</li>
            <li><strong>Updated</strong>: {summary.updated}</li>
            <li><strong>Duplicates</strong>: {summary.duplicates}</li>
            <li><strong>Errors</strong>: {summary.errors}</li>
          </ul>
        </div>
      )}
    </div>
  );
}


