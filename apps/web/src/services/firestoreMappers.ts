// Firestore hujjatlarini ilova tiplariga keltirish.
// `serverTimestamp()` bilan yozilgan maydonlar o'qilganda `Timestamp` obyekti
// bo'lib keladi (raqam emas) — UI va Redux esa millisekund kutadi.
import { DocumentData } from 'firebase/firestore';
import { toMillis } from '@suhbat/core';
import { AppUser, Chat, ChatParticipant, Message } from '../types';

const ms = (value: unknown, fallback = Date.now()): number => toMillis(value) ?? fallback;

export const toAppUser = (data: DocumentData): AppUser => ({
  ...(data as AppUser),
  createdAt: ms(data.createdAt),
  lastSeen:  ms(data.lastSeen),
});

export const toMessage = (id: string, data: DocumentData): Message => ({
  ...(data as Omit<Message, 'id'>),
  id,
  createdAt: ms(data.createdAt),
  updatedAt: ms(data.updatedAt),
});

export const toChat = (id: string, data: DocumentData): Chat => {
  const details: Record<string, ChatParticipant> = {};
  for (const [uid, p] of Object.entries((data.participantDetails ?? {}) as Record<string, DocumentData>)) {
    details[uid] = { ...(p as ChatParticipant), lastSeen: ms(p.lastSeen) };
  }
  return {
    ...(data as Omit<Chat, 'id'>),
    id,
    participantDetails: details,
    lastMessage: data.lastMessage
      ? { ...data.lastMessage, createdAt: ms(data.lastMessage.createdAt) }
      : null,
    createdAt: ms(data.createdAt),
    updatedAt: ms(data.updatedAt),
  };
};
