import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/cn';
import { STORAGE_KEYS } from '@/lib/api';
import { startOfflineWatcher } from '@/lib/offline';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.sidebar) === 'true',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebar, String(collapsed));
  }, [collapsed]);

  // Sincroniza a fila offline assim que a conexão volta.
  useEffect(
    () =>
      startOfflineWatcher(({ sent, failed }) => {
        if (sent) {
          toast.success(
            `${sent} operação(ões) sincronizadas`,
            'Os dados salvos offline foram enviados ao servidor.',
          );
          void queryClient.invalidateQueries();
        }
        if (failed) {
          toast.error(
            `${failed} operação(ões) não puderam ser sincronizadas`,
            'Confira o estoque — elas foram descartadas da fila.',
          );
        }
      }),
    [toast, queryClient],
  );

  return (
    <div className="min-h-full">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-400 dark:border-navy-800">
          Controle Rafa Multimarcas · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
