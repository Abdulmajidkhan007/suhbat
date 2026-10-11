// src/services/messageService.ts
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';
import { toMessage } from './firestoreMappers';

export const subscribeToMessages = (
  chatId: string,
  callback: (messages: Message[]) => void,
  onError: (error: Error) => void,
  messageLimit = 50,
): Unsubscribe => {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(messageLimit),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((d) =>
        toMessage(d.id, d.data({ serverTimestamps: 'estimate' })),
      );
      callback(messages);
    },
    onError,
  );
};

export const sendMessage = async (
  message: Omit<Message, 'id' | 'isOptimistic'>,
): Promise<string> => {
  const ref = await addDoc(
    collection(db, 'chats', message.chatId, 'messages'),
    { ...message, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
  );
  // Update chat's lastMessage
  await updateDoc(doc(db, 'chats', message.chatId), {
    lastMessage: {
      content:   message.content,
      senderId:  message.senderId,
      createdAt: Date.now(),
    },
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateMessageStatus = async (
  chatId:    string,
  messageId: string,
  status:    'sent' | 'delivered' | 'read',
): Promise<void> => {
  await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { status });
};
