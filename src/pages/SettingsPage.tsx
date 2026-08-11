import { CategoriesTab } from '@/components/settings/CategoriesTab';
import { LogsTab } from '@/components/settings/LogsTab';
import { UnitsTab } from '@/components/settings/UnitsTab';
import { SuppliersTab } from '@/components/settings/SuppliersTab';
import { SystemTab } from '@/components/settings/SystemTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { cn } from '@/lib/cn';
import { Building2, History, LayoutList, Settings2, Truck, Users } from 'lucide-react';
import { useState } from 'react';

const TABS = [
  { key: 'system', label: 'Sistema', icon: Settings2, component: SystemTab },
  { key: 'units', label: 'Unidades', icon: Building2, component: UnitsTab },
  { key: 'categories', label: 'Categorias', icon: LayoutList, component: CategoriesTab },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, component: SuppliersTab },
  { key: 'users', label: 'Usuários', icon: Users, component: UsersTab },
  { key: 'logs', label: 'Logs', icon: History, component: LogsTab },
] as const;

export default function SettingsPage() {
  const [active, setActive] = useState<(typeof TABS)[number]['key']>('system');
  const ActiveComponent = TABS.find((tab) => tab.key === active)!.component;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
          Configurações
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Cadastros, integrações, backup e segurança do sistema.
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-navy-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              active === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-navy-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
