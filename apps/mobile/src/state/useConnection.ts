import { useEffect, useState } from 'react';
import { useSession } from './SessionProvider';

/** Uzilish shu vaqtdan uzoq davom etsagina ko'rsatiladi (ishga tushishda miltillamasin). */
export const CONNECTION_GRACE_MS = 1_500;

export type ConnectionStatus = 'online' | 'connecting';

/** Real vaqt ulanishi (Socket.IO) holati. */
export const useConnection = (): ConnectionStatus => {
  const { services: { socket } } = useSession();
  const [status, setStatus] = useState<ConnectionStatus>('online');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (connected: boolean) => {
      clearTimeout(timer);
      if (connected) setStatus('online');
      else timer = setTimeout(() => setStatus('connecting'), CONNECTION_GRACE_MS);
    };
    apply(socket.isConnected());
    const off = socket.onConnectionChange(apply);
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [socket]);

  return status;
};
