// WebSocket voqealari va REST yuklashlarini store'ga ulaydigan thunk'lar.
import type { WsMessageNew, WsPresenceState, WsPresenceUpdate, WsReadEvent } from '@suhbat/core';
import { toMillis } from '@suhbat/core';
import type { AppDispatch, RootState } from '../../app/store';
import { api, socket } from '../../services/api';
import { toChat, toMessage } from '../../services/apiMappers';
import { chatMessageReceived, memberRead, setChats, setChatsError, setChatsLoading, upsertChat } from '../chats/chatsSlice';
import { messageReceived } from '../messages/messagesSlice';
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
