// src/features/auth/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ApiError } from '@suhbat/client';
import { api } from '../../services/api';
import { toAppUser } from '../../services/apiMappers';
import { AuthState, AppUser } from '../../types';

const initialState: AuthState = {
  user:        null,
  loading:     false,
  error:       null,
  initialized: false,
};

const messageOf = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Email yoki parol noto\'g\'ri.';
    if (err.status === 409) return 'Bu email bilan hisob mavjud.';
    if (err.status === 400) return 'Ma\'lumotlar noto\'g\'ri. Parol kamida 8 ta belgi.';
    return err.message;
  }
  return 'Kutilmagan xato yuz berdi. Qayta urinib ko\'ring.';
};

/** Ilova ochilganda: saqlangan token bo'lsa — `/auth/me`. */
export const restoreSession = createAsyncThunk('auth/restore', async (): Promise<AppUser | null> => {
  if (!(await api.hasSession())) return null;
  try {
    return toAppUser(await api.me());
  } catch {
    // 401 bo'lsa tokenlar `@suhbat/client` tomonidan o'chirilgan; tarmoq xatosida
    // tokenlar saqlanib qoladi, foydalanuvchi qayta kirish sahifasini ko'radi.
    return null;
  }
});

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return toAppUser(await api.login({ email, password }));
    } catch (err) {
      return rejectWithValue(messageOf(err));
    }
  },
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (
    { email, password, displayName }: { email: string; password: string; displayName: string },
    { rejectWithValue },
  ) => {
    try {
      return toAppUser(await api.register({ email, password, displayName }));
    } catch (err) {
      return rejectWithValue(messageOf(err));
    }
  },
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await api.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AppUser | null>) {
      state.user        = action.payload;
      state.initialized = true;
      state.loading     = false;
      state.error       = null;
    },
    /** Profil tahrirlangach (`PATCH /users/me` javobi) joriy foydalanuvchini yangilaydi. */
    userUpdated(state, action: PayloadAction<AppUser>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
    setInitialized(state) {
      state.initialized = true;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user        = action.payload;
        state.initialized = true;
      })
      .addCase(signIn.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
        state.error   = null;
      })
      .addCase(signIn.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      })
      .addCase(signUp.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
        state.error   = null;
      })
      .addCase(signUp.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user    = null;
        state.loading = false;
        state.error   = null;
      });
  },
});

export const { setUser, userUpdated, setInitialized, clearError } = authSlice.actions;
export default authSlice.reducer;
