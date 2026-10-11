// src/hooks/useMessages.ts
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  setMessages,
  setMessagesLoading,
  setMessagesError,
  appendOptimisticMessage,
  removeOptimisticMessage,
} from '../features/messages/messagesSlice';
import { subscribeToMessages, sendMessage as sendFirebaseMessage } from '../services/messageService';
import { setTypingStatus } from '../services/chatService';
import { Message } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const useMessages = (chatId: string | null) => {
  const dispatch  = useAppDispatch();
  const user      = useAppSelector((s) => s.auth.user);
  const messages  = useAppSelector((s) =>
    chatId ? (s.messages.messagesByChatId[chatId] ?? []) : [],
  );
  const loading   = useAppSelector((s) =>
    chatId ? (s.messages.loadingByChatId[chatId] ?? true) : false,
  );
  const error     = useAppSelector((s) =>
    chatId ? (s.messages.errorByChatId[chatId] ?? null) : null,
  );
  const unsubRef  = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!chatId) return;

    dispatch(setMessagesLoading({ chatId, loading: true }));

    unsubRef.current?.();
    unsubRef.current = subscribeToMessages(
      chatId,
      (msgs) => dispatch(setMessages({ chatId, messages: msgs })),
      (err)  => dispatch(setMessagesError({ chatId, error: err.message })),
    );

    return () => {
      unsubRef.current?.();
    };
  }, [chatId, dispatch]);

  const sendMessage = async (content: string, type: Message['type'] = 'text') => {
    if (!chatId || !user || !content.trim()) return;

    const tempId: string = `optimistic-${uuidv4()}`;
    const optimistic: Message = {
      id:           tempId,
      chatId,
      senderId:     user.uid,
      senderName:   user.displayName,
      senderPhoto:  user.photoURL,
      content,
      type,
      status:       'sending',
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
      isOptimistic: true,
    };

    dispatch(appendOptimisticMessage(optimistic));

    try {
      await sendFirebaseMessage({
        chatId,
        senderId:    user.uid,
        senderName:  user.displayName,
        senderPhoto: user.photoURL,
        content,
        type,
        status:      'sent',
        createdAt:   Date.now(),
        updatedAt:   Date.now(),
      });
      dispatch(removeOptimisticMessage({ chatId, tempId }));
    } catch {
      dispatch(removeOptimisticMessage({ chatId, tempId }));
    }
  };

  const setTyping = async (isTyping: boolean) => {
    if (!chatId || !user) return;
    await setTypingStatus(chatId, user.uid, isTyping);
  };

  return { messages, loading, error, sendMessage, setTyping };
};
