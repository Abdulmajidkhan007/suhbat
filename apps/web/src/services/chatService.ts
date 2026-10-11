import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Unsubscribe,
  getDocs,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { Chat, AppUser, ChatParticipant } from '../types';
import { toChat } from './firestoreMappers';

export const subscribeToChats = (
  userId:   string,
  callback: (chats: Chat[]) => void,
  onError:  (error: Error) => void,
): Unsubscribe => {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toChat(d.id, d.data({ serverTimestamps: 'estimate' })))),
    onError,
  );
};

const toParticipant = (u: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>): ChatParticipant => ({
  uid:         u.uid,
  displayName: u.displayName,
  photoURL:    u.photoURL,
  isOnline:    false,
  lastSeen:    Date.now(),
});

export const createDirectChat = async (
  currentUser: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>,
  otherUser:   Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>,
): Promise<string> => {
  const q    = query(collection(db, 'chats'), where('type', '==', 'direct'), where('participants', 'array-contains', currentUser.uid));
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => (d.data() as Chat).participants.includes(otherUser.uid));
  if (existing) return existing.id;

  const data: Omit<Chat, 'id'> = {
    name:    otherUser.displayName,
    type:    'direct',
    photoURL: otherUser.photoURL,
    participants: [currentUser.uid, otherUser.uid],
    participantDetails: {
      [currentUser.uid]: toParticipant(currentUser),
      [otherUser.uid]:   toParticipant(otherUser),
    },
    lastMessage:  null,
    unreadCount:  0,
    createdAt:    Date.now(),
    updatedAt:    Date.now(),
    typingUsers:  {},
  };
  const ref = await addDoc(collection(db, 'chats'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const createGroupChat = async (
  creator:     Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>,
  members:     Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>[],
  groupName:   string,
  description?: string,
): Promise<string> => {
  const all          = [creator, ...members];
  const participantIds = all.map((u) => u.uid);
  const details: Record<string, ChatParticipant> = {};
  all.forEach((u) => {
    details[u.uid] = { ...toParticipant(u), role: u.uid === creator.uid ? 'owner' : 'member' };
  });

  const data: Omit<Chat, 'id'> = {
    name:    groupName,
    type:    'group',
    photoURL: null,
    description: description ?? '',
    participants: participantIds,
    admins:  [creator.uid],
    ownerId: creator.uid,
    participantDetails: details,
    lastMessage:   null,
    unreadCount:   0,
    memberCount:   all.length,
    createdAt:     Date.now(),
    updatedAt:     Date.now(),
    typingUsers:   {},
  };
  const ref = await addDoc(collection(db, 'chats'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const createChannel = async (
  owner:       Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>,
  channelName: string,
  description?: string,
  isPublic = true,
): Promise<string> => {
  const data: Omit<Chat, 'id'> = {
    name:    channelName,
    type:    'channel',
    photoURL: null,
    description: description ?? '',
    isPublic,
    participants: [owner.uid],
    admins:  [owner.uid],
    ownerId: owner.uid,
    participantDetails: {
      [owner.uid]: { ...toParticipant(owner), role: 'owner' },
    },
    lastMessage:  null,
    unreadCount:  0,
    memberCount:  1,
    createdAt:    Date.now(),
    updatedAt:    Date.now(),
    typingUsers:  {},
  };
  const ref = await addDoc(collection(db, 'chats'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const joinChannel = async (
  chatId: string,
  user:   Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>,
): Promise<void> => {
  await updateDoc(doc(db, 'chats', chatId), {
    participants: arrayUnion(user.uid),
    [`participantDetails.${user.uid}`]: toParticipant(user),
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const addMembersToGroup = async (
  chatId:     string,
  newMembers: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'>[],
): Promise<void> => {
  if (newMembers.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    participants: arrayUnion(...newMembers.map((u) => u.uid)),
    memberCount:  increment(newMembers.length),
    updatedAt:    serverTimestamp(),
  };
  newMembers.forEach((u) => {
    updates[`participantDetails.${u.uid}`] = { ...toParticipant(u), role: 'member' };
  });
  await updateDoc(doc(db, 'chats', chatId), updates);
};

export const setTypingStatus = async (
  chatId:   string,
  userId:   string,
  isTyping: boolean,
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'chats', chatId), { [`typingUsers.${userId}`]: isTyping });
  } catch {
    // "yozmoqda" holati muhim emas — xato jim o'tkaziladi
  }
};
