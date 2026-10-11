// WebSocket voqealari va REST yuklashlarini store'ga ulaydigan thunk'lar.
import type {
  WsChatDeleted,
  WsChatMember,
  WsChatUpdated,
  WsMessageDeleted,
  WsMessageNew,
  WsMessageUpdated,
  WsPresenceState,
  WsPresenceUpdate,
  WsReadEvent,
} from '@suhbat/core';
import { toMillis } from '@suhbat/core';
import type { AppDispatch, RootState } from '../../app/store';
import { api, socket } from '../../services/api';
import { toChat, toMessage, toParticipant } from '../../services/apiMappers';
import {
  chatMemberChanged,
  chatMessageReceived,
  chatUpdated,
  lastMessageEdited,
  memberRead,
  removeChat,
  setChats,
  setChatsError,
  setChatsLoading,
  upsertChat,
} from '../chats/chatsSlice';
import { clearMessages, messageDeleted, messageReceived, messageUpdated } from '../messages/messagesSlice';
import { setPresence, updateUserPresence } from '../presence/presenceSlice';

type Thunk<R = void> = (dispatch: AppDispatch, getState: () => RootState) => R;

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

export const fetchChats = (): Thunk<Promise<void>> => async (dispatch, getState) => {
  const me = getState().auth.user?.uid;
  if (!me) return;
  if (getState().chats.chats.length === 0) dispatch(setChatsLoading(true));
  try {
    const chats = await api.listChats();
    dispatch(setChats(chats.map((c) => toChat(c, me))));
  } catch (e) {
    dispatch(setChatsError((e as Error).message || 'Suhbatlarni yuklab bo\'lmadi'));
  }
};

/** Bitta chatni (masalan yangi 1:1) serverdan olib ro'yxatga qo'shadi. */
export const fetchChat = (chatId: string): Thunk<Promise<void>> => async (dispatch, getState) => {
  const me = getState().auth.user?.uid;
  if (!me) return;
  try {
    dispatch(upsertChat(toChat(await api.getChat(chatId), me)));
  } catch {
    // a'zo bo'lmasa yoki tarmoq xatosi — ro'yxat keyingi yuklashda tuzaladi
  }
};

/** Ochiq chatdagi oxirgi begona xabargacha o'qildi deb belgilaydi. */
export const markChatRead = (chatId: string): Thunk<Promise<void>> => async (dispatch, getState) => {
  const state = getState();
  const me = state.auth.user?.uid;
  const chat = state.chats.chats.find((c) => c.id === chatId);
  const messages = state.messages.messagesByChatId[chatId] ?? [];
  if (!me || !chat || !isVisible() || !socket.isConnected()) return;
  const latest = [...messages].reverse().find((m) => !m.isOptimistic && m.senderId !== me);
  const myReadAt = chat.participantDetails[me]?.lastReadAt ?? null;
  if (!latest || (myReadAt !== null && myReadAt >= latest.createdAt)) return;
  try {
    const { lastReadAt } = await socket.markRead(chatId, latest.id);
    dispatch(memberRead({ chatId, userId: me, lastReadAt: toMillis(lastReadAt) ?? latest.createdAt, currentUid: me }));
  } catch {
    // keyingi xabar yoki fokusda qayta urinadi
  }
};

export const onMessageNew = (e: WsMessageNew): Thunk => (dispatch, getState) => {
  const state = getState();
  const me = state.auth.user?.uid;
  if (!me) return;
  const chat = state.chats.chats.find((c) => c.id === e.message.chatId);
  if (!chat) {
    void dispatch(fetchChat(e.message.chatId));
    return;
  }
  const message = toMessage(e.message, chat);
  const isActive = state.chats.activeChatId === chat.id;
  dispatch(messageReceived({ message, clientId: e.clientId }));
  dispatch(chatMessageReceived({ message, currentUid: me, countUnread: !(isActive && isVisible()) }));
  if (isActive && message.senderId !== me) void dispatch(markChatRead(chat.id));
};

export const onRead = (e: WsReadEvent): Thunk => (dispatch, getState) => {
  const me = getState().auth.user?.uid;
  const at = toMillis(e.lastReadAt);
  if (!me || at === null) return;
  dispatch(memberRead({ chatId: e.chatId, userId: e.userId, lastReadAt: at, currentUid: me }));
};

export const onPresenceState = (e: WsPresenceState): Thunk => (dispatch) => {
  dispatch(setPresence(Object.fromEntries(e.online.map((id) => [id, true]))));
};

export const onPresenceUpdate = (e: WsPresenceUpdate): Thunk => (dispatch) => {
  dispatch(updateUserPresence({ uid: e.userId, isOnline: e.online }));
};

export const onMessageUpdated = (e: WsMessageUpdated): Thunk => (dispatch, getState) => {
  const chat = getState().chats.chats.find((c) => c.id === e.message.chatId);
  if (!chat) return;
  const message = toMessage(e.message, chat);
  dispatch(messageUpdated(message));
  dispatch(lastMessageEdited({
    chatId: chat.id, senderId: message.senderId, createdAt: message.createdAt, content: message.content,
  }));
};

/** Oxirgi xabar yoki o'qilmagan son o'zgargan bo'lishi mumkin — chat qayta yuklanadi. */
export const onMessageDeleted = (e: WsMessageDeleted): Thunk => (dispatch) => {
  dispatch(messageDeleted({ chatId: e.chatId, messageId: e.messageId }));
  void dispatch(fetchChat(e.chatId));
};

export const onChatUpdated = (e: WsChatUpdated): Thunk => (dispatch) => {
  dispatch(chatUpdated({
    chatId: e.chatId, title: e.title, description: e.description, isPublic: e.isPublic,
    updatedAt: toMillis(e.updatedAt) ?? Date.now(),
  }));
};

export const onChatMember = (e: WsChatMember): Thunk => (dispatch, getState) => {
  const me = getState().auth.user?.uid;
  if (!me) return;
  const known = getState().chats.chats.some((c) => c.id === e.chatId);
  // Meni qo'shishdi (yoki obuna bo'ldim) — chatni to'liq yuklab olamiz.
  if (e.action !== 'removed' && e.userId === me && !known) {
    void dispatch(fetchChat(e.chatId));
    return;
  }
  dispatch(chatMemberChanged({
    chatId: e.chatId, userId: e.userId, action: e.action,
    participant: e.member ? toParticipant(e.member) : null, memberCount: e.memberCount, currentUid: me,
  }));
};

export const onChatDeleted = (e: WsChatDeleted): Thunk => (dispatch) => {
  dispatch(removeChat(e.chatId));
  dispatch(clearMessages(e.chatId));
};
