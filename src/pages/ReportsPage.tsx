import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { useToast } from '@/contexts/ToastContext';
import { useCategories, useSuppliers } from '@/hooks/queries';
import { useUnit } from '@/contexts/UnitContext';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PAYMENT_OPTIONS, STATUS_OPTIONS, toInputDate } from '@/lib/format';
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CalendarRange,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShoppingCart,
  Table,
  Truck,
} from 'lucide-react';
import { useState } from 'react';

type ReportKey = 'stock' | 'sales' | 'by-category' | 'by-supplier' | 'by-period' | 'movements';

interface ReportDefinition {
  key: ReportKey;
  endpoint: string;
  title: string;
  description: string;
  icon: typeof Boxes;
  tone: string;
  fields: ('period' | 'category' | 'supplier' | 'status' | 'payment' | 'groupBy')[];
}

const REPORTS: ReportDefinition[] = [
  {
    key: 'stock',
    endpoint: '/reports/stock',
    title: 'Relatório de estoque',
    description: 'Todos os produtos com quantidade, custo, venda e valor total imobilizado.',
    icon: Boxes,
    tone: 'bg-accent/10 text-accent',
    fields: ['category', 'supplier', 'status', 'period'],
  },
  {
    key: 'sales',
    endpoint: '/reports/sales',
    title: 'Relatório de vendas',
    description: 'Vendas do período com cliente, produto, forma de pagamento e lucro.',
    icon: ShoppingCart,
    tone: 'bg-success/10 text-success',
    fields: ['period', 'category', 'payment', 'supplier'],
  },
  {
    key: 'by-category',
    endpoint: '/reports/by-category',
    title: 'Relatório por categoria',
    description: 'Comparativo de estoque e faturamento entre celulares, TG, JBL, notebooks e games.',
    icon: BarChart3,
    tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
    fields: ['period'],
  },
  {
    key: 'by-supplier',
    endpoint: '/reports/by-supplier',
    title: 'Relatório por fornecedor',
    description: 'Quanto foi investido e faturado com cada fornecedor.',
    icon: Truck,
    tone: 'bg-warning/10 text-warning',
    fields: ['period'],
  },
  {
    key: 'by-period',
    endpoint: '/reports/by-period',
    title: 'Relatório por período',
    description: 'Faturamento, lucro, entradas e saídas agrupados por dia ou mês.',
    icon: CalendarRange,
    tone: 'bg-navy-900/10 text-navy-900 dark:bg-white/10 dark:text-slate-200',
    fields: ['period', 'groupBy'],
  },
  {
    key: 'movements',
    endpoint: '/reports/movements',
    title: 'Relatório de movimentações',
    description: 'Auditoria completa de entradas, saídas, ajustes e exclusões.',
    icon: ArrowLeftRight,
    tone: 'bg-danger/10 text-danger',
    fields: ['period', 'category'],
  },
];

const FORMATS = [
  { key: 'pdf' as const, label: 'PDF', icon: FileText },
  { key: 'xlsx' as const, label: 'Excel', icon: FileSpreadsheet },
  { key: 'csv' as const, label: 'CSV', icon: Table },
];

export default function ReportsPage() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [filters, setFilters] = useState({
    startDate: toInputDate(firstDayOfMonth),
    endDate: toInputDate(today),
    categoryId: '',
    supplierId: '',
    status: '',
    paymentMethod: '',
    groupBy: 'day',
  });

  const [downloading, setDownloading] = useState<string | null>(null);

  const toast = useToast();
  const { unidadeId, rotulo } = useUnit();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers({ all: 'true' });

  async function generate(report: ReportDefinition, format: 'pdf' | 'xlsx' | 'csv') {
    const id = `${report.key}-${format}`;
    setDownloading(id);

    // Envia só os filtros que o relatório aceita.
    const params: Record<string, string> = { format };
    // Os relatórios seguem a unidade escolhida lá em cima.
    if (unidadeId) params.unitId = unidadeId;
    if (report.fields.includes('period')) {
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
    }
    if (report.fields.includes('category') && filters.categoryId) params.categoryId = filters.categoryId;
    if (report.fields.includes('supplier') && filters.supplierId) params.supplierId = filters.supplierId;
    if (report.fields.includes('status') && filters.status) params.status = filters.status;
    if (report.fields.includes('payment') && filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
    if (report.fields.includes('groupBy')) params.groupBy = filters.groupBy;

    try {
      await downloadFile(report.endpoint, params, `${report.key}.${format}`);
      toast.success('Relatório gerado', `${report.title} · ${format.toUpperCase()}`);
    } catch {
      toast.error('Não foi possível gerar o relatório', 'Verifique sua conexão e tente novamente.');
    } finally {
      setDownloading(null);
    }
  }

  const quickPeriod = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setFilters((f) => ({ ...f, startDate: toInputDate(start), endDate: toInputDate(end) }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">Relatórios</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Exporte em PDF, Excel ou CSV. Os dados são de <strong>{rotulo}</strong>.
        </p>
      </div>

      {/* Filtros globais */}
      <Card>
        <CardHeader
          title="Filtros"
          subtitle="Aplicados aos relatórios que suportam cada campo"
          action={
            <div className="flex gap-1.5">
              {[
                { label: 'Hoje', days: 1 },
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
                { label: '90 dias', days: 90 },
              ].map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => quickPeriod(option.days)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800"
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Data inicial"
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((f) => ({ ...f, startDate: event.target.value }))}
          />
          <Input
            label="Data final"
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((f) => ({ ...f, endDate: event.target.value }))}
          />
          <Select
            label="Categoria"
            value={filters.categoryId}
            onChange={(event) => setFilters((f) => ({ ...f, categoryId: event.target.value }))}
            options={(categories ?? []).map((category) => ({ value: category.id, label: category.name }))}
            placeholder="Todas"
          />
          <Select
            label="Fornecedor"
            value={filters.supplierId}
            onChange={(event) => setFilters((f) => ({ ...f, supplierId: event.target.value }))}
            options={(suppliers?.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            placeholder="Todos"
          />
          <Select
            label="Status do produto"
            value={filters.status}
            onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
            options={STATUS_OPTIONS}
            placeholder="Todos"
          />
          <Select
            label="Forma de pagamento"
            value={filters.paymentMethod}
            onChange={(event) => setFilters((f) => ({ ...f, paymentMethod: event.target.value }))}
            options={PAYMENT_OPTIONS}
            placeholder="Todas"
          />
          <Select
            label="Agrupar período por"
            value={filters.groupBy}
            onChange={(event) => setFilters((f) => ({ ...f, groupBy: event.target.value }))}
            options={[
              { value: 'day', label: 'Dia' },
              { value: 'month', label: 'Mês' },
            ]}
          />
        </CardBody>
      </Card>

      {/* Relatórios */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.key} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col">
              <div className="flex items-start gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', report.tone)}>
                  <report.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">{report.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {report.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-navy-700">
                {FORMATS.map((format) => {
                  const id = `${report.key}-${format.key}`;
                  const busy = downloading === id;

                  return (
                    <Button
                      key={format.key}
                      variant="outline"
                      size="sm"
                      disabled={Boolean(downloading)}
                      onClick={() => void generate(report, format.key)}
                      icon={
                        busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <format.icon className="h-3.5 w-3.5" />
                      }
                    >
                      {format.label}
                    </Button>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
