import { UploadCSV } from '../components/UploadCSV';

export default function Upload() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload your CSV</h1>
      <UploadCSV />
    </div>
  );
}


