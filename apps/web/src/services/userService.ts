import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { AppUser } from '../types';
import { toAppUser } from './firestoreMappers';

export const searchUsers = async (searchTerm: string, currentUid: string): Promise<AppUser[]> => {
  const term = searchTerm.trim().toLowerCase();
  if (term.length < 1) return [];
  try {
    // Fetch all users and filter client-side (works well for small-medium apps)
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map((d) => toAppUser(d.data()))
      .filter(
        (u) =>
          u.uid !== currentUid &&
          (u.displayName?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term)),
      )
      .slice(0, 30);
  } catch (err) {
    console.error('[searchUsers]', err);
    return [];
  }
};

export const getUsersByIds = async (uids: string[]): Promise<AppUser[]> => {
  if (uids.length === 0) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    const uidSet = new Set(uids);
    return snap.docs
      .map((d) => toAppUser(d.data()))
      .filter((u) => uidSet.has(u.uid));
  } catch (err) {
    console.error('[getUsersByIds]', err);
    return [];
  }
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<Pick<AppUser, 'displayName' | 'photoURL'>>,
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, updates);
  }
};
