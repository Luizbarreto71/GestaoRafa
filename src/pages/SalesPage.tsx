import { PaymentBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategories, useDeleteSale, useSales } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadFile } from '@/lib/api';
import { formatCurrency, formatDateTime, formatPhone, PAYMENT_OPTIONS } from '@/lib/format';
import { ReciboModal } from '@/components/vendas/ReciboModal';
import type { Sale } from '@/types';
import { Download, Package, Receipt, Search, Trash2, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUnit } from '@/contexts/UnitContext';

export default function SalesPage() {
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('saleDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [recibo, setRecibo] = useState<Sale | null>(null);

  const [filters, setFilters] = useState({
    categoryId: '',
    paymentMethod: '',
    startDate: '',
    endDate: '',
  });

  const toast = useToast();
  const { isAdmin } = useAuth();
  const { unidadeId } = useUnit();
  const debouncedSearch = useDebounce(search, 350);
  const { data: categories } = useCategories();

  const query = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch,
      sortBy,
      sortOrder,
      ...(unidadeId ? { unitId: unidadeId } : {}),
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    }),
    [page, pageSize, debouncedSearch, sortBy, sortOrder, filters, unidadeId],
  );

  const { data, isLoading } = useSales(query);
  const deleteSale = useDeleteSale();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const hasFilters = Boolean(search || Object.values(filters).some(Boolean));

  function handleSort(key: string) {
    if (sortBy === key) setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortOrder('desc');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const result = await deleteSale.mutateAsync(deleting.id);
      toast.success('Venda cancelada', result.message);
      setDeleting(null);
    } catch (error) {
      toast.error('Não foi possível cancelar', error instanceof Error ? error.message : undefined);
    }
  }

  async function exportSales(format: 'xlsx' | 'pdf' | 'csv') {
    try {
      await downloadFile('/reports/sales', { format, ...filters, ...(unidadeId ? { unitId: unidadeId } : {}) }, `vendas.${format}`);
      toast.success('Relatório gerado');
    } catch {
      toast.error('Não foi possível exportar');
    }
  }

  const columns: TableColumn<Sale>[] = [
    {
      key: 'saleDate',
      header: 'Data',
      sortKey: 'saleDate',
      render: (sale) => (
        <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
          {formatDateTime(sale.saleDate)}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      sortKey: 'customerName',
      render: (sale) => (
        <div className="min-w-[140px]">
          <p className="font-semibold text-navy-900 dark:text-slate-100">{sale.customerName ?? '—'}</p>
          {sale.customerPhone && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatPhone(sale.customerPhone)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Produto',
      render: (sale) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-medium text-navy-900 dark:text-slate-100">
            {sale.items?.[0]?.productName ?? '—'}
            {sale.items && sale.items.length > 1 && (
              <span className="text-slate-400"> +{sale.items.length - 1}</span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[sale.items?.[0]?.imei, sale.items?.[0]?.serialNumber].filter(Boolean).join(' · ') || sale.code}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qtd',
      align: 'center',
      render: (sale) => (
        <span className="font-semibold">{sale.items?.reduce((n, i) => n + i.quantity, 0) ?? 0}</span>
      ),
    },
    {
      key: 'code',
      header: 'Venda',
      align: 'left',
      hideOnMobile: true,
      render: (sale) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{sale.code}</span>
      ),
    },
    {
      key: 'totalPrice',
      header: 'Total',
      sortKey: 'totalAmount',
      align: 'right',
      render: (sale) => <span className="font-bold text-success">{formatCurrency(sale.totalAmount)}</span>,
    },
    {
      key: 'unit',
      header: 'Unidade',
      render: (sale) => (
        <span className="text-sm font-medium text-navy-900 dark:text-slate-100">
          {sale.unit?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Pagamento',
      render: (sale) => {
        // Mostrar só a forma principal esconderia metade do dinheiro de
        // uma venda dividida — quem confere a maquininha precisa ver tudo.
        const divididas = (sale.payments ?? []).length > 1;

        if (!divididas) return <PaymentBadge method={sale.paymentMethod} />;

        return (
          <div className="space-y-1">
            {sale.payments!.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <PaymentBadge method={p.method} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {formatCurrency(p.amount)}
                  {p.installments > 1 ? ` · ${p.installments}x` : ''}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'seller',
      header: 'Vendedor / Caixa',
      hideOnMobile: true,
      render: (sale) => {
        // Quem vendeu pode não ter login: nesse caso vale o nome digitado.
        const vendedor = sale.seller?.name ?? sale.sellerName ?? null;

        return (
          <span className="block text-sm text-slate-600 dark:text-slate-400">
            {vendedor ?? '—'}
            {sale.cashier && sale.cashier.name !== vendedor && (
              <span className="block text-xs text-slate-400">caixa: {sale.cashier.name}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right' as const,
      render: (sale: Sale) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-accent hover:bg-accent/10"
            onClick={(e) => {
              // Sem isto o clique sobe para a linha e abre duas vezes.
              e.stopPropagation();
              setRecibo(sale);
            }}
            title="Ver comprovante"
          >
            <Receipt className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-bg dark:hover:bg-danger/15"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(sale);
              }}
              title="Cancelar venda e devolver ao estoque"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">Vendas</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Histórico completo · registre novas vendas na tela de Estoque
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
                onClick={() => void exportSales(format)}
                className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-navy-700"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </details>
      </div>

      {/* Totais do filtro atual */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Faturamento (filtro)"
          value={formatCurrency(data?.totals.revenue ?? 0)}
          icon={TrendingUp}
          tone="success"
          loading={isLoading}
        />
        <StatCard
          label="Itens vendidos"
          value={data?.totals.items ?? 0}
          icon={Package}
          tone="accent"
          loading={isLoading}
        />
        <StatCard
          label="Vendas registradas"
          value={data?.meta.total ?? 0}
          hint={
            data?.meta.total
              ? `Ticket médio: ${formatCurrency((data.totals.revenue ?? 0) / data.meta.total)}`
              : undefined
          }
          icon={Receipt}
          tone="navy"
          loading={isLoading}
        />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              label="Pesquisar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, produto, IMEI…"
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <Select
            label="Categoria"
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Todas"
          />
          <Select
            label="Pagamento"
            value={filters.paymentMethod}
            onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value }))}
            options={PAYMENT_OPTIONS}
            placeholder="Todos"
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
                setFilters({ categoryId: '', paymentMethod: '', startDate: '', endDate: '' });
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
          rowKey={(sale) => sale.id}
          onRowClick={(sale) => setRecibo(sale)}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          emptyMessage={hasFilters ? 'Nenhuma venda encontrada nesse período' : 'Nenhuma venda registrada ainda'}
          mobileCard={(sale) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-slate-100">
                    {sale.customerName ?? 'Cliente'}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {sale.items?.reduce((n, i) => n + i.quantity, 0)}× {sale.items?.[0]?.productName}
                    {sale.unit ? ` · ${sale.unit.name}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-success">
                  {formatCurrency(sale.totalAmount)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(sale.saleDate)}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {(sale.payments ?? []).length > 1 ? (
                    sale.payments!.map((p) => (
                      <span key={p.id} className="flex items-center gap-1">
                        <PaymentBadge method={p.method} />
                        <span className="text-xs text-slate-500">{formatCurrency(p.amount)}</span>
                      </span>
                    ))
                  ) : (
                    <PaymentBadge method={sale.paymentMethod} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecibo(sale);
                    }}
                    className="rounded p-1 text-accent"
                    aria-label="Ver comprovante"
                  >
                    <Receipt className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(sale);
                      }}
                      className="rounded p-1 text-danger"
                      aria-label="Cancelar venda"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        />

        <Pagination meta={data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>


      <ReciboModal venda={recibo} aoFechar={() => setRecibo(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Cancelar venda"
        message={`A venda ${deleting?.code} para ${deleting?.customerName ?? 'o cliente'} será removida e ${deleting?.items?.reduce((n, i) => n + i.quantity, 0) ?? 0} unidade(s) voltarão ao estoque.`}
        confirmLabel="Cancelar venda"
        cancelLabel="Voltar"
        loading={deleteSale.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
