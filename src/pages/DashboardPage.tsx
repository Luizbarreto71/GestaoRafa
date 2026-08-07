import { MovementChart } from '@/components/dashboard/MovementChart';
import { Badge, PaymentBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  PackageX,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
];

export default function DashboardPage() {
  const [days, setDays] = useState(14);
  const [chartMode, setChartMode] = useState<'revenue' | 'flow'>('revenue');
  const { data, isLoading } = useDashboard(days);
  const { user } = useAuth();
  const navigate = useNavigate();

  const cards = data?.cards;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Resumo do estoque e das vendas da Rafa Multimarcas.
          </p>
        </div>

        <Button icon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate('/estoque')}>
          Registrar venda
        </Button>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total de produtos"
          value={formatNumber(cards?.totalProducts ?? 0)}
          hint="Cadastrados no sistema"
          icon={Package}
          tone="navy"
          loading={isLoading}
          onClick={() => navigate('/estoque')}
        />
        <StatCard
          label="Produtos em estoque"
          value={formatNumber(cards?.itemsInStock ?? 0)}
          hint="Unidades disponíveis"
          icon={Boxes}
          tone="accent"
          loading={isLoading}
          onClick={() => navigate('/estoque?status=EM_ESTOQUE')}
        />
        <StatCard
          label="Vendidos hoje"
          value={formatNumber(cards?.soldToday ?? 0)}
          hint={`${cards?.salesCountToday ?? 0} venda(s) · ${formatCurrency(cards?.revenueToday ?? 0)}`}
          icon={ShoppingCart}
          tone="success"
          loading={isLoading}
          onClick={() => navigate('/vendas')}
        />
        <StatCard
          label="Valor total do estoque"
          value={formatCurrency(cards?.stockValueSale ?? 0)}
          hint={`Custo: ${formatCurrency(cards?.stockValueCost ?? 0)}`}
          icon={Wallet}
          tone="purple"
          loading={isLoading}
        />
        <StatCard
          label="Estoque baixo"
          value={formatNumber(cards?.lowStockCount ?? 0)}
          hint={`${cards?.outOfStockCount ?? 0} produto(s) zerados`}
          icon={AlertTriangle}
          tone="warning"
          loading={isLoading}
          onClick={() => navigate('/estoque?estoqueBaixo=true')}
        />
        <StatCard
          label="Faturamento do mês"
          value={formatCurrency(cards?.revenueMonth ?? 0)}
          hint={`Lucro: ${formatCurrency(cards?.profitMonth ?? 0)} · ${cards?.itemsSoldMonth ?? 0} itens`}
          icon={TrendingUp}
          tone="success"
          loading={isLoading}
          onClick={() => navigate('/relatorios')}
        />
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader
          title="Movimentação"
          subtitle={chartMode === 'revenue' ? 'Faturamento por dia' : 'Entradas e saídas de estoque'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-navy-800">
                {(
                  [
                    { key: 'revenue', label: 'Faturamento' },
                    { key: 'flow', label: 'Entradas/Saídas' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setChartMode(option.key)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                      chartMode === option.key
                        ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-slate-100'
                        : 'text-slate-500 hover:text-navy-900 dark:text-slate-400',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-navy-800">
                {PERIODS.map((period) => (
                  <button
                    key={period.days}
                    type="button"
                    onClick={() => setDays(period.days)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                      days === period.days
                        ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-slate-100'
                        : 'text-slate-500 hover:text-navy-900 dark:text-slate-400',
                    )}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <CardBody className="px-2 pb-2 pt-4 sm:px-4">
          {isLoading ? (
            <div className="skeleton h-[300px] w-full" />
          ) : (
            <MovementChart data={data?.chart ?? []} mode={chartMode} />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Últimas vendas */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Últimas vendas"
            subtitle="Registros mais recentes"
            action={
              <Link to="/vendas" className="text-xs font-semibold text-accent hover:underline">
                Ver todas
              </Link>
            }
          />
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-4">
                  <div className="skeleton h-10 w-full" />
                </div>
              ))}

            {!isLoading && !data?.latestSales.length && (
              <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhuma venda registrada ainda.
              </p>
            )}

            {data?.latestSales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-bg text-success dark:bg-success/15 dark:text-success-soft">
                  <ShoppingCart className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                    {sale.customerName ?? 'Cliente não informado'}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {sale.quantity}× {sale.product?.name} · {formatDateTime(sale.saleDate)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-success">{formatCurrency(sale.totalPrice)}</p>
                  <PaymentBadge method={sale.paymentMethod} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Estoque baixo + categorias */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Estoque baixo" subtitle="Reponha em breve" />
            <div className="divide-y divide-slate-200 dark:divide-navy-700">
              {!isLoading && !data?.lowStockProducts.length && (
                <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhum produto em nível crítico 🎉
                </p>
              )}

              {data?.lowStockProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/estoque?busca=${encodeURIComponent(product.name)}`}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-navy-800/60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning dark:bg-warning/15 dark:text-warning-soft">
                    <PackageX className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900 dark:text-slate-100">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {product.category?.name}
                    </p>
                  </div>
                  <Badge tone="warning">{product.quantity} un.</Badge>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Estoque por categoria" />
            <CardBody className="space-y-3">
              {data?.categories.map((category) => {
                const total = data.categories.reduce((sum, item) => sum + item.quantity, 0) || 1;
                const percent = (category.quantity / total) * 100;

                return (
                  <div key={category.categoryId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-navy-900 dark:text-slate-200">{category.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {category.quantity} un. · {category.products} produto(s)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, backgroundColor: category.color }}
                      />
                    </div>
                  </div>
                );
              })}

              {!isLoading && !data?.categories.length && (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Cadastre produtos para ver a distribuição.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Lucro do dia */}
      {cards && cards.revenueToday > 0 && (
        <Card className="bg-gradient-to-r from-navy-900 to-navy-800 text-white dark:from-navy-900 dark:to-navy-950">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <DollarSign className="h-5 w-5 text-success-soft" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado de hoje</p>
                <p className="text-xl font-extrabold">{formatCurrency(cards.revenueToday)}</p>
              </div>
            </div>

            <div className="flex gap-8">
              <div>
                <p className="text-xs text-slate-400">Lucro bruto</p>
                <p className="text-lg font-bold text-success-soft">{formatCurrency(cards.profitToday)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Itens vendidos</p>
                <p className="text-lg font-bold">{cards.soldToday}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
