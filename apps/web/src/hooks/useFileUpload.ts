// src/hooks/useFileUpload.ts
import { useState, useCallback } from 'react';
import { uploadFile } from '../services/storageService';
import { Attachment, UploadProgress } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface UseFileUploadReturn {
  uploads:     UploadProgress[];
  startUpload: (chatId: string, file: File) => Promise<Attachment | null>;
  clearUpload: (id: string) => void;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const startUpload = useCallback(async (chatId: string, file: File): Promise<Attachment | null> => {
    const id: string = uuidv4();
    setUploads((prev) => [...prev, { id, fileName: file.name, progress: 0, status: 'uploading' }]);

    try {
      const attachment = await uploadFile(chatId, file, (progress) => {
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, progress } : u)),
        );
      });
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'complete', url: attachment.url } : u)),
      );
      return attachment;
    } catch {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'error' } : u)),
      );
      return null;
    }
  }, []);

  const clearUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  return { uploads, startUpload, clearUpload };
};
