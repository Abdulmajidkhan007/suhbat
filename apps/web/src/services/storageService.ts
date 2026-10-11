// src/services/storageService.ts — Storage disabled (not enabled in Firebase Console)
import { Attachment } from '../types';

export const uploadFile = (
  _chatId: string,
  _file: File,
  _onProgress: (progress: number) => void,
): Promise<Attachment> => {
  return Promise.reject(new Error('Firebase Storage is not enabled.'));
};
