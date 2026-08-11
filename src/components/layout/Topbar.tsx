import { useAlerts, useMarcarLida, useNotificacoes } from '@/hooks/queries';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';
import { formatCurrency, formatRelative } from '@/lib/format';
import {
  AlertTriangle,
  Bell,
  CloudOff,
  Menu,
  MessageSquare,
  Moon,
  PackageX,
  RefreshCw,
  Sun,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { UnitSelector } from './UnitSelector';
import { useUnit } from '@/contexts/UnitContext';

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { online, queue } = useOnlineStatus();
  const { unidadeId } = useUnit();
  const { data: alerts } = useAlerts(true, unidadeId);
  const [showAlerts, setShowAlerts] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!alertRef.current?.contains(event.target as Node)) setShowAlerts(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const alertCount = (alerts?.lowStock.length ?? 0) + (alerts?.outOfStock.length ?? 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-navy-700 dark:bg-navy-900/90">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <UnitSelector />

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5">
        {/* Valor do estoque em tempo real */}
        {alerts && (
          <div className="mr-1 hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-navy-800 xl:flex">
            <Wallet className="h-4 w-4 text-success" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Estoque</p>
              <p className="text-xs font-bold text-navy-900 dark:text-slate-100">
                {formatCurrency(alerts.stockValue)}
              </p>
            </div>
          </div>
        )}

        {/* Status offline */}
        {(!online || queue.length > 0) && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
              online
                ? 'bg-warning-bg text-warning dark:bg-warning/15 dark:text-warning-soft'
                : 'bg-danger-bg text-danger dark:bg-danger/15 dark:text-danger-soft',
            )}
            title={
              online
                ? `${queue.length} operação(ões) aguardando sincronização`
                : 'Sem internet — as alterações serão sincronizadas depois'
            }
          >
            {online ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{online ? `Sincronizando ${queue.length}` : 'Offline'}</span>
          </div>
        )}

        <SinoDeAvisos />

        {/* Alertas */}
        <div ref={alertRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAlerts((v) => !v)}
            className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
            aria-label="Alertas"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal dark:border-navy-700 dark:bg-navy-800">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-navy-700">
                <p className="text-sm font-bold text-navy-900 dark:text-slate-100">Alertas</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {alerts?.soldTodayCount ?? 0} item(ns) vendidos hoje ·{' '}
                  {formatCurrency(alerts?.revenueToday ?? 0)}
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {alertCount === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum alerta de estoque 🎉
                  </p>
                )}

                {alerts?.outOfStock.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setShowAlerts(false);
                      navigate('/estoque?status=VENDIDO');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-navy-700"
                  >
                    <PackageX className="h-4 w-4 shrink-0 text-danger" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900 dark:text-slate-100">
                        {product.name}
                      </span>
                      <span className="text-xs text-danger">
                        Estoque zerado{product.unitName ? ` na ${product.unitName}` : ''}
                      </span>
                    </span>
                  </button>
                ))}

                {alerts?.lowStock.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setShowAlerts(false);
                      navigate('/estoque?estoqueBaixo=true');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-navy-700"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900 dark:text-slate-100">
                        {product.name}
                      </span>
                      <span className="text-xs text-warning">
                        {product.unitName ? `${product.unitName}: ` : ''}
                        restam {product.quantity} un. (mínimo {product.minQuantity})
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tema */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}

/**
 * Avisos de pré-venda e de venda finalizada.
 *
 * Fica separado do sino de estoque de propósito: um fala do que precisa
 * de reposição, este fala do que precisa de ação agora.
 */
function SinoDeAvisos() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data } = useNotificacoes();
  const marcar = useMarcarLida();

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const naoLidas = data?.unread ?? 0;
  const avisos = data?.data ?? [];

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
        aria-label="Avisos"
      >
        <MessageSquare className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal dark:border-navy-700 dark:bg-navy-800">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-navy-700">
            <p className="text-sm font-bold text-navy-900 dark:text-slate-100">Avisos</p>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={() => marcar.mutate(undefined)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Marcar todos como lidos
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {avisos.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum aviso por aqui
              </p>
            )}

            {avisos.map((aviso) => (
              <button
                key={aviso.id}
                type="button"
                onClick={() => {
                  marcar.mutate(aviso.id);
                  setAberto(false);
                  if (aviso.link) navigate(aviso.link);
                }}
                className={cn(
                  'block w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-navy-700',
                  !aviso.read && 'bg-accent/5',
                )}
              >
                <span className="flex items-start gap-2">
                  {!aviso.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                      {aviso.title}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {aviso.message}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {formatRelative(aviso.createdAt)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
