import { useDebounce } from '@/hooks/useDebounce';
import { useQuickSearch } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate } from '@/lib/format';
import { Loader2, Package, Search, ShoppingCart, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Busca instantânea global: IMEI, modelo, nome, marca, fornecedor,
 * número de série e cliente.
 */
export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debounced = useDebounce(term, 300);
  const { data, isFetching } = useQuickSearch(debounced);

  // Fecha ao clicar fora
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Atalho: "/" foca a busca
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setTerm('');
    navigate(path);
  };

  const hasResults =
    Boolean(data) && (data!.products.length > 0 || data!.sales.length > 0 || data!.customers.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por IMEI, modelo, nome, marca, fornecedor, cliente…"
          className="input-base h-10 pl-9 pr-9"
          aria-label="Busca global"
        />
        {isFetching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : term ? (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-navy-900 dark:hover:text-slate-200"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 px-1.5 text-[10px] font-semibold text-slate-400 dark:border-navy-600 lg:block">
            /
          </kbd>
        )}
      </div>

      {open && debounced.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] animate-slide-up overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-modal dark:border-navy-700 dark:bg-navy-800">
          {!hasResults && !isFetching && (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nada encontrado para “{debounced}”
            </p>
          )}

          {data?.products.length ? (
            <Section title="Produtos">
              {data.products.map((product) => (
                <ResultRow
                  key={product.id}
                  icon={<Package className="h-4 w-4" />}
                  title={product.name}
                  subtitle={[product.model, product.imei && `IMEI ${product.imei}`, product.serialNumber]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={`${product.quantity} un. · ${formatCurrency(product.salePrice)}`}
                  onClick={() => go(`/estoque?produto=${product.id}`)}
                />
              ))}
            </Section>
          ) : null}

          {data?.sales.length ? (
            <Section title="Vendas">
              {data.sales.map((sale) => (
                <ResultRow
                  key={sale.id}
                  icon={<ShoppingCart className="h-4 w-4" />}
                  title={sale.customerName ?? 'Cliente'}
                  subtitle={sale.items?.map((i) => i.productName).filter(Boolean).join(', ')}
                  meta={`${formatDate(sale.saleDate)} · ${formatCurrency(sale.totalAmount)}`}
                  onClick={() => go(`/vendas?busca=${encodeURIComponent(sale.customerName ?? '')}`)}
                />
              ))}
            </Section>
          ) : null}

          {data?.customers.length ? (
            <Section title="Clientes">
              {data.customers.map((customer) => (
                <ResultRow
                  key={customer.id}
                  icon={<User className="h-4 w-4" />}
                  title={customer.name}
                  subtitle={customer.phone ?? undefined}
                  onClick={() => go(`/clientes?busca=${encodeURIComponent(customer.name)}`)}
                />
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  meta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
        'hover:bg-slate-100 dark:hover:bg-navy-700',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-navy-700 dark:text-slate-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-navy-900 dark:text-slate-100">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
        )}
      </span>
      {meta && <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{meta}</span>}
    </button>
  );
}
