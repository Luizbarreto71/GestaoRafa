import { getQueue, subscribeQueue, type QueuedRequest } from '@/lib/offline';
import { useEffect, useState } from 'react';

/** Estado da conexão + tamanho da fila offline. */
export function useOnlineStatus(): { online: boolean; queue: QueuedRequest[] } {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queue, setQueue] = useState<QueuedRequest[]>(getQueue);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = subscribeQueue(setQueue);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, []);

  return { online, queue };
}
