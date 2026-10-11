// src/features/auth/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as authService from '../../services/authService';
import { AuthState, AppUser } from '../../types';

const initialState: AuthState = {
  user:        null,
  loading:     false,
  error:       null,
  initialized: false,
};

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authService.signIn(email, password);
    } catch (err) {
      return rejectWithValue((err as Error).message);
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
      return await authService.signUp(email, password, displayName);
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  },
);

export const signInWithGoogle = createAsyncThunk(
  'auth/signInWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      return await authService.signInWithGoogle();
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  },
);

export const signOut = createAsyncThunk('auth/signOut', async (_, { rejectWithValue }) => {
  try {
    await authService.signOut();
  } catch (err) {
    return rejectWithValue((err as Error).message);
  }
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
    setInitialized(state) {
      state.initialized = true;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
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
      .addCase(signInWithGoogle.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(signInWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
        state.error   = null;
      })
      .addCase(signInWithGoogle.rejected,  (state, action) => {
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

export const { setUser, setInitialized, clearError } = authSlice.actions;
export default authSlice.reducer;
