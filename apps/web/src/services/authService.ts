import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  User,
  UserCredential,
  AuthError,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AppUser } from '../types';
import { toAppUser } from './firestoreMappers';

const mapFirebaseUser = (user: User): AppUser => ({
  uid:         user.uid,
  email:       user.email ?? '',
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
  photoURL:    user.photoURL,
  phoneNumber: user.phoneNumber,
  createdAt:   Date.now(),
  lastSeen:    Date.now(),
  isOnline:    true,
});

const mapAuthError = (error: AuthError): string => {
  const codes: Record<string, string> = {
    'auth/user-not-found':         'Bu email bilan hisob topilmadi.',
    'auth/wrong-password':         'Noto\'g\'ri parol. Qayta urinib ko\'ring.',
    'auth/email-already-in-use':   'Bu email bilan hisob mavjud.',
    'auth/invalid-email':          'Email manzil noto\'g\'ri.',
    'auth/weak-password':          'Parol kamida 6 ta belgi bo\'lishi kerak.',
    'auth/too-many-requests':      'Ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
    'auth/network-request-failed': 'Tarmoq xatosi. Internetni tekshiring.',
    'auth/invalid-credential':     'Email yoki parol noto\'g\'ri.',
    'auth/popup-closed-by-user':   'Kirish oynasi yopildi.',
    'auth/invalid-verification-code': 'Tasdiqlash kodi noto\'g\'ri.',
    'auth/code-expired':           'Kod muddati tugagan. Qayta so\'rang.',
  };
  return codes[error.code] ?? 'Kutilmagan xato yuz berdi. Qayta urinib ko\'ring.';
};

// Ensures user document always exists in Firestore
const ensureUserDoc = async (user: User): Promise<AppUser> => {
  const ref     = doc(db, 'users', user.uid);
  const snap    = await getDoc(ref);
  if (snap.exists()) return toAppUser(snap.data());

  const appUser = mapFirebaseUser(user);
  await setDoc(ref, { ...appUser, createdAt: serverTimestamp() });
  return appUser;
};

export const signIn = async (email: string, password: string): Promise<AppUser> => {
  try {
    const cred: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    return await ensureUserDoc(cred.user);
  } catch (err) {
    throw new Error(mapAuthError(err as AuthError));
  }
};

export const signUp = async (
  email:       string,
  password:    string,
  displayName: string,
): Promise<AppUser> => {
  try {
    const cred: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const user: AppUser = {
      uid:         cred.user.uid,
      email:       cred.user.email ?? '',
      displayName,
      photoURL:    null,
      phoneNumber: null,
      createdAt:   Date.now(),
      lastSeen:    Date.now(),
      isOnline:    true,
    };
    await setDoc(doc(db, 'users', user.uid), { ...user, createdAt: serverTimestamp() });
    return user;
  } catch (err) {
    throw new Error(mapAuthError(err as AuthError));
  }
};

export const signInWithGoogle = async (): Promise<AppUser> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    const cred: UserCredential = await signInWithPopup(auth, provider);
    return await ensureUserDoc(cred.user);
  } catch (err) {
    throw new Error(mapAuthError(err as AuthError));
  }
};

let recaptchaVerifier: RecaptchaVerifier | null = null;

export const setupRecaptcha = (containerId: string): void => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
  });
};

export const sendPhoneOtp = async (phoneNumber: string): Promise<ConfirmationResult> => {
  try {
    if (!recaptchaVerifier) throw new Error('reCAPTCHA not initialized.');
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  } catch (err) {
    throw new Error(mapAuthError(err as AuthError));
  }
};

export const verifyPhoneOtp = async (
  confirmationResult: ConfirmationResult,
  otp: string,
): Promise<AppUser> => {
  try {
    const cred = await confirmationResult.confirm(otp);
    return await ensureUserDoc(cred.user);
  } catch (err) {
    throw new Error(mapAuthError(err as AuthError));
  }
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const onAuthChange = (callback: (user: AppUser | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) { callback(null); return; }
    try {
      callback(await ensureUserDoc(firebaseUser));
    } catch {
      callback(mapFirebaseUser(firebaseUser));
    }
  });
};
