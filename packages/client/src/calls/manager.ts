import type { CallMedia, ServerToClientEvents } from '@suhbat/core';
import { CallSession } from './session.js';
import type { CallSignal } from './session.js';
import type { CallPeer, CallSessionDeps, CallState } from './types.js';

/** Socket voqealariga obuna (`createSocketClient().on` mos keladi). */
export interface CallEventSource {
  on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): () => void;
}

export interface CallManagerOptions<S> extends CallSessionDeps<S> {
  events:         CallEventSource;
  /** Tugagan qo'ng'iroq ekrani shuncha vaqt ko'rinib turadi, keyin yopiladi (standart 1500 ms). */
  endedLingerMs?: number;
}

export type CallManager<S> = ReturnType<typeof createCallManager<S>>;

/**
 * Ilova bo'yicha bitta: joriy qo'ng'iroq sessiyasini saqlaydi, `call:*` socket voqealarini
 * unga yo'naltiradi, kiruvchi qo'ng'iroqda yangi sessiya ochadi. UI `subscribe` orqali
 * joriy holatni (yoki `null`) oladi.
 */
export const createCallManager = <S>(opts: CallManagerOptions<S>) => {
  const linger = opts.endedLingerMs ?? 1500;
  const listeners = new Set<(state: CallState<S> | null) => void>();
  let current: CallSession<S> | null = null;
  let offSession: (() => void) | null = null;
  let lingerTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    const state = current?.getState() ?? null;
    listeners.forEach((l) => l(state));
  };

  const clear = () => {
    if (lingerTimer) clearTimeout(lingerTimer);
    lingerTimer = null;
    offSession?.();
    offSession = null;
    current = null;
    emit();
  };

  const attach = (session: CallSession<S>) => {
    if (current) clear();
    current = session;
    offSession = session.subscribe((state) => {
      emit();
      if (state.phase === 'ended' && !lingerTimer) {
        lingerTimer = setTimeout(() => {
          if (current === session) clear();
        }, linger);
      }
    });
    emit();
  };

  const busy = () => current?.isActive === true;
  const route = (signal: CallSignal) => {
    void current?.handleSignal(signal);
  };

  const offs = [
    opts.events.on('call:invite', (invite) => {
      // Shu qo'ng'iroq allaqachon ko'rsatilgan (qayta ulanishda qayta keldi) yoki boshqasida bandmiz.
      if (busy()) return;
      const session = new CallSession<S>(opts);
      attach(session);
      session.receive(invite);
    }),
    opts.events.on('call:ringing', ({ callId }) => route({ type: 'ringing', callId })),
    opts.events.on('call:accept', ({ callId }) => route({ type: 'accept', callId })),
    opts.events.on('call:busy', ({ callId }) => route({ type: 'busy', callId })),
    opts.events.on('call:end', ({ callId, reason }) => route({ type: 'end', callId, reason })),
    opts.events.on('call:offer', ({ callId, description }) => route({ type: 'offer', callId, description })),
    opts.events.on('call:answer', ({ callId, description }) => route({ type: 'answer', callId, description })),
    opts.events.on('call:ice', ({ callId, candidate }) => route({ type: 'ice', callId, candidate })),
  ];

  return {
    getState: (): CallState<S> | null => current?.getState() ?? null,
    get session(): CallSession<S> | null {
      return current;
    },

    subscribe(listener: (state: CallState<S> | null) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Chiquvchi qo'ng'iroq. Boshqa qo'ng'iroq davom etayotgan bo'lsa — xato. */
    async startCall(input: { chatId: string; peer: CallPeer; media: CallMedia }): Promise<void> {
      if (busy()) throw new Error('Siz allaqachon qo\'ng\'iroqdasiz');
      const session = new CallSession<S>(opts);
      attach(session);
      await session.start(input);
    },

    accept: () => current?.accept() ?? Promise.resolve(),
    reject: () => current?.reject(),
    hangup: () => current?.hangup(),
    setMuted: (muted: boolean) => current?.setMuted(muted),
    setCameraOff: (off: boolean) => current?.setCameraOff(off),
    switchCamera: () => current?.switchCamera() ?? Promise.resolve(),
    get canSwitchCamera(): boolean {
      return current?.canSwitchCamera ?? false;
    },

    /** Tugagan qo'ng'iroq ekranini darhol yopish. */
    dismiss(): void {
      if (current && !current.isActive) clear();
    },

    /** Chiqishda (logout): joriy qo'ng'iroq tugatiladi, obunalar bekor. */
    dispose(): void {
      current?.hangup();
      offs.forEach((off) => off());
      clear();
      listeners.clear();
    },
  };
};
