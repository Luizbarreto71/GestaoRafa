import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogs } from '@/hooks/queries';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Login',
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  ARCHIVE: 'Arquivamento',
  DEACTIVATE: 'Desativação',
  ADJUST_STOCK: 'Ajuste de estoque',
  CHANGE_PASSWORD: 'Troca de senha',
  IMPORT: 'Importação',
  BACKUP: 'Backup',
  SHEETS_SYNC: 'Sincronização da planilha',
};

const ENTITY_LABEL: Record<string, string> = {
  Product: 'Produto',
  Sale: 'Venda',
  User: 'Usuário',
  Supplier: 'Fornecedor',
  Customer: 'Cliente',
  Category: 'Categoria',
  Setting: 'Configuração',
};

const ACTION_TONE = (action: string) => {
  if (action.includes('DELETE')) return 'danger' as const;
  if (action.includes('CREATE')) return 'success' as const;
  if (action === 'LOGIN') return 'info' as const;
  return 'neutral' as const;
};

export function LogsTab() {
  const [page, setPage] = useState(1);
  const { isAdmin } = useAuth();
  const { data, isLoading } = useActivityLogs({ page, pageSize: 25 }, isAdmin);

  if (!isAdmin) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Apenas administradores podem consultar os logs.
          </p>
        </div>
      </Card>
    );
  }

  const columns: TableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Data',
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
          {formatDateTime(log.createdAt)}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Usuário',
      render: (log) => (
        <div className="min-w-[120px]">
          <p className="text-sm font-medium text-navy-900 dark:text-slate-100">{log.user?.name ?? 'Sistema'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{log.user?.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (log) => <Badge tone={ACTION_TONE(log.action)}>{ACTION_LABEL[log.action] ?? log.action}</Badge>,
    },
    {
      key: 'entity',
      header: 'Registro',
      render: (log) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {ENTITY_LABEL[log.entity] ?? log.entity}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      hideOnMobile: true,
      render: (log) => <span className="font-mono text-xs text-slate-500">{log.ip ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Histórico completo de alterações feitas no sistema — quem fez, o que fez e quando.
      </p>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(log) => log.id}
          emptyMessage="Nenhum registro de atividade"
          mobileCard={(log) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                  {log.user?.name ?? 'Sistema'}
                </p>
                <Badge tone={ACTION_TONE(log.action)}>{ACTION_LABEL[log.action] ?? log.action}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {ENTITY_LABEL[log.entity] ?? log.entity} · {formatDateTime(log.createdAt)}
              </p>
            </div>
          )}
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>
    </div>
  );
}
