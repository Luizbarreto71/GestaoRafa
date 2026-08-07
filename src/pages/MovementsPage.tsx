import { MovementBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/contexts/ToastContext';
import { useCategories, useMovements } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadFile } from '@/lib/api';
import { formatDateTime, MOVEMENT_LABEL } from '@/lib/format';
import type { Movement, MovementType } from '@/types';
import { ArrowDownLeft, ArrowUpRight, Download, Search, Settings2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const TYPE_OPTIONS = (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((value) => ({
  value,
  label: MOVEMENT_LABEL[value],
}));

export default function MovementsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({ type: '', categoryId: '', startDate: '', endDate: '' });

  const toast = useToast();
  const debouncedSearch = useDebounce(search, 350);
  const { data: categories } = useCategories();

  const query = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch,
      sortOrder,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    }),
    [page, pageSize, debouncedSearch, sortOrder, filters],
  );

  const { data, isLoading } = useMovements(query);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const hasFilters = Boolean(search || Object.values(filters).some(Boolean));

  async function exportMovements(format: 'xlsx' | 'pdf' | 'csv') {
    try {
      await downloadFile('/reports/movements', { format, ...filters }, `movimentacoes.${format}`);
      toast.success('Relatório gerado');
    } catch {
      toast.error('Não foi possível exportar');
    }
  }

  const columns: TableColumn<Movement>[] = [
    {
      key: 'createdAt',
      header: 'Data',
      sortKey: 'createdAt',
      render: (movement) => (
        <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
          {formatDateTime(movement.createdAt)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (movement) => <MovementBadge type={movement.type} />,
    },
    {
      key: 'product',
      header: 'Produto',
      render: (movement) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-medium text-navy-900 dark:text-slate-100">
            {movement.productName ?? movement.product?.name ?? '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[movement.product?.category?.name, movement.product?.model].filter(Boolean).join(' · ') ||
              'Produto removido'}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qtd',
      align: 'center',
      render: (movement) => (
        <span
          className={
            movement.type === 'ENTRADA'
              ? 'font-bold text-success'
              : movement.type === 'SAIDA'
                ? 'font-bold text-accent'
                : 'font-semibold text-slate-600 dark:text-slate-400'
          }
        >
          {movement.type === 'ENTRADA' ? '+' : movement.type === 'SAIDA' ? '−' : ''}
          {movement.quantity}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'center',
      hideOnMobile: true,
      render: (movement) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{movement.balanceAfter ?? '—'}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (movement) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{movement.reason ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      header: 'Usuário',
      hideOnMobile: true,
      render: (movement) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{movement.user?.name ?? '—'}</span>
      ),
    },
  ];

  const summary = data?.summary ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            Movimentações
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Histórico completo de entradas, saídas, ajustes e exclusões
          </p>
        </div>

        <details className="group relative">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-100 dark:hover:bg-navy-800">
            <Download className="h-4 w-4" />
            Exportar
          </summary>
          <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-hover dark:border-navy-700 dark:bg-navy-800">
            {(['xlsx', 'pdf', 'csv'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => void exportMovements(format)}
                className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-navy-700"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Entradas"
          value={summary.ENTRADA?.quantity ?? 0}
          hint={`${summary.ENTRADA?.count ?? 0} registro(s)`}
          icon={ArrowDownLeft}
          tone="success"
          loading={isLoading}
        />
        <StatCard
          label="Saídas"
          value={summary.SAIDA?.quantity ?? 0}
          hint={`${summary.SAIDA?.count ?? 0} registro(s)`}
          icon={ArrowUpRight}
          tone="accent"
          loading={isLoading}
        />
        <StatCard
          label="Ajustes"
          value={summary.AJUSTE?.count ?? 0}
          hint="Alterações de cadastro"
          icon={Settings2}
          tone="warning"
          loading={isLoading}
        />
        <StatCard
          label="Exclusões"
          value={summary.EXCLUSAO?.count ?? 0}
          hint="Produtos removidos"
          icon={Trash2}
          tone="danger"
          loading={isLoading}
        />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Pesquisar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produto ou motivo…"
            icon={<Search className="h-4 w-4" />}
          />
          <Select
            label="Tipo"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            options={TYPE_OPTIONS}
            placeholder="Todos"
          />
          <Select
            label="Categoria"
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Todas"
          />
          <Input
            label="De"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
          />
          <Input
            label="Até"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>

        {hasFilters && (
          <div className="border-t border-slate-200 px-4 py-2 dark:border-navy-700">
            <Button
              size="sm"
              variant="ghost"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => {
                setSearch('');
                setFilters({ type: '', categoryId: '', startDate: '', endDate: '' });
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(movement) => movement.id}
          sortBy="createdAt"
          sortOrder={sortOrder}
          onSort={() => setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))}
          emptyMessage="Nenhuma movimentação encontrada"
          mobileCard={(movement) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                  {movement.productName ?? '—'}
                </p>
                <MovementBadge type={movement.type} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{movement.reason ?? '—'}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {formatDateTime(movement.createdAt)} · {movement.user?.name ?? '—'}
                </span>
                <span className="font-bold text-navy-900 dark:text-slate-200">
                  {movement.type === 'ENTRADA' ? '+' : movement.type === 'SAIDA' ? '−' : ''}
                  {movement.quantity}
                </span>
              </div>
            </div>
          )}
        />

        <Pagination meta={data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}
