import { useState, useCallback } from 'react';
import type { UploadPrefix } from '../lib/s3';

interface UploadResult {
  key: string;
  url: string;
}

interface UseS3UploadReturn {
  upload: (file: File, prefix: UploadPrefix) => Promise<UploadResult>;
  uploadBase64: (base64: string, fileName: string, prefix: UploadPrefix) => Promise<UploadResult>;
  isUploading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useS3Upload(): UseS3UploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const uploadBase64 = useCallback(
    async (base64Data: string, fileName: string, prefix: UploadPrefix): Promise<UploadResult> => {
      setIsUploading(true);
      setError(null);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            prefix,
            fileName,
            contentType: getContentType(fileName),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || 'Erro desconhecido no upload';
          setError(errorMsg);
          throw new Error(errorMsg);
        }

        return { key: data.key, url: data.url };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao fazer upload';
        if (!error) setError(message);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [error]
  );

  const upload = useCallback(
    async (file: File, prefix: UploadPrefix): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const result = await uploadBase64(base64, file.name, prefix);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => {
          const msg = 'Erro ao ler arquivo';
          setError(msg);
          reject(new Error(msg));
        };
        reader.readAsDataURL(file);
      });
    },
    [uploadBase64]
  );

  return { upload, uploadBase64, isUploading, error, clearError };
}

function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  };
  return map[ext] || 'application/octet-stream';
}
