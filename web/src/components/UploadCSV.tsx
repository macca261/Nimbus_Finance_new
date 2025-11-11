import React from 'react';
import { CsvUploadArea, type CsvUploadAreaProps } from './upload/CsvUploadArea';

/**
 * @deprecated Use CsvUploadArea directly. This wrapper keeps backward compatibility.
 */
export const UploadCSV: React.FC<CsvUploadAreaProps> = props => (
  <CsvUploadArea variant="compact" {...props} />
);
