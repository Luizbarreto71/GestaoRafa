import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import {
  BarChart3,
  ChevronLeft,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { pode, type Permissao } from '@/lib/permissoes';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permissão necessária para o item aparecer. */
  permissao?: Permissao;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permissao: 'dashboard' },
  { to: '/caixa', label: 'Caixa', icon: Receipt, permissao: 'pdv' },
  { to: '/pre-vendas', label: 'Pré-vendas', icon: ShoppingBag, permissao: 'prevenda.criar' },
  { to: '/estoque', label: 'Estoque', icon: Package, permissao: 'produtos.ver' },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart, permissao: 'prevenda.verTodas' },
  { to: '/movimentacao', label: 'Movimentação', icon: PackagePlus, permissao: 'estoque.movimentar' },
  { to: '/movimentacoes', label: 'Histórico', icon: History, permissao: 'estoque.ver' },
  { to: '/clientes', label: 'Clientes', icon: Users, permissao: 'prevenda.verTodas' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, permissao: 'relatorios' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, permissao: 'configuracoes' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();

  const content = (
    <>
      {/* Marca */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-navy-700/60 px-4',
          collapsed && 'lg:justify-center lg:px-2',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base font-extrabold text-white">
          R
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-white">Rafa Multimarcas</p>
            <p className="truncate text-[11px] text-slate-400">Controle de estoque</p>
          </div>
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.filter((item) => !item.permissao || pode(user?.role, item.permissao)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onCloseMobile}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                collapsed && 'lg:justify-center lg:px-2',
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Usuário */}
      <div className="shrink-0 border-t border-navy-700/60 p-3">
        <div className={cn('flex items-center gap-3 rounded-lg px-2 py-2', collapsed && 'lg:justify-center')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent-soft">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">
                {user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-danger/20 hover:text-danger-soft',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Overlay do celular */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-navy-950/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 transition-[width,transform] duration-200 dark:bg-navy-950 dark:border-r dark:border-navy-800',
          'w-64',
          collapsed && 'lg:w-[72px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {content}

        {/* Botão de recolher (apenas desktop) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:text-navy-900 dark:border-navy-600 dark:bg-navy-800 dark:text-slate-400 lg:flex"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>
    </>
  );
}
