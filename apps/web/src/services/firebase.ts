import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const env = import.meta.env as unknown as Record<string, string | undefined>;
const missing = requiredVars.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(
    '[Firebase] Missing environment variables:',
    missing.join(', '),
    '\nPlease set them in Netlify → Site settings → Environment variables, then redeploy.',
  );
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth      = getAuth(app);
export const db: Firestore   = getFirestore(app);

// RTDB is optional — only initialize if databaseURL is provided
let _rtdb: Database | null = null;
try {
  if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
    _rtdb = getDatabase(app);
  }
} catch (e) {
  console.warn('[Firebase] Realtime Database not available:', e);
}
export const rtdb = _rtdb;

export default app;
