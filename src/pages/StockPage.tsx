import { ProductFormModal } from '@/components/products/ProductFormModal';
import { SaleModal } from '@/components/sales/SaleModal';
import { Badge, StatusBadge, StockBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useAdjustStock,
  useCategories,
  useDeleteProduct,
  useProductFilters,
  useProducts,
  useSuppliers,
} from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, STATUS_OPTIONS } from '@/lib/format';
import type { Product } from '@/types';
import {
  Download,
  Filter,
  ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUnit } from '@/contexts/UnitContext';

export default function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [filters, setFilters] = useState({
    categoryId: searchParams.get('categoria') ?? '',
    supplierId: '',
    status: searchParams.get('status') ?? '',
    brand: '',
    model: '',
    lowStock: searchParams.get('estoqueBaixo') ?? '',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: '1', reason: '', unitId: '' });

  const toast = useToast();
  const { isAdmin } = useAuth();
  const { unidadeId, unidades } = useUnit();
  const debouncedSearch = useDebounce(search, 350);

  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers({ all: 'true' });
  const { data: filterOptions } = useProductFilters();

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

  const { data, isLoading, isFetching } = useProducts(query);
  const deleteProduct = useDeleteProduct();
  const adjustStock = useAdjustStock();

  // Volta à primeira página quando a busca ou os filtros mudam.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  // Mantém a URL sincronizada com a busca (links compartilháveis).
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) params.set('busca', debouncedSearch);
    else params.delete('busca');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => {
    setFilters({ categoryId: '', supplierId: '', status: '', brand: '', model: '', lowStock: '' });
    setSearch('');
  };

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const result = await deleteProduct.mutateAsync({ id: deleting.id });
      toast.success(result.archived ? 'Produto arquivado' : 'Produto excluído', result.message);
      setDeleting(null);
    } catch (error) {
      toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
    }
  }

  async function confirmAdjust() {
    if (!adjusting) return;
    const quantity = Number(adjustForm.quantity);

    if (!quantity) {
      toast.warning('Informe uma quantidade diferente de zero');
      return;
    }
    if (adjustForm.reason.trim().length < 3) {
      toast.warning('Descreva o motivo do ajuste');
      return;
    }

    try {
      await adjustStock.mutateAsync({
        id: adjusting.id,
        quantity,
        reason: adjustForm.reason.trim(),
        unitId: adjustForm.unitId,
      });
      toast.success('Estoque ajustado', `${adjusting.name}: ${quantity > 0 ? '+' : ''}${quantity} un.`);
      setAdjusting(null);
      setAdjustForm({ quantity: '1', reason: '', unitId: '' });
    } catch (error) {
      toast.error('Falha no ajuste', error instanceof Error ? error.message : undefined);
    }
  }

  async function exportStock(format: 'xlsx' | 'pdf' | 'csv') {
    try {
      await downloadFile(
        '/reports/stock',
        { format, ...filters, ...(unidadeId ? { unitId: unidadeId } : {}) },
        `estoque.${format}`,
      );
      toast.success('Relatório gerado');
    } catch {
      toast.error('Não foi possível exportar o relatório');
    }
  }

  const columns: TableColumn<Product>[] = [
    {
      key: 'photo',
      header: 'Foto',
      className: 'w-16',
      render: (product) =>
        product.photos?.[0] ? (
          <img
            src={product.photos[0]}
            alt={product.name}
            className="h-11 w-11 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-navy-800">
            <ImageIcon className="h-4 w-4" />
          </div>
        ),
    },
    {
      key: 'name',
      header: 'Produto',
      sortKey: 'name',
      render: (product) => (
        <div className="min-w-[180px]">
          <p className="font-semibold text-navy-900 dark:text-slate-100">{product.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[product.brand, product.color, product.capacity].filter(Boolean).join(' · ') || '—'}
          </p>
          {product.imei && <p className="text-[11px] text-slate-400">IMEI {product.imei}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      sortKey: 'category.name',
      hideOnMobile: true,
      render: (product) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: product.category?.color ?? '#64748B' }}
          />
          {product.category?.name}
        </span>
      ),
    },
    {
      key: 'model',
      header: 'Modelo',
      sortKey: 'model',
      hideOnMobile: true,
      render: (product) => product.model || '—',
    },
    {
      key: 'quantity',
      header: unidadeId ? 'Estoque' : 'Estoque por unidade',
      align: 'center',
      render: (product) =>
        unidadeId ? (
          <StockBadge quantity={product.quantity} minQuantity={product.minQuantity} />
        ) : (
          <div className="flex flex-wrap justify-center gap-1">
            {product.stock?.length ? (
              product.stock.map((s) => (
                <Badge
                  key={s.unitId}
                  tone={
                    (s.available ?? s.quantity) > product.minQuantity
                      ? 'success'
                      : (s.available ?? s.quantity) > 0
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {s.unitName}: {s.quantity}
                  {s.reserved ? ` · ${s.reserved} na loja` : ''}
                </Badge>
              ))
            ) : (
              <Badge tone="danger">Sem estoque</Badge>
            )}
          </div>
        ),
    },
    {
      key: 'costPrice',
      header: 'Custo',
      sortKey: 'costPrice',
      align: 'right',
      hideOnMobile: true,
      render: (product) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatCurrency(product.costPrice)}</span>
      ),
    },
    {
      key: 'salePrice',
      header: 'Venda',
      sortKey: 'salePrice',
      align: 'right',
      render: (product) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">
          {formatCurrency(product.salePrice)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Fornecedor',
      sortKey: 'supplier.name',
      hideOnMobile: true,
      render: (product) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{product.supplier?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (product) => <StatusBadge status={product.status} />,
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="success"
            disabled={product.quantity < 1}
            onClick={() => setSaleProduct(product)}
            title={product.quantity < 1 ? 'Sem estoque disponível' : 'Registrar venda'}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Vender</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setAdjusting(product);
              setAdjustForm({
                quantity: '1',
                reason: '',
                unitId: unidadeId ?? product.stock?.[0]?.unitId ?? '',
              });
            }}
            title="Ajustar estoque"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditing(product);
              setFormOpen(true);
            }}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-bg hover:text-danger dark:hover:bg-danger/15"
              onClick={() => setDeleting(product)}
              title="Excluir"
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
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">Estoque</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {data?.meta.total ?? 0} produto(s)
            {unidadeId ? ` na ${unidades.find((u) => u.id === unidadeId)?.name ?? 'unidade'}` : ' no total'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <details className="group">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-100 dark:hover:bg-navy-800">
                <Download className="h-4 w-4" />
                Exportar
              </summary>
              <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-hover dark:border-navy-700 dark:bg-navy-800">
                {(['xlsx', 'pdf', 'csv'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void exportStock(format)}
                    className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-navy-700"
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </details>
          </div>

          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Novo produto
          </Button>
        </div>
      </div>

      {/* Busca + filtros */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por nome, IMEI, série, marca, modelo, fornecedor…"
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <Button
            variant={showFilters || activeFilterCount ? 'primary' : 'outline'}
            icon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs">{activeFilterCount}</span>
            )}
          </Button>

          {(activeFilterCount > 0 || search) && (
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-4 dark:border-navy-700 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              label="Categoria"
              value={filters.categoryId}
              onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Todas"
            />
            <Select
              label="Fornecedor"
              value={filters.supplierId}
              onChange={(e) => setFilters((f) => ({ ...f, supplierId: e.target.value }))}
              options={(suppliers?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Todos"
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              options={STATUS_OPTIONS}
              placeholder="Todos"
            />
            <Select
              label="Marca"
              value={filters.brand}
              onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
              options={(filterOptions?.brands ?? []).map((brand) => ({ value: brand, label: brand }))}
              placeholder="Todas"
            />
            <Select
              label="Modelo"
              value={filters.model}
              onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
              options={(filterOptions?.models ?? []).map((model) => ({ value: model, label: model }))}
              placeholder="Todos"
            />
          </div>
        )}
      </Card>

      {/* Tabela */}
      <Card className={cn(isFetching && !isLoading && 'opacity-70 transition-opacity')}>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(product) => product.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          emptyMessage={
            search || activeFilterCount
              ? 'Nenhum produto encontrado com esses filtros'
              : 'Nenhum produto cadastrado ainda'
          }
          emptyAction={
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Cadastrar primeiro produto
            </Button>
          }
          mobileCard={(product) => (
            <div className="flex gap-3">
              {product.photos?.[0] ? (
                <img
                  src={product.photos[0]}
                  alt={product.name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-navy-800">
                  <Package className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-slate-100">{product.name}</p>
                  <StockBadge quantity={product.quantity} minQuantity={product.minQuantity} />
                </div>

                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {[product.category?.name, product.model].filter(Boolean).join(' · ')}
                </p>
                {!unidadeId && product.stock?.length > 0 && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {product.stock.map((s) => `${s.unitName}: ${s.quantity}`).join(' · ')}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-navy-900 dark:text-slate-100">
                    {formatCurrency(product.salePrice)}
                  </span>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="success"
                      disabled={product.quantity < 1}
                      onClick={() => setSaleProduct(product)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="secondary" onClick={() => setDeleting(product)}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        />

        <Pagination meta={data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      {/* Modais */}
      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        product={editing}
      />

      <SaleModal open={Boolean(saleProduct)} onClose={() => setSaleProduct(null)} product={saleProduct} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir "${deleting?.name}"? Esta ação será registrada nas movimentações e não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleteProduct.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />

      {/* Ajuste rápido de estoque */}
      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Ajustar estoque"
        description={adjusting?.name}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmAdjust()} loading={adjustStock.isPending}>
              Confirmar ajuste
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {[-1, 1, 5, 10].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAdjustForm((f) => ({ ...f, quantity: String(value) }))}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                  Number(adjustForm.quantity) === value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
                )}
              >
                {value > 0 ? `+${value}` : value}
              </button>
            ))}
          </div>

          <Select
            label="Unidade"
            required
            value={adjustForm.unitId}
            onChange={(event) => setAdjustForm((f) => ({ ...f, unitId: event.target.value }))}
            options={unidades.map((u) => ({
              value: u.id,
              label: `${u.name} — ${adjusting?.stock?.find((s) => s.unitId === u.id)?.quantity ?? 0} em estoque`,
            }))}
            placeholder="Selecione…"
          />

          <Input
            label="Quantidade (use valor negativo para dar baixa)"
            type="number"
            value={adjustForm.quantity}
            onChange={(event) => setAdjustForm((f) => ({ ...f, quantity: event.target.value }))}
          />

          <Input
            label="Motivo"
            required
            value={adjustForm.reason}
            onChange={(event) => setAdjustForm((f) => ({ ...f, reason: event.target.value }))}
            placeholder="Ex.: nova remessa, produto avariado, devolução"
          />

          {adjusting && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-navy-800 dark:text-slate-400">
              Saldo na unidade após o ajuste:{' '}
              <strong className="text-navy-900 dark:text-slate-200">
                {Math.max(
                  0,
                  (adjusting.stock?.find((s) => s.unitId === adjustForm.unitId)?.quantity ?? 0) +
                    (Number(adjustForm.quantity) || 0),
                )}{' '}
                un.
              </strong>
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
