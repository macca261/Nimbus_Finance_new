import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../lib/api';

type Summary = {
  filename: string;
  sizeBytes: number;
  numRows: number;
  headers: string[];
};

export default function CSVUploader() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setSummary(null);
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    const form = new FormData();
    form.append('file', file);
    try {
      setLoading(true);
      const { data } = await api.post('/imports/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSummary(data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${isDragActive ? 'border-primary-500 bg-primary-300/10' : 'border-gray-300 hover:border-primary-400'}`}
      >
        <input {...getInputProps()} />
        <p className="text-lg">Drag & drop your bank CSV here, or click to select</p>
        <p className="text-sm text-gray-500 mt-1">We’ll instantly analyze the file and show a quick summary.</p>
      </div>

      {loading && <p className="mt-4 text-sm">Analyzing your CSV…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {summary && (
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Upload Summary</h3>
          <ul className="text-sm space-y-1">
            <li><strong>File</strong>: {summary.filename}</li>
            <li><strong>Size</strong>: {(summary.sizeBytes / 1024).toFixed(1)} KB</li>
            <li><strong>Rows</strong>: {summary.numRows}</li>
            <li><strong>Headers</strong>: {summary.headers.join(', ') || '–'}</li>
          </ul>
        </div>
      )}
    </div>
  );
}


